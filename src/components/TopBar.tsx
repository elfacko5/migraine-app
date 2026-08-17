interface Props {
  title: string;
  action?: React.ReactNode;
}

/**
 * Sticky top app bar. Its background extends up through the status-bar area
 * via padding-top: env(safe-area-inset-top), so app content no longer renders
 * under the phone's status bar.
 *
 * Deliberately has no bottom border: the content below it is the same base
 * colour, and a divider under the greeting made the bar read as a separate
 * strip of chrome rather than the top of the page.
 */
export function TopBar({ title, action }: Props) {
  return (
    <header
      className="sticky top-0 z-30 bg-bg-base/90 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* min-h rather than a fixed height: the title is large enough now that
          a 3.5rem row would clip it at the bigger text-size settings. */}
      <div className="mx-auto flex min-h-14 max-w-2xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        {/* 34px at the default text size, expressed in rem so the app's own
            text-size control still scales it — a px value would pin the one
            piece of type on screen that ignores the setting. */}
        <h1 className="text-[2.125rem] font-bold leading-tight text-text-primary">{title}</h1>
        {action}
      </div>
    </header>
  );
}
