// One height (compact), one gap (chip-gap), one radius (chip) for every chip.
// The outline is a ring (box-shadow), so selected and unselected chips are the
// same size. The glyph slot is always rendered, at zero opacity when off.
export const chipBase = [
  // min-h, not h, and no nowrap: a long label wraps inside the chip at 200% text
  // instead of running off screen. A one-line chip is exactly the compact height.
  'group tap-44-y relative inline-flex min-h-compact max-w-full select-none items-center gap-2',
  'rounded-chip bg-surface px-3 py-1 text-left text-base leading-tight text-content',
  'ring-1 ring-inset ring-line cursor-pointer',
  'transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
].join(' ')

// Selected: a tint, a heavier ring and a glyph. Never the solid accent fill.
export const chipOn = (attr: 'checked' | 'pressed') =>
  attr === 'checked'
    ? 'data-[checked]:bg-selected data-[checked]:text-on-selected data-[checked]:ring-2 data-[checked]:ring-accent'
    : 'data-[pressed]:bg-selected data-[pressed]:text-on-selected data-[pressed]:ring-2 data-[pressed]:ring-accent'

export const glyphSlot = 'size-5 shrink-0'
