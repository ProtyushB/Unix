/**
 * The Services screen's view state machine, extracted so it can be unit tested.
 *
 * Same shape as `product.view.ts` and for the same reason: this is where screens of this kind
 * actually break, and keeping it pure lets the plain-node jest cover every branch without a render
 * harness.
 */

import type { ServiceRow } from './service.model';

export type ServiceView =
  | 'ERROR'
  | 'LOADING'
  | 'MAIN'
  | 'EMPTY'
  | 'SEARCH_IDLE'
  | 'SEARCHING'
  | 'SEARCH_RESULTS'
  | 'NO_RESULTS';

export interface ServiceViewInput {
  /** 'browse' | 'search' — whether the search field is active. */
  mode: 'browse' | 'search';
  /** The debounced query. Empty while the box is focused but nothing typed. */
  query: string;
  /** Rows held for the active fetch. */
  rowCount: number;
  /** True once a request has completed at least once — never a plain `!loading`. */
  loadedOnce: boolean;
  hasError: boolean;
}

/**
 * Precedence, top-down: error wins, then the search branch, then first-load, then browse.
 *
 * ERROR first because a failed load makes every other distinction meaningless — an empty list from
 * a request that never returned is not "no services yet".
 *
 * No FILTERED / FILTERED_EMPTY pair, matching Products and unlike Bills and Orders. That pair
 * exists to tell "none at all" apart from "none matching this chip", and this set has no status
 * chips. Availability is a per-row flag, not a filter, and sorting reorders without ever emptying.
 */
export function deriveServiceView(i: ServiceViewInput): ServiceView {
  if (i.hasError) return 'ERROR';

  if (i.mode === 'search') {
    // A focused box with nothing typed is not a search. Rendering "0 results for ''" for a query
    // nobody performed is the bug this state exists to prevent — Orders shipped it once.
    if (!i.query) return 'SEARCH_IDLE';
    if (!i.loadedOnce) return 'SEARCHING';
    return i.rowCount > 0 ? 'SEARCH_RESULTS' : 'NO_RESULTS';
  }

  if (!i.loadedOnce) return 'LOADING';
  return i.rowCount === 0 ? 'EMPTY' : 'MAIN';
}

/**
 * Whether the inline Add button shows.
 *
 * The button in the search row, not a FAB — this set has none, same as Products. It hides on EMPTY
 * because that hero already offers "Add Service", and on ERROR where the action is Retry.
 */
export function showsServiceAdd(view: ServiceView): boolean {
  return view !== 'EMPTY' && view !== 'ERROR';
}

/** Only the two states with a scrollable list under them. */
export function serviceHeaderCollapses(view: ServiceView): boolean {
  return view === 'MAIN' || view === 'SEARCH_RESULTS';
}

export function isServiceSearchView(view: ServiceView): boolean {
  return (
    view === 'SEARCH_IDLE' ||
    view === 'SEARCHING' ||
    view === 'SEARCH_RESULTS' ||
    view === 'NO_RESULTS'
  );
}

/**
 * Whether the "Service Menu" band renders.
 *
 * Browse only. In search mode the mockup replaces the whole band with a result count, and sorting a
 * search result set is not something the design offers.
 */
export function showsServiceMenuPanel(view: ServiceView): boolean {
  return view === 'MAIN';
}

// ─── Sort ────────────────────────────────────────────────────────────────────

export interface SortOption {
  key: string;
  label: string;
  /** Server-whitelisted field. Anything outside the whitelist silently falls back to `id`. */
  sortBy: string;
  sortDir: 'asc' | 'desc';
}

/**
 * The sort picker's options, all already accepted by the server.
 *
 * Duration replaces Products' Brand — a service has no brand, and "how long does it take" is the
 * natural third axis for a menu. Name ascending is the default; the server's own default is `id`
 * ascending (oldest first), which is why the screen always sends an explicit sort.
 */
export const SORT_OPTIONS: SortOption[] = [
  { key: 'name_asc', label: 'Name A–Z', sortBy: 'name', sortDir: 'asc' },
  { key: 'name_desc', label: 'Name Z–A', sortBy: 'name', sortDir: 'desc' },
  { key: 'price_asc', label: 'Price low to high', sortBy: 'price', sortDir: 'asc' },
  { key: 'price_desc', label: 'Price high to low', sortBy: 'price', sortDir: 'desc' },
  { key: 'duration_asc', label: 'Duration short to long', sortBy: 'duration', sortDir: 'asc' },
  { key: 'duration_desc', label: 'Duration long to short', sortBy: 'duration', sortDir: 'desc' },
  { key: 'created_desc', label: 'Recently added', sortBy: 'createdAt', sortDir: 'desc' },
];

export const DEFAULT_SORT_KEY = 'name_asc';

/** The picker's trigger shows a short form — "Name", not "Name A–Z". */
export function sortTriggerLabel(key: string): string {
  const opt = SORT_OPTIONS.find((o) => o.key === key) ?? SORT_OPTIONS[0];
  return opt.label.replace(/ (A–Z|Z–A|low to high|high to low|short to long|long to short)$/, '');
}

export function sortOptionFor(key: string): SortOption {
  return SORT_OPTIONS.find((o) => o.key === key) ?? SORT_OPTIONS[0];
}

// ─── Quick actions ───────────────────────────────────────────────────────────

export interface ServiceAction {
  key: 'edit' | 'availability' | 'book' | 'delete';
  label: string;
  /** Palette role for the ICON. Independent of `danger`, which tints the LABEL. */
  tint: 'success' | 'warning' | 'info' | 'error' | 'muted' | 'accent';
  danger?: boolean;
  /** Needs a confirm dialog before firing. */
  confirm?: 'delete';
  /** Not yet built — rendered, but inert. */
  todo?: boolean;
}

/**
 * The four rows of the quick-actions sheet — one more than Products has.
 *
 * Two of them are drawn but have nowhere to go, and are marked `todo` so the screen no-ops them
 * deliberately rather than pushing a broken route:
 *  - "Edit service" — the set contains no create/edit form, and the old ServiceDetailScreen is
 *    orphaned and excluded from typechecking.
 *  - "Book appointment" — there is no appointment-creation flow anywhere in the app; nothing calls
 *    `createAppointment`.
 *
 * The availability row's label flips with the service's current state — the mockup only ever draws
 * the "off" direction because every service it shows is available.
 */
export function quickActionsFor(row: ServiceRow): ServiceAction[] {
  return [
    { key: 'edit', label: 'Edit service', tint: 'muted', todo: true },
    {
      key: 'availability',
      label: row.availability ? 'Mark unavailable' : 'Mark available',
      tint: 'warning',
    },
    // The only accent-tinted row in any sheet in the app — the mockup singles it out as the
    // forward action rather than a state change.
    { key: 'book', label: 'Book appointment', tint: 'accent', todo: true },
    { key: 'delete', label: 'Delete service', tint: 'error', danger: true, confirm: 'delete' },
  ];
}
