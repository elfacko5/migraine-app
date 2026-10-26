import type { Tab } from '../types';

interface NavItem { id: Tab; label: string; icon: React.ReactNode }

// The four tab marks are Lucide paths, inlined unchanged — `calendar`, `list`,
// `line-chart` — plus the design's own gear for Settings — which is the rule for a generic UI affordance:
// Lucide's contract (24×24, fill none, currentColor, round caps) is the same
// one every icon here already follows, so a path drops straight in. They match
// the nav in Sunny's Figma, and the stroke is 1.8 rather than Lucide's own 2
// because that is what the nav has always used at this size.

/** Today. A calendar, not a house: the tab is a day, not a home screen, and
 *  the house said "start here" about a tab that is one of four. */
function TodayIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
}
/** Logs. A list, which is what the tab is — the clock-with-an-arrow read as
 *  "undo" or "recently viewed" rather than "everything you have logged". */
function HistoryIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/></svg>
}
/** Insights. A trend line on an axis: the page's own charts are trends over
 *  time, and bars are the one chart type it doesn't lead with. */
function StatsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/></svg>
}
// **A gear, and the tab is "Settings" again** (v3, 2026-10-26, Sunny's call),
// reversing the 2026-08-25 "Profile, with a person" decision: the v3 design
// names the tab for what it holds — display, attack mode, medications, data.
//
// **The design's own gear, drawn as it is there**: a ring with eight short
// spokes. It is not Lucide's cog (that was the first build, and Sunny asked
// for the design's mark). It reads close to a sun, which used to matter —
// the sun was the light/dark switch's mark — but that switch became the two
// theme tiles in the same round, so the shape has no other meaning to clash
// with now. Keep it that way: don't bring a sun back as an icon elsewhere.
function SettingsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>
}
function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" className="w-7 h-7"><path d="M12 5v14M5 12h14"/></svg>
}

const LEFT_TABS: NavItem[] = [
  { id: 'log', label: 'Today', icon: <TodayIcon /> },
  { id: 'history', label: 'Logs', icon: <HistoryIcon /> },
];

const RIGHT_TABS: NavItem[] = [
  { id: 'stats', label: 'Insights', icon: <StatsIcon /> },
  { id: 'profile', label: 'Settings', icon: <SettingsIcon /> },
];

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  onAdd: () => void;
  /**
   * What the FAB does right now — "Log an attack", or "Add update" while an
   * attack is ongoing. It is a bare plus with no visible label, so this is the
   * only thing a screen reader has to go on, and the action genuinely changes.
   */
  addLabel: string;
}

export function BottomNav({ active, onChange, onAdd, addLabel }: Props) {
  return (
    <>
      {/* `absolute` (not `fixed`) relative to App's own correctly-sized,
          non-scrolling root — position: fixed was confirmed, via live Safari
          Web Inspector testing on-device, to be hard-clipped to WebKit's own
          short native viewport after a cold PWA relaunch (icons rendered,
          labels below them didn't, regardless of top/bottom values). */}
      {/* **The v3 bar** (2026-10-26): its own tone, a step between the page
          and a card, rather than the page colour behind a blur. Mixed from
          the two surface tokens instead of being a token of its own, so it
          lands on the prototype's tab tone in dark and light and follows
          attack mode's surfaces with no third value to keep in step. */}
      <nav
        className="absolute inset-x-0 bottom-0 z-40 border-t border-bg-border bg-[color-mix(in_srgb,var(--color-bg-base)_55%,var(--color-bg-surface))]"
        style={{ paddingBottom: 'max(0.375rem, calc(env(safe-area-inset-bottom) - 0.625rem))' }}
      >
      <ul className="mx-auto flex w-full max-w-2xl items-end">
        {LEFT_TABS.map((tab) => (
          <li key={tab.id} className="flex-1">
            <TabBtn tab={tab} isActive={active === tab.id} onClick={() => onChange(tab.id)} />
          </li>
        ))}

        {/* 58px, centred on the tabs' own icon-and-label block so its top
            meets the bar's top edge, as in the design — *in* the bar rather
            than riding above it on a page-coloured ring: the raised version
            read as a second floating layer, and nothing else in the bar
            floats. */}
        <li className="flex flex-1 justify-center self-center">
          <button
            type="button"
            aria-label={addLabel}
            onClick={onAdd}
            className="flex items-center justify-center rounded-full bg-accent text-bg-base transition-colors hover:bg-accent-light active:scale-95 [&_svg]:h-[min(1.625rem,30px)] [&_svg]:w-[min(1.625rem,30px)]"
            style={{ height: 'min(3.625rem, 68px)', width: 'min(3.625rem, 68px)' }}
          >
            <PlusIcon />
          </button>
        </li>

        {RIGHT_TABS.map((tab) => (
          <li key={tab.id} className="flex-1">
            <TabBtn tab={tab} isActive={active === tab.id} onClick={() => onChange(tab.id)} />
          </li>
        ))}
      </ul>
      </nav>
    </>
  );
}

function TabBtn({ tab, isActive, onClick }: { tab: NavItem; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      // v3: the active tab is its colour **and** a heavier label — never colour
      // alone, so the 2px rule that used to mark it isn't needed. 22px marks,
      // 12px above them (measured off the design; 7px read as cramped against
      // the bar's top edge), and a tight label line under them.
      className={`flex w-full flex-col items-center gap-0.5 px-1 pt-3 pb-1.5 leading-tight transition-colors [&_svg]:h-[min(1.375rem,26px)] [&_svg]:w-[min(1.375rem,26px)] ${isActive ? 'font-semibold text-accent-light' : 'font-medium text-text-secondary hover:text-text-primary'}`}
      // The bar is fixed-width chrome with five slots, so its labels grow only
      // so far: at the 200% text setting the unclamped labels pushed Insights
      // into a clip and Profile off the screen entirely, which is a whole tab
      // becoming unreachable — the exact loss of functionality WCAG 1.4.4
      // forbids. The icons stay, the labels stay, they just stop growing.
      style={{ fontSize: 'min(0.875rem, 16px)' }}
    >
      <span aria-hidden="true">{tab.icon}</span>
      <span className="max-w-full truncate">{tab.label}</span>
    </button>
  );
}
