// Opens the browser's native date/time picker for an <input type="datetime-local">.
// Falls back to focusing the field on browsers that don't support showPicker()
// (the field is still tappable there, just not auto-opened).
export function openPicker(el: HTMLInputElement | null) {
  if (!el) return;
  try {
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.focus();
  } catch {
    el.focus();
  }
}
