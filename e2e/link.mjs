/**
 * Pairing by invite link (no camera): link -> auto join -> reply via clipboard. Real browsers, real WebRTC, real UI.
 *   npm run build && npx vite preview --port 4173 &
 *   PLAYWRIGHT_MODULE=/path/to/playwright node e2e/link.mjs
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
const mk = async (label) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  pages[label] = page;
  await page.goto(URL);
  return page;
};

try {
  const host = await mk('host');
  await host.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  // How-it-works carousel on the home screen: every slide reachable, every screenshot loads.
  const slides = host.getByTestId('guide-slide');
  const n = await slides.count();
  expect(n >= 6, 'carousel has slides');
  for (let k = 1; k < n; k++) await host.getByTestId('guide-next').click();
  await host.waitForTimeout(500);
  expect(await host.getByTestId('guide-next').isDisabled(), 'next is disabled on the last slide');
  const broken = await host.evaluate(() => [...document.querySelectorAll('[data-testid=guide-slide] img')].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src));
  expect(broken.length === 0, 'guide screenshots failed to load: ' + broken.join(','));
  await host.getByTestId('guide-prev').click();
  await host.waitForTimeout(500);
  await host.getByTestId('how-it-works').screenshot({ path: `${OUT}23-guide.png` });
  log('carousel ok,', n, 'slides');
  await host.getByTestId('create-game').click();
  await host.getByTestId('host-name').fill('Host');
  await host.locator('[data-token=crown]').click();
  await host.getByTestId('host-create').click();
  const pin = (await host.getByTestId('pin').textContent()).trim();

  await host.getByTestId('add-player').click();
  await host.getByTestId('offer-stage').waitFor({ timeout: 15000 });
  const link = await host.getByTestId('send-link').getAttribute('data-link');
  expect(link && link.includes('#join=MG1.'), 'invite link carries the offer code');
  log('host invite link ready, length', link.length);

  const guest = await mk('guest');
  await guest.goto(link);
  await guest.getByTestId('join-reply').waitFor({ timeout: 15000 });
  expect(!(await guest.evaluate(() => location.hash)), 'link code removed from the address bar');
  log('guest opened the link and went straight to the reply step (no scan)');

  await guest.screenshot({ path: `${OUT}/22-guest-reply.png`, fullPage: true });
  // Guest "sends" the reply as a chat message; host copies it and uses the clipboard button.
  const reply = await guest.getByTestId('send-reply').getAttribute('data-code');
  await host.evaluate((t) => navigator.clipboard.writeText(t), `My Mahabharata reply code:\n${reply}\nthanks!`);
  await host.getByTestId('next-scan').click();
  await host.getByTestId('paste-clipboard').click();

  await guest.getByTestId('join-profile').waitFor({ timeout: 20000 });
  expect((await guest.getByTestId('guest-pin').inputValue()) === pin, 'PIN filled in automatically');
  log('connected; PIN auto-filled for the guest');
  await guest.getByTestId('guest-name').fill('Arjuna');
  await guest.locator('[data-token=bow]').click();
  await guest.getByTestId('guest-join').click();
  await guest.getByTestId('ready-toggle').waitFor({ timeout: 8000 });
  await host.locator('[data-player=Arjuna]').waitFor({ timeout: 8000 });
  expect(await host.getByTestId('invite-note').isVisible(), 'host sees a connected note');
  await host.screenshot({ path: `${OUT}/20-host-linked.png`, fullPage: true });
  log('\nPASS');
} catch (e) {
  log('\nFAIL:', e.message);
  for (const [k, pg] of Object.entries(pages)) await pg.screenshot({ path: `${OUT}/fail-link-${k}.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (errors.length) log('\nbrowser errors:\n' + errors.join('\n'));
  await browser.close();
}
