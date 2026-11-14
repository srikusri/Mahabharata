/**
 * Play UX: sound unlock, last-action summary in view, auto end turn (with hold and toggle).
 *   npm run build && npx vite preview --port 4173 &
 *   PLAYWRIGHT_MODULE=/path/to/playwright node e2e/recovery.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import jsQR from 'jsqr';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.APP_URL || 'http://localhost:4173/';
const OUT = process.env.OUT_DIR || new globalThis.URL('../e2e-out/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);
const errors = [];
const expect = (c, m) => c || (() => { throw new Error(m); })();

async function decodeCanvas(page) {
  const d = await page.evaluate(() => {
    const c = document.querySelector('[data-testid=qr-canvas]');
    const img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, px: Array.from(img.data) };
  });
  return jsQR(Uint8ClampedArray.from(d.px), d.w, d.h)?.data ?? null;
}
async function readQr(page) {
  const seen = new Map();
  let total = 1;
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const txt = await decodeCanvas(page).catch(() => null);
    if (txt) {
      const m = /^MGP\.([a-z0-9]{5})\.(\d+)\.(\d+)\./.exec(txt);
      if (!m) return [txt];
      seen.set(Number(m[2]), txt);
      total = Number(m[3]);
      if (seen.size === total) return [...seen.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    }
    await page.waitForTimeout(120);
  }
  throw new Error('QR never fully decoded');
}
async function feed(page, parts) {
  const box = page.getByTestId('paste-box');
  if (!(await box.isVisible())) await page.getByText('Type or paste code manually').click();
  for (const p of [...parts].reverse()) {
    await box.fill(p);
    await page.getByTestId('paste-use').click();
  }
}

/** Host shows an invite (button already visible), guest scans it and answers, host scans the answer. */
async function pair(host, guest) {
  await host.getByTestId('add-player').click();
  await host.getByTestId('offer-stage').waitFor({ timeout: 15000 });
  const offer = await readQr(host);
  await feed(guest, offer);
  await guest.getByTestId('join-reply').waitFor({ timeout: 15000 });
  const answer = await readQr(guest);
  await host.getByTestId('next-scan').click();
  await feed(host, answer);
}

const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection'] });
const pages = {};
const mk = async (label, prefs) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((p) => {
    localStorage.setItem('mg:ui', JSON.stringify(p));
    // Count oscillators so the test can prove sounds are actually triggered.
    window.__osc = 0;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      const orig = AC.prototype.createOscillator;
      AC.prototype.createOscillator = function () { window.__osc++; return orig.call(this); };
    }
  }, prefs);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  pages[label] = page;
  await page.goto(URL);
  return page;
};

async function lobbyJoin(host, guest, name, token, pin) {
  await pair(host, guest);
  await guest.getByTestId('join-profile').waitFor({ timeout: 20000 });
  await guest.getByTestId('guest-name').fill(name);
  await guest.locator(`[data-token=${token}]`).click();
  await guest.getByTestId('guest-pin').fill(pin);
  await guest.getByTestId('guest-join').click();
  await guest.getByTestId('ready-toggle').waitFor({ timeout: 8000 });
  await guest.getByTestId('ready-toggle').click();
  await host.locator(`[data-player=${name}]`, { hasText: 'Ready' }).waitFor({ timeout: 8000 });
}
/** Play until the End turn button is showing (do not press it). */
async function toAction(page) {
  const vis = (id) => page.getByTestId(id).isVisible().catch(() => false);
  for (let i = 0; i < 40; i++) {
    if (await vis('card-modal')) await page.getByTestId('card-modal').locator('button').click({ timeout: 2000 }).catch(() => {});
    else if (await vis('roll')) await page.getByTestId('roll').click({ timeout: 2000 }).catch(() => {});
    else if (await vis('decline')) await page.getByTestId('decline').click({ timeout: 2000 }).catch(() => {});
    else if (await vis('end-turn')) {
      await page.waitForTimeout(900);
      if (!(await vis('card-modal')) && (await vis('end-turn'))) return;
    }
    await page.waitForTimeout(350);
  }
  throw new Error('never reached the End turn button');
}

try {
  const host = await mk('host', { autoEnd: true, autoEndSec: 3 });
  const a = await mk('A', { autoEnd: true, autoEndSec: 3 });
  await host.getByTestId('create-game').click();
  await host.getByTestId('host-name').fill('Host');
  await host.locator('[data-token=crown]').click();
  await host.getByTestId('host-create').click();
  const pin = (await host.getByTestId('pin').textContent()).trim();
  await a.getByTestId('join-game').click();
  await lobbyJoin(host, a, 'Arjuna', 'bow', pin);
  await host.getByTestId('start-game').click();
  for (const p of [host, a]) await p.getByTestId('dashboard').waitFor({ timeout: 10000 });

  // 1. Sound is unlocked by the taps above, and a roll triggers real sound.
  await host.getByTestId('roll').click();
  await host.waitForTimeout(600);
  expect((await host.evaluate(() => document.documentElement.dataset.audio)) === 'running', 'audio context is running after taps');
  expect((await host.evaluate(() => window.__osc)) > 0, 'a roll played sound');
  log('sound: context running, oscillators fired:', await host.evaluate(() => window.__osc));

  // 2. Last action sits right under the board, inside the first screen.
  const la = host.getByTestId('last-action');
  await la.waitFor({ timeout: 5000 });
  const box = await la.boundingBox();
  expect(box && box.y + box.height <= 844, `last-action is within the viewport (bottom ${box && box.y + box.height})`);
  expect(/rolls/.test(await la.textContent()), 'last-action mentions the roll');
  await host.screenshot({ path: `${OUT}/30-last-action.png` });
  log('last-action visible without scrolling, bottom at', Math.round(box.y + box.height), 'px');
  const aText = await a.getByTestId('last-action').textContent();
  expect(/rolls/.test(aText), "other player also sees the host's roll summary");

  // 3. Auto end turn: finish the move, then do nothing.
  await toAction(host);
  await host.getByTestId('auto-end').waitFor();
  await a.getByTestId('roll').waitFor({ timeout: 9000 });
  log("auto end: host's turn ended by itself, Arjuna can roll");

  // 4. Hold stops the timer.
  await toAction(a);
  await a.getByTestId('auto-end-hold').click();
  await a.waitForTimeout(5000);
  expect(await a.getByTestId('end-turn').isVisible(), 'hold keeps the turn open');
  expect((await a.getByTestId('auto-end-hold').textContent()).includes('Resume'), 'hold button offers resume');
  // 5. Turning the setting off removes the countdown.
  await a.getByTestId('auto-end-hold').click(); // resume
  await a.getByTestId('auto-end-toggle').click();
  expect((await a.getByTestId('auto-end-toggle').textContent()).includes('off'), 'toggle reads off');
  expect((await a.getByTestId('auto-end').count()) === 0, 'countdown hidden when auto-end is off');
  await a.waitForTimeout(4500);
  expect(await a.getByTestId('end-turn').isVisible(), 'with auto-end off the turn stays open');
  await a.getByTestId('end-turn').click();
  await host.getByTestId('roll').waitFor({ timeout: 8000 });
  log('hold and toggle behave');
  log('\nPASS');
} catch (e) {
  log('\nFAIL:', e.message);
  for (const [k, pg] of Object.entries(pages)) await pg.screenshot({ path: `${OUT}/fail-ux-${k}.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (errors.length) log('\nbrowser errors:\n' + errors.join('\n'));
  await browser.close();
}
