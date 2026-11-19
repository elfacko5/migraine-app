// What every pressable thing shares, so Button and ListRow stay in step. Keep the
// strings whole: Tailwind finds classes by scanning for them.

// iOS: no grey tap highlight (the pressed tint replaces it), no press-and-hold
// callout, no label selection on a long press, and no double-tap zoom delay.
export const iosPress =
  'cursor-pointer select-none touch-manipulation [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]'

// The pressed tint: the fill only, the label untouched, and only on something
// that can be pressed (marked with data-pressable: not disabled, not loading),
// because iOS applies :active to a disabled button too.
export const pressedTint = 'data-pressable:active:bg-selected'
