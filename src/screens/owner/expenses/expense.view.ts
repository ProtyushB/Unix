import type {
  ExpenseCategory,
  ExpenseQuery,
  ExpenseSortKey,
  ReimbursementState,
} from '../../../backend/modules/shared/expense.types';
import { EXPENSE_CATEGORIES, categoryLabel } from '../../../backend/modules/shared/expense.types';
import { IST_OFFSET_MINUTES, IST_OFFSET_SUFFIX } from '../shared/detail/wallClock';

/**
 * The Expenses list screen's state machine, filters and copy.
 *
 * RN-free so jest can cover it. Same split as the four stock-ops list screens.
 */

// ─── View state ──────────────────────────────────────────────────────────────

export type ExpensesView =
  | 'LOADING'
  | 'ERROR'
  | 'EMPTY'
  | 'LIST'
  | 'SEARCH_IDLE'
  | 'SEARCHING'
  | 'NO_RESULTS'
  | 'FILTERED_EMPTY';

export interface ExpensesViewInput {
  mode: 'browse' | 'search';
  loading: boolean;
  loadedOnce: boolean;
  hasError: boolean;
  hasRows: boolean;
  hasQuery: boolean;
  filtered: boolean;
}

/**
 * Which body the screen draws.
 *
 * Precedence copied from `deriveWastageView`, and the ordering matters in the same way: an ERROR
 * outranks a LOADING so a failed refresh does not sit under a spinner, and the first load outranks
 * everything so an empty hero cannot flash before any request has answered.
 */
export function deriveExpensesView(i: ExpensesViewInput): ExpensesView {
  if (i.hasError) return 'ERROR';
  if (i.mode === 'search') {
    if (!i.hasQuery) return 'SEARCH_IDLE';
    if (i.loading) return 'SEARCHING';
    return i.hasRows ? 'LIST' : 'NO_RESULTS';
  }
  if (i.loading && !i.loadedOnce) return 'LOADING';
  if (i.hasRows) return 'LIST';
  if (!i.loadedOnce) return 'LOADING';
  return i.filtered ? 'FILTERED_EMPTY' : 'EMPTY';
}

/** The header only collapses over a real list — a hero has nothing to scroll past. */
export function headerCollapses(view: ExpensesView): boolean {
  return view === 'LIST';
}

/**
 * Whether the FAB is drawn.
 *
 * Hidden on EMPTY because that hero carries its own "Record Expense" button, and two primary
 * affordances for one action on one screen is one too many.
 */
export function showsFab(view: ExpensesView): boolean {
  return view !== 'LOADING' && view !== 'ERROR' && view !== 'EMPTY';
}

// ─── Filters ─────────────────────────────────────────────────────────────────

/**
 * Reimbursement has exactly TWO settings, not three.
 *
 * `pendingReimbursementOnly` applies only when literally true — `false` and absent both mean "no
 * filter" server-side — so "already settled only" is not a question this endpoint can answer. A
 * third chip would look like it worked and return everything.
 */
export type ReimbursementFilter = 'ALL' | 'PENDING';

export interface ExpenseFilters {
  category: ExpenseCategory | 'ALL';
  reimbursement: ReimbursementFilter;
  sortBy: ExpenseSortKey;
  sortDir: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: ExpenseFilters = {
  category: 'ALL',
  reimbursement: 'ALL',
  sortBy: 'expenseDate',
  sortDir: 'desc',
};

export function hasActiveFilters(f: ExpenseFilters): boolean {
  return (
    f.category !== DEFAULT_FILTERS.category ||
    f.reimbursement !== DEFAULT_FILTERS.reimbursement ||
    f.sortBy !== DEFAULT_FILTERS.sortBy ||
    f.sortDir !== DEFAULT_FILTERS.sortDir
  );
}

/**
 * Filters → the query the API takes.
 *
 * `'ALL'` becomes ABSENT rather than a null or a blank: `compactParams` drops nulls, but modelling
 * "no filter" as the absence of the key is what keeps `pendingReimbursementOnly` honest — sending
 * it as `false` would read as a filter and is silently ignored.
 */
export function toQuery(f: ExpenseFilters): ExpenseQuery {
  const query: ExpenseQuery = { sortBy: f.sortBy, sortDir: f.sortDir };
  if (f.category !== 'ALL') query.category = f.category;
  if (f.reimbursement === 'PENDING') query.pendingReimbursementOnly = true;
  return query;
}

/** The chips the filter button's tinted state summarises, for the FILTERED_EMPTY hero. */
export function appliedFilterChips(f: ExpenseFilters): string[] {
  const chips: string[] = [];
  if (f.category !== 'ALL') chips.push(categoryLabel(f.category));
  if (f.reimbursement === 'PENDING') chips.push('Pending reimburse');
  return chips;
}

export interface ReimbursementChip {
  key: ReimbursementFilter;
  label: string;
}

/** The two inline chips. Category lives in the filter sheet — fifteen will not fit on a row. */
export const REIMBURSEMENT_CHIPS: readonly ReimbursementChip[] = [
  { key: 'ALL', label: 'All expenses' },
  { key: 'PENDING', label: 'Pending reimburse' },
];

export interface SortChoice {
  key: string;
  label: string;
  sortBy: ExpenseSortKey;
  sortDir: 'asc' | 'desc';
}

/**
 * The sort section of the filter sheet.
 *
 * Four of the six whitelisted keys. `id` is an implementation detail no user thinks in, and
 * `category` sorts alphabetically by ENUM NAME server-side rather than by the label on screen —
 * which puts "Bank Fees" under B but "Maintenance & Repair" under M and "Rent / Lease" under R,
 * an order that looks arbitrary because the strings being compared are not the ones displayed.
 */
export const SORT_CHOICES: readonly SortChoice[] = [
  { key: 'newest', label: 'Newest first', sortBy: 'expenseDate', sortDir: 'desc' },
  { key: 'oldest', label: 'Oldest first', sortBy: 'expenseDate', sortDir: 'asc' },
  { key: 'amount', label: 'Amount ↓', sortBy: 'amount', sortDir: 'desc' },
  { key: 'title', label: 'Title A–Z', sortBy: 'title', sortDir: 'asc' },
];

export function sortChoiceKey(f: ExpenseFilters): string {
  const hit = SORT_CHOICES.find((c) => c.sortBy === f.sortBy && c.sortDir === f.sortDir);
  return hit ? hit.key : 'newest';
}

/** The category options for the filter sheet, with the "no filter" row leading. */
export const CATEGORY_FILTER_OPTIONS: readonly { value: ExpenseCategory | 'ALL'; label: string }[] =
  [{ value: 'ALL', label: 'All categories' }, ...EXPENSE_CATEGORIES];

// ─── The month total ─────────────────────────────────────────────────────────

/**
 * The IST month `totalByCategory` should be asked about, as two full ISO instants.
 *
 * Both bounds must carry an offset: the endpoint binds them as `Instant` with
 * `@DateTimeFormat(ISO.DATE_TIME)`, and a date-only value like `2026-08-01` is a 500 rather than a
 * 400 — indistinguishable from an outage.
 *
 * The month is the IST month, not the device's. `now` is a parameter so this is testable; the
 * screen passes the real clock.
 */
export function monthRangeIst(now: Date = new Date()): { from: string; to: string } {
  const ist = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  return {
    from: `${y}-${m}-01T00:00:00${IST_OFFSET_SUFFIX}`,
    to: now.toISOString(),
  };
}

/**
 * Sum a `totalByCategory` map, or read one key out of it.
 *
 * The endpoint returns all fifteen categories zero-filled, so a missing key means the response was
 * malformed rather than that the category had no spending — hence `null` rather than `0` when the
 * map itself is absent. Zero is a real answer; "we do not know yet" is not.
 */
export function monthTotal(
  totals: Record<string, number> | null | undefined,
  category: ExpenseCategory | 'ALL',
): number | null {
  if (!totals || typeof totals !== 'object') return null;
  if (category !== 'ALL') return Number(totals[category] ?? 0);
  return Object.values(totals).reduce<number>((sum, v) => sum + (Number(v) || 0), 0);
}

/**
 * "This month · ₹68,020" — and "This month · Utilities · ₹19,900" when a category is chosen.
 *
 * Null while the figure is unknown, so the header renders NOTHING rather than a zero it cannot
 * stand behind. There is deliberately no record COUNT in this line: the list endpoint reports
 * `totalPages` and never `totalElements`, so any number of expenses shown here would be invented.
 *
 * ⚠️ This figure does NOT narrow with the SEARCH box. `totalByCategory` takes a date range and a
 * category and nothing else — there is no search parameter on it. So a search showing three rows
 * still sits under the whole month's total, which is correct for what the line claims ("this month
 * cost X") and would be wrong if the line claimed to describe the rows. Do not "fix" this by
 * hiding it during a search; hide it only when the number is unknown.
 */
export function listSubtitle(
  total: number | null,
  category: ExpenseCategory | 'ALL',
  formatMoney: (n: number) => string,
): string | null {
  if (total == null) return null;
  const parts = ['This month'];
  if (category !== 'ALL') parts.push(categoryLabel(category));
  parts.push(formatMoney(total));
  return parts.join(' · ');
}

// ─── Reimbursement pill ──────────────────────────────────────────────────────

/**
 * Deliberately the same union as `BadgeTone`, not a superset.
 *
 * An earlier draft had a `warning` member for the pending pill, which `Badge` does not implement —
 * so it would have type-errored at every call site, or worse, been quietly mapped to neutral. The
 * palette this app draws pills from is the one Badge exposes; a pill that wants a sixth colour is a
 * change to Badge, not a value invented here.
 */
export type PillTone = 'neutral' | 'accent' | 'info' | 'success' | 'error';

/**
 * The card's reimbursement pill, or null for the ordinary company-paid expense.
 *
 * Most expenses are not reimbursable, and drawing "Not reimbursable" on every one of them would
 * turn the exception into the noise. Only the two states that are ABOUT a reimbursement say
 * anything.
 *
 * `accent` for pending rather than `error`: money owed to a colleague is an open loop, not a
 * fault, and red is what this app spends on genuine problems (expired stock, failed saves). It is
 * also the amber the mockup draws.
 */
export function reimbursementPill(
  state: ReimbursementState,
): { label: string; tone: PillTone } | null {
  if (state === 'PENDING') return { label: 'Reimburse pending', tone: 'accent' };
  if (state === 'SETTLED') return { label: 'Reimbursed', tone: 'success' };
  return null;
}

// ─── Hero copy ───────────────────────────────────────────────────────────────

export const SEARCH_PLACEHOLDER = 'Search title or vendor';

/** ⚠️ The server matches `title` and `vendorName` only — the placeholder must not promise notes. */
export const EMPTY_TITLE = 'No expenses yet';
export const EMPTY_BODY = 'Record your business spending — rent, utilities, repairs and more.';
export const EMPTY_CTA = 'Record Expense';

export const ERROR_TITLE = "Couldn't load expenses";
export const ERROR_BODY = 'Something went wrong. Check your connection and try again.';
export const ERROR_CTA = 'Retry';
/** The inline banner when a refresh fails but rows are already on screen. */
export const REFRESH_FAILED = "Couldn't refresh";

export const SEARCH_IDLE_TITLE = 'Search expenses';
export const SEARCH_IDLE_BODY = 'Type a title or a vendor name.';

export function noResultsTitle(query: string): string {
  return `No match for “${query.trim()}”.`;
}
export const NO_RESULTS_BODY = 'Try a different title or vendor.';

export const FILTERED_EMPTY_TITLE = 'Nothing matches these filters';
export const FILTERED_EMPTY_BODY = 'Clear a filter to see more.';
