// Renders paper-diary.html: the paper sheet alone, and the composite with
// Lidd's chart beside it. Needs shots/07-detail-plateau.png from capture.mjs.
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
await browser.close();
