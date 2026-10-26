import { useState, useCallback, useEffect } from 'react';

export type TextScale = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type Theme = 'dark' | 'light';
export type FontChoice = 'lexend' | 'atkinson';

const SCALE_KEY = 'hd_text_scale';
const BRIGHTNESS_KEY = 'hd_brightness';
const ATTACK_MODE_KEY = 'hd_attack_mode';
const THEME_KEY = 'hd_theme';
const FONT_KEY = 'hd_font';
const ATTACK_AUTO_KEY = 'hd_attack_mode_auto';
const SYSTEM_TEXT_KEY = 'hd_system_text';
const VALID: TextScale[] = ['xs', 'sm', 'md', 'lg', 'xl'];

function applyScale(scale: TextScale, system = false) {
  document.documentElement.dataset.scale = system ? 'system' : scale;
  if (system) measureSystemText();
}

/**
 * "Use iPhone text size": read the OS body size and map it onto the app's own
 * range. `font: -apple-system-body` is Apple's WebKit hook into Dynamic Type —
 * Safari and the Capacitor WKWebView both honour it — and the iOS default is
 * 17px, so it is scaled by 16/17 to land the default on the app's own 16px.
 *
 * **Clamped to 14–24px**, the same span the five steps cover: Dynamic Type's
 * accessibility sizes reach 53px body, and the app's 150% ceiling exists
 * because at 200% it was four words to a line (see CLAUDE.md). Anywhere the
 * keyword isn't understood the measurement is skipped and it stays 16px.
 */
function measureSystemText() {
  const root = document.documentElement;
  let px = 16;
  if (typeof CSS !== 'undefined' && CSS.supports('font', '-apple-system-body')) {
    const probe = document.createElement('span');
    probe.style.font = '-apple-system-body';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    const measured = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    if (measured > 0) px = Math.min(24, Math.max(14, Math.round((measured * 16) / 17)));
  }
  root.style.setProperty('--system-text', `${px}px`);
}

function applyFont(font: FontChoice) {
  if (font === 'atkinson') document.documentElement.dataset.font = 'atkinson';
  else delete document.documentElement.dataset.font;
}

function loadFlag(key: string): boolean {
  try { return localStorage.getItem(key) === 'true'; } catch { return false; }
}

function loadFont(): FontChoice {
  try { if (localStorage.getItem(FONT_KEY) === 'atkinson') return 'atkinson'; } catch { /* ignore */ }
  return 'lexend';
}

function loadScale(): TextScale {
  try {
    const raw = localStorage.getItem(SCALE_KEY);
    if (raw && (VALID as string[]).includes(raw)) return raw as TextScale;
  } catch { /* ignore */ }
  return 'md';
}

// Attack mode and the light/dark choice both resolve to the one
// `data-theme` attribute CSS reads, so they have to be applied together
// rather than each setter fighting over it. Attack mode always wins: it's
// its own theme built for a mid-attack read, regardless of which of
// light/dark is otherwise selected (Sunny's call, 2026-09-25) — see
// docs/palette.md's light-mode section for why a "light attack mode" isn't
// in scope.
function applyTheme(attackMode: boolean, theme: Theme) {
  const resolved = attackMode ? 'attack' : theme === 'light' ? 'light' : null;
  if (resolved) document.documentElement.dataset.theme = resolved;
  else delete document.documentElement.dataset.theme;
}

function loadAttackMode(): boolean {
  try { return localStorage.getItem(ATTACK_MODE_KEY) === 'true'; } catch { return false; }
}

function loadTheme(): Theme {
  try { if (localStorage.getItem(THEME_KEY) === 'light') return 'light'; } catch { /* ignore */ }
  return 'dark';
}

function loadBrightness(): number {
  try {
    const raw = localStorage.getItem(BRIGHTNESS_KEY);
    if (raw !== null) {
      const n = parseFloat(raw);
      if (!isNaN(n) && n >= 0 && n <= 0.8) return n;
    }
  } catch { /* ignore */ }
  return 0;
}

export function useSettings() {
  const [textScale, setTextScaleState] = useState<TextScale>(() => {
    const s = loadScale();
    applyScale(s, loadFlag(SYSTEM_TEXT_KEY));
    return s;
  });

  // Follows the OS text size instead of the five steps. The steps keep their
  // stored value underneath, so turning this off returns to exactly the size
  // that was chosen before.
  const [systemText, setSystemTextState] = useState<boolean>(() => loadFlag(SYSTEM_TEXT_KEY));

  const [font, setFontState] = useState<FontChoice>(() => {
    const f = loadFont();
    applyFont(f);
    return f;
  });

  // Turns attack mode on whenever an ongoing attack is started — the moment
  // it's wanted and the moment it's hardest to go looking for. Off by default:
  // it changes the whole screen, so it's opted into, never assumed.
  const [attackModeAuto, setAttackModeAutoState] = useState<boolean>(() => loadFlag(ATTACK_AUTO_KEY));

  // The OS size can change while the app sits in the background — that is
  // where someone changes it, in iOS Settings — so it is re-read on every
  // return, the same pair of events the sync hooks and `useNowTick` use.
  useEffect(() => {
    if (!systemText) return;
    const remeasure = () => { if (document.visibilityState === 'visible') measureSystemText(); };
    document.addEventListener('visibilitychange', remeasure);
    window.addEventListener('focus', remeasure);
    return () => {
      document.removeEventListener('visibilitychange', remeasure);
      window.removeEventListener('focus', remeasure);
    };
  }, [systemText]);

  const [brightness, setBrightnessState] = useState<number>(() => loadBrightness());

  // Both read directly from storage rather than off each other's state, so
  // whichever of these two initialisers React happens to run first still
  // resolves the DOM attribute correctly — `applyTheme` is idempotent, so
  // the second call just re-confirms it.
  const [theme, setThemeState] = useState<Theme>(() => {
    const t = loadTheme();
    applyTheme(loadAttackMode(), t);
    return t;
  });

  const [attackMode, setAttackModeState] = useState<boolean>(() => {
    const on = loadAttackMode();
    applyTheme(on, loadTheme());
    return on;
  });

  const setTextScale = useCallback((scale: TextScale) => {
    applyScale(scale, systemText);
    try { localStorage.setItem(SCALE_KEY, scale); } catch { /* ignore */ }
    setTextScaleState(scale);
  }, [systemText]);

  const setSystemText = useCallback((on: boolean) => {
    applyScale(textScale, on);
    try { localStorage.setItem(SYSTEM_TEXT_KEY, String(on)); } catch { /* ignore */ }
    setSystemTextState(on);
  }, [textScale]);

  const setFont = useCallback((next: FontChoice) => {
    applyFont(next);
    try { localStorage.setItem(FONT_KEY, next); } catch { /* ignore */ }
    setFontState(next);
  }, []);

  const setAttackModeAuto = useCallback((on: boolean) => {
    try { localStorage.setItem(ATTACK_AUTO_KEY, String(on)); } catch { /* ignore */ }
    setAttackModeAutoState(on);
  }, []);

  const setBrightness = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(0.8, value));
    try { localStorage.setItem(BRIGHTNESS_KEY, String(clamped)); } catch { /* ignore */ }
    setBrightnessState(clamped);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(attackMode, next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
    setThemeState(next);
  }, [attackMode]);

  const setAttackMode = useCallback((on: boolean) => {
    applyTheme(on, theme);
    try { localStorage.setItem(ATTACK_MODE_KEY, String(on)); } catch { /* ignore */ }
    setAttackModeState(on);
  }, [theme]);

  return {
    textScale, setTextScale, brightness, setBrightness, theme, setTheme, attackMode, setAttackMode,
    font, setFont, attackModeAuto, setAttackModeAuto, systemText, setSystemText,
  };
}
