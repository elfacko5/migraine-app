import { createElement, type ReactNode, type Ref } from 'react'

// An empty state stands where content would be. It names why there is nothing
// (title, then an optional line), and offers at most one way forward.
//
// The heading level is the screen's decision, so there is no default. It is
// focusable by script (tabIndex -1) and never takes focus by itself: when the
// last item goes, the screen moves focus to it through headingRef. When the
// action itself removes the empty state, the screen moves focus elsewhere.
//
// The action is a primary or secondary Button, never tertiary (a tertiary
// button needs a neighbour). The package cannot inspect a node, so that is a
// lint rule for phase 8.

export type EmptyStateProps = {
  title: string
  /** Level of the title in the screen's outline. Level 1 belongs to the page title. */
  headingLevel: 2 | 3 | 4
  description?: string
  /** A primary or secondary Button. Never tertiary. */
  action?: ReactNode
  /** Lets the screen move focus to the title when this replaces a list. */
  headingRef?: Ref<HTMLHeadingElement>
}

export function EmptyState({ title, headingLevel, description, action, headingRef }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-gutter py-12 text-center">
      {createElement(
        `h${headingLevel}`,
        {
          ref: headingRef,
          tabIndex: -1,
          className:
            'rounded-control text-lg font-control leading-tight text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        },
        title,
      )}
      {description && <p className="max-w-prose text-base text-content-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
