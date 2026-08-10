/**
 * The Customers list screen's state machine and copy, and the profile's gates.
 *
 * RN-free so jest can cover it.
 *
 * Two things are absent from this file and their absence is the design:
 *
 *   • NO filters. The list endpoint takes `businessId`, `page`, `limit` and `search` — nothing
 *     else — and sorts by `lastActivityAt DESC` server-side with no way to change it. A filter or
 *     sort control here would be a control that does nothing.
 *   • NO create. A customer row is born server-side from the first order, booking or bill; a person
 *     created directly would not appear in this list at all. The mockup's FAB was removed for that
 *     reason.
 */

export type CustomersView =
  | 'LOADING'
  | 'ERROR'
  | 'EMPTY'
  | 'LIST'
  | 'SEARCH_IDLE'
  | 'SEARCHING'
  | 'NO_RESULTS';

export interface CustomersViewInput {
  mode: 'browse' | 'search';
  loading: boolean;
  loadedOnce: boolean;
  hasError: boolean;
  hasRows: boolean;
  hasQuery: boolean;
}

/**
 * Which body the screen draws.
 *
 * Seven branches, not the eight the expense list has — there is no FILTERED_EMPTY, because there
 * are no filters to be empty under.
 */
export function deriveCustomersView(i: CustomersViewInput): CustomersView {
  if (i.hasError) return 'ERROR';
  if (i.mode === 'search') {
    if (!i.hasQuery) return 'SEARCH_IDLE';
    if (i.loading) return 'SEARCHING';
    return i.hasRows ? 'LIST' : 'NO_RESULTS';
  }
  if (i.loading && !i.loadedOnce) return 'LOADING';
  if (i.hasRows) return 'LIST';
  if (!i.loadedOnce) return 'LOADING';
  return 'EMPTY';
}

/** The header only collapses over a real list. */
export function headerCollapses(view: CustomersView): boolean {
  return view === 'LIST';
}

// ─── Copy ────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Says name, email and phone — and NOT username.
 *
 * Three docstrings on the server claim username is searched; the repository query names
 * `firstName`, `lastName`, `email` and `phoneNumber` and the query wins. Promising more than the
 * search performs is how a user concludes it is broken.
 */
export const SEARCH_PLACEHOLDER = 'Search name, email or phone';

/**
 * The line under the title.
 *
 * ⚠️ Carries NO count, and that is not an oversight. The list endpoint reports `totalPages` and
 * never `totalElements`, so "142 customers" would be a number nobody sent. It says where the rows
 * come from instead, which is the thing a reader actually needs to know about this screen.
 */
export const LIST_SUBTITLE = 'Derived from orders, bookings & bills';

/** The banner above the list — restates that this tab authors nothing. */
export const DERIVED_NOTE = 'Auto-built from orders, bookings & bills — read-only';

export const EMPTY_TITLE = 'No customers yet';
export const EMPTY_BODY =
  'People appear here automatically after their first order, booking or bill.';

/**
 * The banner when a refresh fails while rows are ALREADY on screen.
 *
 * The ERROR hero covers an empty list only — replacing good rows with an error page throws away
 * data the user can still use. But saying nothing leaves them looking at a list that quietly
 * stopped updating.
 */
export const REFRESH_FAILED = "Couldn't refresh";

export const ERROR_TITLE = "Couldn't load customers";
export const ERROR_BODY = 'Something went wrong. Check your connection and try again.';
export const ERROR_CTA = 'Retry';

export const SEARCH_IDLE_TITLE = 'Search customers';
export const SEARCH_IDLE_BODY = 'Type a name, an email or a phone number.';

export function noResultsTitle(query: string): string {
  return `No match for “${query.trim()}”.`;
}
export const NO_RESULTS_BODY = 'Try a different name, email or phone number.';

// ─── Profile ─────────────────────────────────────────────────────────────────

export const PROFILE_TITLE = 'Customer';
export const READ_ONLY_PILL = 'Read-only';

/**
 * The profile's Activity row, spelled out.
 *
 * "(finalized bills)" is on screen because `activityCount` counts exactly that — not orders, not
 * appointments, not visits. Without the parenthetical a reader compares it against the order list
 * and concludes one of the two is wrong.
 */
export function profileActivityValue(count: number | null | undefined): string {
  const n = Number(count ?? 0);
  return `${Number.isFinite(n) ? n : 0} (finalized bills)`;
}

/**
 * The profile NEVER fetches, and this states why in one place a test can pin.
 *
 * There is no customer-by-id endpoint. `GET /persons/{personId}` returns a `PersonDto` carrying
 * none of the rollups — no `totalSpent`, no `activityCount`, no `firstSeenAt`, no `lastActivityAt`
 * — AND is `@PreAuthorize("hasAuthority('CUSTOMER')")`, which an owner's token does not satisfy. So
 * a refetch would at best blank the four figures the screen exists to show, and at worst 403.
 *
 * The row travels in the route params instead. Consequences, all deliberate:
 *   • no deep link to a customer profile
 *   • no pull-to-refresh
 *   • the view machine is READY-only — there is no LOADING or ERROR branch to write
 */
export const PROFILE_REFETCHES = false;
