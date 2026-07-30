/**
 * The Appointments screen's view state machine, extracted so it can be unit tested.
 *
 * The state machine is where screens like this actually break — Orders V2 shipped three separate
 * bugs in exactly this logic (a flashing EMPTY, a trapped FILTERED_EMPTY, a result count for a
 * search nobody ran). Keeping it pure and RN-free means the repo's plain-node jest can cover every
 * branch without a rendering harness.
 */

export type AppointmentView =
  | 'ERROR'
  | 'LOADING'
  | 'DAY'
  | 'DAY_EMPTY'
  | 'CALENDAR'
  | 'CALENDAR_EMPTY'
  | 'CALENDAR_LOADING'
  | 'SEARCH_IDLE'
  | 'SEARCHING'
  | 'SEARCH_RESULTS'
  | 'NO_RESULTS';

export interface ViewInput {
  /** 'DAY' | 'CALENDAR' — the header's calendar toggle. */
  surface: 'DAY' | 'CALENDAR';
  /** 'browse' | 'search' — whether the search field is active. */
  mode: 'browse' | 'search';
  /** The debounced query. Empty while the user has focused the box but typed nothing. */
  query: string;
  /** Rows currently held for the active fetch. */
  rowCount: number;
  /** A request has completed at least once for the current key. */
  loadedOnce: boolean;
  /** The hook reported an error. */
  hasError: boolean;
}

/**
 * Precedence, top-down: ERROR → search branch → not-yet-loaded → surface branch.
 *
 * `hasError` only wins when there is nothing to show. A failed page-2 fetch behind a populated
 * list should leave the list on screen, not replace it with a full-screen error.
 */
export function deriveView(input: ViewInput): AppointmentView {
  const { surface, mode, query, rowCount, loadedOnce, hasError } = input;

  if (hasError && rowCount === 0 && loadedOnce) return 'ERROR';

  if (mode === 'search') {
    // Focused but empty: show nothing rather than a count for a search that never happened.
    if (!query) return 'SEARCH_IDLE';
    if (!loadedOnce) return 'SEARCHING';
    return rowCount > 0 ? 'SEARCH_RESULTS' : 'NO_RESULTS';
  }

  // `loadedOnce` must be driven by the loading true→false transition, not by `!loading`. On the
  // very first render no request has started yet, so a plain `!loading` check reports "loaded" and
  // flashes the empty state before anything has been asked for.
  if (!loadedOnce) return surface === 'CALENDAR' ? 'CALENDAR_LOADING' : 'LOADING';

  if (surface === 'CALENDAR') return rowCount > 0 ? 'CALENDAR' : 'CALENDAR_EMPTY';
  return rowCount > 0 ? 'DAY' : 'DAY_EMPTY';
}

/**
 * Orders needed a separate FILTERED_EMPTY state because its empty view hid the filter chips,
 * leaving the user with no way back. That cannot happen here: the week strip is the navigation and
 * is always on screen, so one empty state per surface is enough. Recorded so nobody "restores
 * parity" with Orders later.
 */
export const EMPTY_STATE_NOTE =
  'Single empty state per surface — the week strip is always visible, so the user is never trapped.';

/** The FAB is hidden in every search state and in ERROR; the mockup shows it everywhere else. */
export function showsFab(view: AppointmentView): boolean {
  return (
    view === 'DAY' ||
    view === 'DAY_EMPTY' ||
    view === 'CALENDAR' ||
    view === 'CALENDAR_EMPTY' ||
    view === 'LOADING' ||
    view === 'CALENDAR_LOADING'
  );
}

/** The week strip and month grid stay mounted except when searching or fully errored. */
export function showsDateNav(view: AppointmentView): boolean {
  return view !== 'ERROR' && !isSearchView(view);
}

export function isSearchView(view: AppointmentView): boolean {
  return (
    view === 'SEARCH_IDLE' ||
    view === 'SEARCHING' ||
    view === 'SEARCH_RESULTS' ||
    view === 'NO_RESULTS'
  );
}

/**
 * How many density dots a calendar day renders, capped at three per the mockup.
 *
 * The cap earns its keep: the cell is 46px wide, so an unbounded row would render a busy day as a
 * smear that reads as neither a count nor a marker. Three means "three or more".
 *
 * Lives here rather than inline in the screen because real data currently tops out at exactly three
 * appointments a day, so the cap is the one branch the preview cannot show us.
 */
export const MAX_DAY_DOTS = 3;

export function dayDotCount(appointments: number | undefined): number {
  if (!appointments || appointments < 0) return 0;
  return Math.min(appointments, MAX_DAY_DOTS);
}
