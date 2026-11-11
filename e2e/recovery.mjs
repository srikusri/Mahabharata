/**
 * Phase 4 end-to-end: reconnect after a guest reload, then host migration. Real browsers, real WebRTC, real UI.
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
  if (!(await box.isVisible())) await page.getByText('Paste code instead').click();
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
const mk = async (label) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
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

async function finishMove(page) {
  for (let i = 0; i < 14; i++) {
    if (await page.getByTestId('card-modal').isVisible()) await page.getByTestId('card-modal').getByText('OK').click();
    else if (await page.getByTestId('end-turn').isVisible()) {
      await page.waitForTimeout(400); // a card modal can appear just after the buttons
      if (!(await page.getByTestId('card-modal').isVisible())) return;
    }
    else if (await page.getByTestId('decline').isVisible()) await page.getByTestId('decline').click();
    else if (await page.getByTestId('roll').isVisible()) await page.getByTestId('roll').click();
    else if (await page.getByText('Daiva deck').isVisible().catch(() => false)) await page.getByText('Daiva deck').click();
    await page.waitForTimeout(400);
  }
}
async function takeTurn(page) {
  await page.getByTestId('roll').waitFor({ timeout: 10000 });
  await page.getByTestId('roll').click();
  await finishMove(page);
  await page.getByTestId('end-turn').click();
}
const cashOf = async (page, name) => (await page.locator(`[data-player=${name}]`).textContent()).match(/(\d+) S/)[1];

try {
  const host = await mk('host');
  const a = await mk('A');
  const b = await mk('B');

  await host.getByTestId('create-game').click();
  await host.getByTestId('host-name').fill('Host');
  await host.locator('[data-token=crown]').click();
  await host.getByTestId('host-create').click();
  const pin = (await host.getByTestId('pin').textContent()).trim();
  await a.getByTestId('join-game').click();
  await lobbyJoin(host, a, 'Arjuna', 'bow', pin);
  await b.getByTestId('join-game').click();
  await lobbyJoin(host, b, 'Bhima', 'horse', pin);
  await host.getByTestId('start-game').click();
  for (const p of [host, a, b]) await p.getByTestId('dashboard').waitFor({ timeout: 10000 });
  log('3 players in game');

  // Host takes a turn so there is real state to preserve.
  await takeTurn(host);
  await a.getByTestId('roll').waitFor({ timeout: 10000 });
  const hostCash = await cashOf(a, 'Host');
  log('host played a turn; Host has', hostCash, 'S');

  // ---------- Scenario 1: Arjuna's phone reloads mid-game, host reconnects the same seat.
  await a.reload();
  await host.locator('[data-offline=Arjuna]').waitFor({ timeout: 25000 });
  log('host sees Arjuna offline');
  await a.getByTestId('rejoin-game').waitFor({ timeout: 8000 });
  await a.getByTestId('rejoin-game').click();
  await pair(host, a); // host: Reconnect a player
  await a.getByTestId('dashboard').waitFor({ timeout: 25000 });
  await a.getByTestId('roll').waitFor({ timeout: 10000 });
  expect((await cashOf(a, 'Host')) === hostCash, 'state differs after reconnect');
  log('Arjuna rejoined his seat automatically; game state intact (no PIN needed)');
  await a.screenshot({ path: `${OUT}/10-rejoined.png`, fullPage: true });
  await takeTurn(a);
  await b.getByTestId('roll').waitFor({ timeout: 10000 });
  log('turn passed on to Bhima after the reconnect');

  // ---------- Scenario 2: the host disappears; Arjuna takes over, Bhima reclaims his seat with the new PIN.
  await host.context().close();
  await a.getByTestId('connection-lost').waitFor({ timeout: 25000 });
  await b.getByTestId('connection-lost').waitFor({ timeout: 25000 });
  log('both guests notice the host is gone');
  const bCash = await cashOf(b, 'Bhima');
  await a.locator('summary').click();
  await a.getByTestId('take-over').click();
  await a.getByTestId('host-tools').waitFor({ timeout: 8000 });
  const newPin = (await a.getByTestId('host-pin').textContent()).trim();
  expect(/^\d{4}$/.test(newPin), 'no new PIN');
  log('Arjuna is now host, PIN', newPin);

  await b.getByTestId('reconnect').click();
  await pair(a, b);
  await b.getByTestId('join-claim').waitFor({ timeout: 25000 });
  await b.getByTestId('claim-pin').fill(newPin === '0000' ? '1111' : '0000');
  await b.getByTestId('claim-join').click();
  await b.getByTestId('join-error').waitFor({ timeout: 8000 });
  await b.getByTestId('claim-pin').fill(newPin);
  await b.getByTestId('claim-join').click();
  await b.getByTestId('dashboard').waitFor({ timeout: 15000 });
  expect((await cashOf(b, 'Bhima')) === bCash, 'Bhima money changed across migration');
  log('Bhima reclaimed his seat under the new host; money preserved');

  // Whoever is up can act through the new host.
  const turnTitle = async (p) => (await p.getByTestId('turn-title').textContent()).trim();
  const bTurn = (await turnTitle(b)) === 'Your turn';
  await (bTurn ? takeTurn(b) : takeTurn(a));
  await (bTurn ? a : b).getByTestId('roll').waitFor({ timeout: 10000 }).catch(() => {});
  log('play continues under the new host');
  await a.screenshot({ path: `${OUT}/11-new-host.png`, fullPage: true });
  await b.screenshot({ path: `${OUT}/12-guest-after-migration.png`, fullPage: true });
  log('\nPASS');
} catch (e) {
  log('\nFAIL:', e.message);
  for (const [k, pg] of Object.entries(pages)) await pg.screenshot({ path: `${OUT}/fail-${k}.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (errors.length) log('\nbrowser errors:\n' + errors.join('\n'));
  await browser.close();
}
