// Full-page captures of the v4 boards and proposals the case study shows
// beside the shipped screens. Static local HTML, no app, no data.
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
const require = createRequire((process.env.PW ?? process.cwd() + '/node_modules') + '/');
const { chromium } = require('playwright');

const ROOT = new URL('../docs/redesign-v4/', import.meta.url).pathname;
const OUT = new URL('./shots/boards/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const BOARDS = [
  ['screens/07-detail/DetailDark.html', 'v4-detail'],
  ['screens/07-detail/DetailLowerDark.html', 'v4-detail-lower'],
  ['screens/07-detail/DetailFlaggedDark.html', 'v4-detail-flagged'],
  ['proposals/AttackModeBandBottomProposals.html', 'attack-mode-bottom-placements'],
  ['proposals/AttackModeSwitchProposals.html', 'attack-mode-switch-proposals'],
];

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
for (const [file, name] of BOARDS) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
  await page.goto('file://' + ROOT + file);
  await page.waitForTimeout(1200);
  // A screen board is one fixed-size phone frame on a blank page: crop to
  // it. A proposal page is a long document: take all of it.
  if (file.startsWith('screens/')) {
    const box = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('body *'));
      const r = els.filter((e) => getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)')
        .map((e) => e.getBoundingClientRect()).filter((b) => b.width > 300 && b.width < 600 && b.height > 500)
        .sort((a, b) => b.height - a.height)[0];
      return r && { x: r.left, y: r.top, width: r.width, height: r.height };
    });
    await page.setViewportSize({ width: 1440, height: Math.ceil(box.y + box.height + 20) });
    await page.screenshot({ path: OUT + name + '.png', clip: box });
  } else {
    await page.screenshot({ path: OUT + name + '.png', fullPage: true });
  }
  console.log('saved', name);
  await page.close();
}
await browser.close();
