// Renders the case study's composed visuals from local HTML:
// paper-diary.html (the sheet alone, and beside Lidd's chart),
// board-vs-shipped.html and review-table.html. Needs capture.mjs and boards.mjs to have run first.
// PW / CHROME as in capture.mjs.
import { createRequire } from 'module';
const require = createRequire((process.env.PW ?? process.cwd() + '/node_modules') + '/');
const { chromium } = require('playwright');

const HERE = new URL('.', import.meta.url).pathname;
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 3 });

await page.goto('file://' + HERE + 'paper-diary.html');
await page.waitForTimeout(800);
await page.locator('.solo .sheet').screenshot({ path: HERE + 'shots/paper-diary.png', omitBackground: true });
console.log('saved paper-diary');

await page.goto('file://' + HERE + 'paper-diary.html?composite');
await page.waitForTimeout(800);
await page.locator('.composite').screenshot({ path: HERE + 'shots/plateau-lidd-vs-paper.png' });
console.log('saved plateau-lidd-vs-paper');

await page.goto('file://' + HERE + 'board-vs-shipped.html');
await page.waitForTimeout(800);
await page.locator('.wrap').screenshot({ path: HERE + 'shots/detail-board-vs-shipped.png' });
console.log('saved detail-board-vs-shipped');

await page.goto('file://' + HERE + 'review-table.html');
await page.waitForTimeout(800);
await page.locator('.wrap').screenshot({ path: HERE + 'shots/redesign-review-table.png' });
console.log('saved redesign-review-table');
await browser.close();
