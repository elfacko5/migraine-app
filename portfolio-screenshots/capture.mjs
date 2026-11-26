// Portfolio screenshots of the current app, from a fictional diary
// (`seed.mjs`). Every shot runs in a fresh, isolated browser context, so it
// never touches a real diary and never holds a Supabase session — and the
// script still refuses to seed an origin that has an `sb-` key.
//
// Run, with a dev server up (default: the `migraine-app-verify` config, 5175):
//   PW=<dir containing node_modules/playwright> CHROME=<chromium binary> \
//     node portfolio-screenshots/capture.mjs
// PW and CHROME are optional: without them it imports `playwright` normally
// and uses Playwright's own browser.

import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import { attacks, medications } from './seed.mjs';

const require = createRequire((process.env.PW ?? process.cwd() + '/node_modules') + '/');
const { chromium } = require('playwright');

const BASE = process.env.BASE ?? 'http://localhost:5175';
const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PHONE = { width: 430, height: 932 };
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});

/**
 * A fresh context with the fictional diary loaded. `height` > 932 gives a
 * full-length capture of a screen that scrolls (the app scrolls a nested div,
 * so Playwright's fullPage can't).
 */
async function open({ ongoing = true, theme = 'dark', attackMode = false, height = PHONE.height } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: PHONE.width, height },
    deviceScaleFactor: 3,
    colorScheme: 'dark',
    locale: 'en-GB',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('page error:', e.message));
  await page.goto(BASE);
  const signedIn = await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('sb-')));
  if (signedIn) throw new Error(`${BASE} holds a Supabase session — refusing to seed it`);
  const now = Date.now();
  await page.evaluate(([a, m, t, am]) => {
    localStorage.clear();
    localStorage.setItem('hd_attacks', JSON.stringify(a));
    localStorage.setItem('hd_medications', JSON.stringify(m));
    localStorage.setItem('hd_hit6_dismissed', new Date().toISOString());
    localStorage.setItem('hd_theme', t);
    localStorage.setItem('hd_attack_mode', String(am));
  }, [attacks(now, { withOngoing: ongoing }), medications(now), theme, attackMode]);
  await page.reload();
  await page.waitForTimeout(900);
  return { page, close: () => ctx.close() };
}

async function tab(page, name) {
  await page.getByRole('button', { name, exact: true }).first().click();
  await page.waitForTimeout(700);
}

async function shot(page, name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + name + '.png' });
  console.log('saved', name);
}

/** Opens the Logs row whose accessible name contains `text`. */
async function openRow(page, text) {
  await tab(page, 'Logs');
  await page.locator('button', { hasText: text }).first().click();
  await page.waitForTimeout(900);
}

/** Selects head zones in the pain step and rates each. The zones' click
 *  targets carry no name, so each is tapped and kept only if the severity
 *  group that opens names a wanted area. */
async function pickAreas(page, wanted) {
  const targets = page.locator('svg path[fill="rgba(0,0,0,0)"]');
  const n = await targets.count();
  for (let i = 0; i < n; i++) {
    await targets.nth(i).dispatchEvent('click');
    await page.waitForTimeout(150);
    const label = await page.locator('[role="group"][aria-label$="severity, 1 to 10"]').first().getAttribute('aria-label').catch(() => null);
    const name = label?.replace(/ severity, 1 to 10$/, '');
    if (name && name in wanted) {
      await page.locator('[role="group"][aria-label$="severity, 1 to 10"] button', { hasText: new RegExp(`^${wanted[name]}`) }).first().click();
      await page.waitForTimeout(150);
    } else if (name) {
      await targets.nth(i).dispatchEvent('click');
      await page.waitForTimeout(150);
    }
  }
  await shot(page, '15-log-pain-areas');
}

const TALL = 3300;

// --- Today --------------------------------------------------------------
{
  const { page, close } = await open();
  await shot(page, '01-today-ongoing');
  await close();
}
{
  const { page, close } = await open({ ongoing: false });
  await shot(page, '02-today-attack-free');
  await close();
}
{
  const { page, close } = await open({ ongoing: false, theme: 'light' });
  await shot(page, '03-today-attack-free-light');
  await close();
}
{
  // Attack mode off (the pill) and on (the strip on the nav), same attack.
  const { page, close } = await open({ attackMode: true });
  await shot(page, '04-today-attack-mode-on');
  await tab(page, 'Logs');
  await shot(page, '05-logs-attack-mode-on');
  await close();
}

// --- Logs ---------------------------------------------------------------
{
  const { page, close } = await open();
  await tab(page, 'Logs');
  await shot(page, '06-logs');
  await close();
}

// --- Attack detail --------------------------------------------------------
{
  // The plateau attack: the first dose held the pain flat, the second broke it.
  const { page, close } = await open();
  await openRow(page, '9h 12m');
  await shot(page, '07-detail-plateau');
  await close();
}
{
  const { page, close } = await open({ height: TALL });
  await openRow(page, '9h 12m');
  await shot(page, '08-detail-plateau-full');
  await close();
}
{
  const { page, close } = await open();
  await tab(page, 'Logs');
  await page.getByRole('button', { name: /under 5 minutes/ }).first().click();
  await page.waitForTimeout(900);
  await shot(page, '09-detail-under-5-minutes');
  await close();
}
{
  const { page, close } = await open({ height: 1800 });
  await openRow(page, 'Length not recorded');
  await shot(page, '10-detail-ended-in-sleep');
  await close();
}

// --- Insights -------------------------------------------------------------
{
  const { page, close } = await open();
  await tab(page, 'Insights');
  await shot(page, '11-insights');
  await close();
}
{
  const { page, close } = await open({ height: 3900 });
  await tab(page, 'Insights');
  await page.getByRole('button', { name: '3m', exact: true }).click();
  await page.waitForTimeout(700);
  await shot(page, '12-insights-3m-full');
  await close();
}

// --- Logging ----------------------------------------------------------------
{
  const { page, close } = await open({ ongoing: false });
  await page.getByRole('button', { name: 'Log or update an attack' }).click();
  await page.waitForTimeout(700);
  await shot(page, '13-add-sheet');
  await page.locator('button', { hasText: 'Log an attack' }).last().click();
  await page.waitForTimeout(900);
  await shot(page, '14-log-first-step');
  for (let i = 2; i <= 3; i++) {
    const next = page.getByRole('button', { name: /^(Next|Continue)$/ }).last();
    if (!(await next.isVisible().catch(() => false)) || !(await next.isEnabled())) break;
    await next.click();
    await page.waitForTimeout(800);
    await shot(page, `14-log-step-${i}`);
    if (i === 2) await pickAreas(page, { 'Temple left': 8, 'Eye left': 7, 'Forehead left': 5 });
  }
  await close();
}

await browser.close();
console.log('done →', OUT);
