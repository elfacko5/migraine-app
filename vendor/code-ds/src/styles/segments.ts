// The look of a track of segments, shared by the Segmented control and, later,
// Tabs. Keep the strings whole: Tailwind finds classes by scanning for them.

// The track: the field radius, a 3:1 line ring (the outline of something you
// press) and a small gap around and between the segments.
export const segmentTrack = 'rounded-field bg-surface p-0.5 gap-0.5 ring-1 ring-inset ring-line'

// One segment: the segment radius, centred wrapping text that is never truncated
// and never breaks inside a word, and an inset focus ring.
export const segmentBase = [
  'relative flex min-w-0 items-center justify-center rounded-segment text-center text-base leading-tight text-content',
  '[overflow-wrap:normal] [hyphens:none]',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
].join(' ')

// The selected segment: a tint and a 2px accent ring, drawn inset so the track's
// rounded corners never clip it and nothing changes size. The state is the ring
// and the tint, never colour alone. attr is the data attribute that marks it.
export const segmentSelected = (attr: 'checked' | 'selected' | 'active') => {
  // Written out in full so Tailwind finds the classes. Radio marks the selected
  // segment data-checked, and Base UI Tabs marks the selected tab data-active.
  if (attr === 'checked')
    return 'data-[checked]:bg-selected data-[checked]:text-on-selected data-[checked]:ring-2 data-[checked]:ring-inset data-[checked]:ring-accent'
  if (attr === 'active')
    return 'data-[active]:bg-selected data-[active]:text-on-selected data-[active]:ring-2 data-[active]:ring-inset data-[active]:ring-accent'
  return 'data-[selected]:bg-selected data-[selected]:text-on-selected data-[selected]:ring-2 data-[selected]:ring-inset data-[selected]:ring-accent'
}
