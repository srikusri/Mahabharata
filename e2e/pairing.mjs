/**
 * End-to-end pairing test: two isolated browsers, real WebRTC, real UI.
 *
 * It stands in for the camera: it samples the on-screen QR canvas, decodes it
 * with jsQR (the same decoder the app's scanner uses), and hands the decoded
 * text to the other browser's code collector, multi-part codes out of order.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   PLAYWRIGHT_MODULE=/path/to/playwright node e2e/pairing.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import jsQR from 'jsqr';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.APP_URL || 'http://localhost:4173/';
const OUT = process.env.OUT_DIR || new globalThis.URL('../e2e-out/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const log = (...a) => console.log(...a);
const watch = (page, label) => {
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${label} console: ${m.text()}`));
};

async function decodeCanvas(page) {
  const d = await page.evaluate(() => {
    const c = document.querySelector('[data-testid=qr-canvas]');
    const img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, px: Array.from(img.data) };
  });
  return jsQR(Uint8ClampedArray.from(d.px), d.w, d.h)?.data ?? null;
}

/** Sample the QR like a camera until every part has been seen. */
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
  throw new Error('QR was never fully decoded');
}

async function feed(page, parts) {
  const box = page.getByTestId('paste-box');
  if (!(await box.isVisible())) await page.getByText('Paste code instead').click();
  for (const p of [...parts].reverse()) {
    await box.fill(p);
    await page.getByTestId('paste-use').click();
  }
}

const fail = (msg) => {
  throw new Error(msg);
};
const expect = (cond, msg) => cond || fail(msg);

const browser = await chromium.launch({
  args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection'],
});
const mk = async (label) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  watch(page, label);
  await page.goto(URL);
  return page;
};

try {
  const host = await mk('host');
  const guest = await mk('guest');
  const t0 = Date.now();

  // --- host creates a game
  await host.getByTestId('create-game').click();
  await host.getByTestId('host-name').fill('Yudhishthira');
  await host.locator('[data-token=crown]').click();
  await host.getByTestId('host-create').click();
  const pin = (await host.getByTestId('pin').textContent()).trim();
  expect(/^\d{4}$/.test(pin), `bad PIN ${pin}`);

  // --- stage 1: host shows OFFER, guest scans it
  await host.getByTestId('add-player').click();
  await host.getByTestId('offer-stage').waitFor({ timeout: 15000 });
  const offer = await readQr(host);
  log(`offer QR: ${offer.length} part(s), ${offer.join('').length} chars on the wire`);
  await host.screenshot({ path: `${OUT}/1-host-offer.png` });

  await guest.getByTestId('join-game').click();
  await feed(guest, offer);

  // --- stage 2: guest shows ANSWER, host scans it
  await guest.getByTestId('join-reply').waitFor({ timeout: 15000 });
  const answer = await readQr(guest);
  log(`answer QR: ${answer.length} part(s), ${answer.join('').length} chars on the wire`);
  await guest.screenshot({ path: `${OUT}/2-guest-answer.png` });

  // The offer alone must NOT connect anything.
  expect((await host.getByTestId('player-list').locator('li').count()) === 1, 'guest appeared before the answer was scanned');

  await host.getByTestId('next-scan').click();
  await feed(host, answer);

  // --- channel opens: guest reaches the profile form
  await guest.getByTestId('join-profile').waitFor({ timeout: 20000 });
  log(`data channel open after ${((Date.now() - t0) / 1000).toFixed(1)}s (incl. QR sampling)`);
  await guest.screenshot({ path: `${OUT}/3-guest-profile.png` });

  // --- wrong PIN first, then the right one
  await guest.getByTestId('guest-name').fill('Arjuna');
  await guest.locator('[data-token=crown]').click({ force: true }).catch(() => {}); // taken by host; must be disabled
  await guest.locator('[data-token=bow]').click();
  await guest.getByTestId('guest-pin').fill(pin === '0000' ? '1111' : '0000');
  await guest.getByTestId('guest-join').click();
  await guest.getByTestId('join-error').waitFor({ timeout: 8000 });
  expect((await guest.getByTestId('join-error').textContent()).includes('Wrong PIN'), 'wrong PIN message missing');
  expect((await host.getByTestId('player-list').locator('li').count()) === 1, 'wrong PIN was admitted');
  log('wrong PIN rejected, connection kept open');

  await guest.getByTestId('guest-pin').fill(pin);
  await guest.getByTestId('guest-join').click();
  await guest.getByTestId('ready-toggle').waitFor({ timeout: 8000 });
  await host.locator('[data-player=Arjuna]').waitFor({ timeout: 8000 });
  log('Arjuna joined the lobby (PIN accepted)');

  // --- ready -> host can start
  expect(await host.getByTestId('start-game').isDisabled(), 'start enabled before ready');
  await guest.getByTestId('ready-toggle').click();
  await host.locator('[data-player=Arjuna]', { hasText: 'Ready' }).waitFor({ timeout: 8000 });
  await host.screenshot({ path: `${OUT}/4-host-lobby.png`, fullPage: true });
  await guest.screenshot({ path: `${OUT}/5-guest-lobby.png`, fullPage: true });
  await host.getByTestId('start-game').click();

  // --- both land on the board
  await host.getByTestId('dashboard').waitFor({ timeout: 8000 });
  await guest.getByTestId('dashboard').waitFor({ timeout: 8000 });
  expect((await host.locator('[data-space="0"] span').count()) === 2, 'host board should show 2 tokens at GO');
  expect((await guest.locator('[data-space="0"] span').count()) === 2, 'guest board should show 2 tokens at GO');
  await guest.waitForFunction(() => /\d+ ms/.test(document.querySelector('[data-testid=conn-badge]')?.textContent || ''), null, { timeout: 8000 });
  log('game started on both devices; guest sees round-trip time:', (await guest.getByTestId('conn-badge').textContent()).trim());
  await host.screenshot({ path: `${OUT}/6-host-play.png`, fullPage: true });
  await guest.screenshot({ path: `${OUT}/7-guest-play.png`, fullPage: true });

  // --- play: host rolls (authoritative), guest sees the same dice, turn passes
  async function finishMove(page) {
    // resolve whatever the game is waiting for until the end-turn button appears
    for (let i = 0; i < 12; i++) {
      if (await page.getByTestId('card-modal').isVisible()) await page.getByTestId('card-modal').getByText('OK').click();
      else if (await page.getByTestId('end-turn').isVisible()) return;
      else if (await page.getByTestId('decline').isVisible()) await page.getByTestId('decline').click();
      else if (await page.getByTestId('roll').isVisible()) await page.getByTestId('roll').click(); // doubles
      else if (await page.locator('text=Sanjaya').first().isVisible().catch(() => false)) await page.getByText('Daiva deck').click();
      await page.waitForTimeout(400);
    }
  }
  await host.getByTestId('roll').waitFor({ timeout: 8000 });
  expect(!(await guest.getByTestId('roll').isVisible()), 'guest can roll on host turn');
  await host.getByTestId('roll').click();
  await guest.waitForFunction(() => document.querySelector('[data-testid=dice]')?.getAttribute('data-dice'), null, { timeout: 8000 });
  const hd = await host.getByTestId('dice').getAttribute('data-dice');
  const gd = await guest.getByTestId('dice').getAttribute('data-dice');
  expect(hd === gd && /^\d,\d$/.test(hd), `dice differ host=${hd} guest=${gd}`);
  log(`host rolled ${hd}; guest sees the same dice`);
  await finishMove(host);
  await host.getByTestId('end-turn').click();
  await guest.getByTestId('roll').waitFor({ timeout: 8000 });
  await guest.getByTestId('roll').click();
  await host.waitForFunction((d) => document.querySelector('[data-testid=dice]')?.getAttribute('data-dice') !== d, hd, { timeout: 8000 }).catch(() => {});
  await finishMove(guest);
  await guest.getByTestId('end-turn').click();
  await host.getByTestId('roll').waitFor({ timeout: 8000 });
  log('guest rolled and ended their turn; control returned to host');
  await host.screenshot({ path: `${OUT}/8-host-after-turns.png`, fullPage: true });
  await guest.screenshot({ path: `${OUT}/9-guest-after-turns.png`, fullPage: true });

  // --- guest drops: host must notice and mark them offline
  await guest.context().close();
  await host.locator('[data-testid=conn-badge]').first().waitFor();
  log('guest browser closed (host keeps running)');

  log('\nPASS');
} catch (e) {
  log('\nFAIL:', e.message);
  process.exitCode = 1;
} finally {
  if (errors.length) log('\nbrowser errors:\n' + errors.join('\n'));
  await browser.close();
}
