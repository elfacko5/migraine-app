import { chromium } from 'playwright';

const BASE = 'http://localhost:5180';
const OUT = new URL('.', import.meta.url).pathname;

// Dates are relative to "now" (not hardcoded) so seeded attacks always fall
// inside the default "7 days" filter regardless of when this script runs.
const now = Date.now();
const hoursAgo = (h) => new Date(now - h * 60 * 60 * 1000).toISOString();

const endedAttack = {
  id: 2000,
  snapshots: [
    { time: hoursAgo(72), areas: { 'Eye left': 10 }, symptoms: [], reliefs: [], medication: null, note: null, source: 'manual' },
    { time: hoursAgo(70.5), areas: { 'Eye left': 9, 'Forehead left': 9 }, symptoms: ['Throbbing'], reliefs: ['Dark room', 'Hydration'], medication: { name: 'Sumatriptan', dose: '2 tablets' }, note: null, source: 'manual' },
  ],
  end: hoursAgo(48),
  triggers: [],
  notificationConfig: { enabled: false, mode: 'adaptive', fixedIntervalMinutes: 60 },
  updatedAt: new Date().toISOString(),
};

const ongoingAttack = {
  id: 1000,
  snapshots: [
    { time: hoursAgo(5), areas: { 'Temple left': 8 }, symptoms: [], reliefs: [], medication: null, note: null, source: 'manual' },
  ],
  end: null,
  triggers: [],
  notificationConfig: { enabled: false, mode: 'adaptive', fixedIntervalMinutes: 60 },
  updatedAt: new Date().toISOString(),
};

async function seed(page, attacks) {
  await page.evaluate((data) => {
    localStorage.setItem('hd_attacks', JSON.stringify(data));
  }, attacks);
  await page.reload();
  await page.waitForTimeout(300);
}

async function clickByText(page, text) {
  await page.evaluate((t) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent.trim() === t);
    btn?.click();
  }, text);
  await page.waitForTimeout(200);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
await page.emulateMedia({ colorScheme: 'dark' });

// --- Screenshot 1 & 2: Attack Detail + Insights (need both attacks) ---
await page.goto(BASE);
await seed(page, [ongoingAttack, endedAttack]);

await clickByText(page, 'Logs');
await page.waitForTimeout(200);
// Click the ended attack's card (identified by its medication chip, not its
// date — the date's month/day shifts depending on when this script runs).
await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('button')).filter(
    (b) => b.getBoundingClientRect().height > 60
  );
  const endedCard = cards.find((c) => c.textContent.includes('Sumatriptan'));
  endedCard?.click();
});
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + '1-attack-detail.png' });

// Close detail sheet, go to Insights
await page.evaluate(() => {
  const closeBtn = Array.from(document.querySelectorAll('button')).find(
    (b) => b.getBoundingClientRect().top < 100 && b.getBoundingClientRect().left < 100
  );
  closeBtn?.click();
});
await page.waitForTimeout(200);
await clickByText(page, 'Insights');
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + '2-insights.png' });

// --- Screenshot 3: LogForm Pain areas step (no ongoing attack) ---
await seed(page, [endedAttack]);
await clickByText(page, 'Start logging');
await page.waitForTimeout(200);
await clickByText(page, 'Next');
await page.waitForTimeout(200);

const svgBox = await page.evaluate(() => {
  const svgs = Array.from(document.querySelectorAll('svg'));
  const target = svgs.find((s) => s.getAttribute('viewBox') === '112 235 336 525');
  const r = target.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
});
// "Eye left" zone center is at [350, 460] in the 112 235 336 525 viewBox
const xRel = (350 - 112) / 336;
const yRel = (460 - 235) / 525;
await page.mouse.click(svgBox.left + xRel * svgBox.width, svgBox.top + yRel * svgBox.height);
await page.waitForTimeout(200);

await page.evaluate(() => {
  const slider = document.querySelector('input[type="range"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(slider, '9');
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  slider.dispatchEvent(new Event('change', { bubbles: true }));
  slider.blur();
});
await page.waitForTimeout(200);
await page.screenshot({ path: OUT + '3-pain-areas.png' });

await page.evaluate(() => localStorage.removeItem('hd_attacks'));
await browser.close();
console.log('done');
