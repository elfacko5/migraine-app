import type { Tab } from '../types';

interface NavItem { id: Tab; label: string; icon: React.ReactNode }

function HomeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>
}
function HistoryIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l3 3"/></svg>
}
function StatsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="0.5"/><rect x="12" y="8" width="3" height="10" rx="0.5"/><rect x="17" y="5" width="3" height="13" rx="0.5"/></svg>
}
// A person, not a gear: the tab holds the user's own medications and account
// alongside the accessibility controls, and a gear under the word "Profile"
// still reads as the old Settings destination.
function ProfileIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>
}
function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" className="w-7 h-7"><path d="M12 5v14M5 12h14"/></svg>
}

const LEFT_TABS: NavItem[] = [
  { id: 'log', label: 'Today', icon: <HomeIcon /> },
  { id: 'history', label: 'Logs', icon: <HistoryIcon /> },
];

const RIGHT_TABS: NavItem[] = [
  { id: 'stats', label: 'Insights', icon: <StatsIcon /> },
  { id: 'profile', label: 'Profile', icon: <ProfileIcon /> },
];

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  onAdd: () => void;
}

export function BottomNav({ active, onChange, onAdd }: Props) {
  return (
    <>
      {/* `absolute` (not `fixed`) relative to App's own correctly-sized,
          non-scrolling root — position: fixed was confirmed, via live Safari
          Web Inspector testing on-device, to be hard-clipped to WebKit's own
          short native viewport after a cold PWA relaunch (icons rendered,
          labels below them didn't, regardless of top/bottom values). */}
      <nav
        className="absolute inset-x-0 bottom-0 z-40 border-t border-bg-border bg-bg-base/95 backdrop-blur-md"
        style={{ paddingBottom: 'max(0.375rem, calc(env(safe-area-inset-bottom) - 0.625rem))' }}
      >
      <ul className="mx-auto flex w-full max-w-2xl items-end">
        {LEFT_TABS.map((tab) => (
          <li key={tab.id} className="flex-1">
            <TabBtn tab={tab} isActive={active === tab.id} onClick={() => onChange(tab.id)} />
          </li>
        ))}

        <li className="flex flex-1 justify-center pb-1.5">
          <button
            type="button"
            aria-label="Log a migraine"
            onClick={onAdd}
            className="-mt-8 flex items-center justify-center rounded-full bg-accent text-bg-base ring-4 ring-bg-base transition-colors hover:bg-accent-light active:scale-95 [&_svg]:h-[min(1.75rem,32px)] [&_svg]:w-[min(1.75rem,32px)]"
            style={{ height: 'min(3.5rem, 68px)', width: 'min(3.5rem, 68px)' }}
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
      className={`flex w-full flex-col items-center gap-1 border-t-2 px-1 pt-2 pb-1 font-medium transition-colors [&_svg]:h-[min(1.5rem,28px)] [&_svg]:w-[min(1.5rem,28px)] ${isActive ? 'border-border-subtle text-accent-light' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
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
