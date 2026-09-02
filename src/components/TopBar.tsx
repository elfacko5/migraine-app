interface Props {
  title: string;
  action?: React.ReactNode;
  /** A control belonging to the page that has to stay visible while it
   *  scrolls — currently only the Insights period. It goes *inside* this
   *  header rather than sticking on its own, so there is no second sticky
   *  element to offset against this one's height, which varies with the
   *  safe-area inset and the text-size setting and so can't be a constant. */
  control?: React.ReactNode;
  /** Hides the visible title and lets `control` take its row. The `h1` is
   *  still rendered, `sr-only`: the page keeps its heading for anyone
   *  navigating by heading, and the section `h2`s keep something to sit
   *  under. Only meaningful alongside `control` — with the title gone and
   *  nothing to replace it, the header would collapse to an empty bar. */
  titleHidden?: boolean;
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
export function TopBar({ title, action, control, titleHidden = false }: Props) {
  // A control with no title takes the title's own row; with a title it sits
  // beneath one. Guarded so `titleHidden` on its own can't empty the bar.
  const collapsed = titleHidden && !!control;
  return (
    <header
      className="sticky top-0 z-30 bg-bg-base/90 backdrop-blur-md"
      // 2rem (32px at the default text size) *on top of* the safe-area inset,
      // never instead of it: the inset is what keeps the title clear of the
      // status bar and notch, and it reads as 0 in the browser preview — so a
      // flat value tuned here would look right on desktop and collide with the
      // clock on device. Same trap BottomNav's bottom clearance already has.
      // 1rem rather than 2rem when a control stands in for the title: the
      // 32px above was measured for a 34px headline, and over a 32px control
      // it read as the header floating away from its own page.
      style={{ paddingTop: `calc(${collapsed ? '1rem' : '2rem'} + env(safe-area-inset-top))` }}
    >
      {/* min-h rather than a fixed height: the title is large enough now that
          a 3.5rem row would clip it at the bigger text-size settings. */}
      {/* No `min-h-14` when a control replaces the title — that floor exists
          so a 34px headline isn't clipped at the larger text sizes, and around
          a 32px control it is just dead space. */}
      <div className={`mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2 sm:px-6 ${collapsed ? '' : 'min-h-14'}`}>
        {collapsed ? (
          <>
            <h1 className="sr-only">{title}</h1>
            <div className="min-w-0 flex-1">{control}</div>
          </>
        ) : (
          /* 34px at the default text size, expressed in rem so the app's own
             text-size control still scales it — a px value would pin the one
             piece of type on screen that ignores the setting. */
          <h1 className="text-[2.125rem] font-bold leading-tight text-text-primary">{title}</h1>
        )}
        {action}
      </div>
      {control && !collapsed && (
        // Under the title while there is one. It still reads as belonging to
        // that title rather than as a strip of its own — which is the
        // reasoning that keeps this header borderless — but sitting on the
        // title row's own 8px it was cramped against a 34px headline (Sunny,
        // 2026-09-02). `pt-3` takes the gap to 20px.
        <div className="mx-auto max-w-2xl px-4 pb-3 pt-3 sm:px-6">{control}</div>
      )}
    </header>
  );
}
