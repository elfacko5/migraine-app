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
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-6">
        <h1 className="text-lg font-bold text-text-primary">{title}</h1>
        {action}
      </div>
    </header>
  );
}
