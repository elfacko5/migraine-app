import { useState, useCallback } from 'react';

export type TextScale = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type Theme = 'dark' | 'light';

const SCALE_KEY = 'hd_text_scale';
const BRIGHTNESS_KEY = 'hd_brightness';
const ATTACK_MODE_KEY = 'hd_attack_mode';
const THEME_KEY = 'hd_theme';
const VALID: TextScale[] = ['xs', 'sm', 'md', 'lg', 'xl'];

function applyScale(scale: TextScale) {
  document.documentElement.dataset.scale = scale;
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
    applyScale(s);
    return s;
  });

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
    applyScale(scale);
    try { localStorage.setItem(SCALE_KEY, scale); } catch { /* ignore */ }
    setTextScaleState(scale);
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

  return { textScale, setTextScale, brightness, setBrightness, theme, setTheme, attackMode, setAttackMode };
}
