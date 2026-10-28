import { useEffect, useId, useRef, useState } from 'react';
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

export interface FabAction { label: string; onSelect: () => void }

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  /**
   * What the + menu offers right now (2026-10-28). With no attack ongoing:
   * Log an attack / Add a past attack. While one is ongoing: Add an update /
   * End attack — never a past attack, since someone mid-attack shouldn't have
   * to think about a different episode.
   */
  addActions: FabAction[];
}

export function BottomNav({ active, onChange, addActions }: Props) {
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
          <FabMenu actions={addActions} />
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

/**
 * The + button and the small menu it opens (2026-10-28). It used to act
 * directly — log an attack, or add an update while one was ongoing — and now
 * offers two actions, because "Add a past attack" and "End attack" needed a
 * home that is always within thumb reach.
 *
 * **Built fresh, not from `Sheet` or `ConfirmDialog`**: both are full-overlay
 * and modal, which is far heavier than choosing between two actions. This is
 * a menu anchored above the button, in the WAI-ARIA menu-button shape —
 * `aria-haspopup="menu"` + `aria-expanded` on the trigger, `role="menu"` and
 * `menuitem`s, arrow keys move, Escape or a tap outside closes and returns
 * focus to the +.
 *
 * Its accessible name names the menu, not either action. One string kept
 * accurate for two items is the drift the old dynamic `addLabel` was guarding
 * against when there was only one action to describe.
 *
 * `bg-surface` with the control ring, no shadow (the palette has none): it is
 * a set of things to press, so its edge is the control token, and it sits a
 * step lighter than the bar beneath it. Items are plain rows, not accent
 * buttons — the + itself stays the one solid accent target.
 */
function FabMenu({ actions }: { actions: FabAction[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  // Focus the first item on open — the menu-button contract, and what makes
  // the arrow keys usable straight away.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  // A tap anywhere outside closes it. `pointerdown` rather than `click`, so
  // the tap that closes the menu doesn't also land on whatever was under it
  // first — it does land, but the menu is already gone by then.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
    else if (e.key === 'Tab') close(false);
  }

  return (
    <div ref={rootRef} className="relative">
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Log or update an attack"
          onKeyDown={onMenuKey}
          className="absolute bottom-[calc(100%+0.75rem)] left-1/2 w-max min-w-[13rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-sheet bg-bg-surface py-1 ring-1 ring-inset ring-border-control"
          // Chrome, like the bar under it: the menu grows with the text-size
          // setting, but only so far, so it can't outgrow a phone's width.
          style={{ fontSize: 'min(1rem, 20px)' }}
        >
          {actions.map((a, i) => (
            <button
              key={a.label}
              ref={(el) => { itemRefs.current[i] = el; }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => { close(false); a.onSelect(); }}
              className={`flex min-h-12 w-full items-center px-4 py-2.5 text-left font-medium text-text-primary transition-colors hover:bg-bg-raised focus-visible:bg-bg-raised ${
                i > 0 ? 'border-t border-bg-border' : ''
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Log or update an attack"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); }
        }}
        className="flex items-center justify-center rounded-full bg-accent text-bg-base transition-[color,background-color,transform] hover:bg-accent-light active:scale-95 [&_svg]:h-[min(1.625rem,30px)] [&_svg]:w-[min(1.625rem,30px)]"
        style={{ height: 'min(3.625rem, 68px)', width: 'min(3.625rem, 68px)' }}
      >
        {/* Turns to a × while open, so the same button reads as the way out. */}
        <span className={`flex transition-transform ${open ? 'rotate-45' : ''}`} aria-hidden="true">
          <PlusIcon />
        </span>
      </button>
    </div>
  );
}
