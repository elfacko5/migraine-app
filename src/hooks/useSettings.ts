import { useState, useCallback } from 'react';

export type TextScale = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SCALE_KEY = 'hd_text_scale';
const BRIGHTNESS_KEY = 'hd_brightness';
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

  return { textScale, setTextScale, brightness, setBrightness };
}
