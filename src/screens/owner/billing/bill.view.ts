/**
 * The Billing screen's view state machine, extracted so it can be unit tested.
 *
 * Same reasoning as `appointment.view.ts`: this is where screens of this shape actually break, and
 * keeping it pure lets the plain-node jest cover every branch without a rendering harness.
 */

export type BillView =
  | 'ERROR'
  | 'LOADING'
  | 'MAIN'
  | 'EMPTY'
  | 'FILTERED'
  | 'FILTERED_EMPTY'
  | 'SEARCH_IDLE'
  | 'SEARCHING'
  | 'SEARCH_RESULTS'
  | 'NO_RESULTS';

export interface BillViewInput {
  /** 'browse' | 'search' — whether the search field is active. */
  mode: 'browse' | 'search';
  /** The debounced query. Empty while the box is focused but nothing typed. */
  query: string;
  /** Rows held for the active fetch. */
  rowCount: number;
  /** True once a request has completed at least once — never a plain `!loading`. */
  loadedOnce: boolean;
  hasError: boolean;
  /** A payment-status chip other than "All" is selected. */
  filtered: boolean;
}

/**
 * Precedence, top-down: error wins, then the search branch, then first-load, then browse.
 *
 * ERROR first because a failed load makes every other distinction meaningless — an empty list from
 * a request that never returned is not "no bills yet".
 */
export function deriveBillView(i: BillViewInput): BillView {
  if (i.hasError) return 'ERROR';

  if (i.mode === 'search') {
    // A focused box with nothing typed is not a search. Rendering "0 results for ''" for a query
    // nobody performed is the bug this state exists to prevent — Orders shipped it once.
    if (!i.query) return 'SEARCH_IDLE';
    if (!i.loadedOnce) return 'SEARCHING';
    return i.rowCount > 0 ? 'SEARCH_RESULTS' : 'NO_RESULTS';
  }

  if (!i.loadedOnce) return 'LOADING';

  if (i.rowCount === 0) {
    // Split, unlike Appointments: "No bills yet" on a business with 41 bills is a lie, and the
    // recovery differs — one wants a Create button, the other wants the filter cleared. This is
    // the same split Orders needed and for the same reason.
    return i.filtered ? 'FILTERED_EMPTY' : 'EMPTY';
  }

  return i.filtered ? 'FILTERED' : 'MAIN';
}

/** The FAB is for creating a bill, so it hides wherever a hero already offers that action. */
export function showsBillFab(view: BillView): boolean {
  return view === 'MAIN' || view === 'FILTERED' || view === 'LOADING' || view === 'FILTERED_EMPTY';
}

/**
 * Whether the header may auto-hide on scroll.
 *
 * Only the two populated browse states. Search pins its own field so the query stays editable, and
 * the hero states would strand the user with no search box and no chips — the same reasoning that
 * produced FILTERED_EMPTY in the first place.
 */
export function billHeaderCollapses(view: BillView): boolean {
  return view === 'MAIN' || view === 'FILTERED';
}

export function isBillSearchView(view: BillView): boolean {
  return (
    view === 'SEARCH_IDLE' ||
    view === 'SEARCHING' ||
    view === 'SEARCH_RESULTS' ||
    view === 'NO_RESULTS'
  );
}

/** The chips are browse-only navigation; searching spans every status. */
export function showsBillChips(view: BillView): boolean {
  return !isBillSearchView(view) && view !== 'ERROR';
}

// ─── Quick actions ───────────────────────────────────────────────────────────

export interface QuickAction {
  key: string;
  label: string;
  /** 'bill' | 'payment' — which PATCH it maps to. */
  axis: 'bill' | 'payment';
  /** Needs a confirm dialog before firing. */
  confirm?: 'cancel' | 'finalize';
  /** Needs an amount typed in before it can be sent. */
  needsAmount?: boolean;
  /**
   * Palette role for the ICON, taken from the mockup. Deliberately independent of `danger`, which
   * tints the LABEL — the two coincide on the cancel/fail rows but are separate concerns.
   */
  tint: 'success' | 'warning' | 'info' | 'error' | 'muted';
  danger?: boolean;
}

const BILL_ACTIONS: QuickAction[] = [
  { key: 'DRAFT', label: 'Mark as Draft', axis: 'bill', tint: 'muted' },
  // The mockup set never draws this row — every sheet in it shows an already-finalized bill — so
  // amber is inherited from the lock badge on the Finalize Confirm dialog rather than specified.
  {
    key: 'FINALIZED',
    label: 'Mark as Finalized',
    axis: 'bill',
    confirm: 'finalize',
    tint: 'warning',
  },
  {
    key: 'CANCELLED',
    label: 'Mark as Cancelled',
    axis: 'bill',
    confirm: 'cancel',
    tint: 'error',
    danger: true,
  },
];

const PAYMENT_ACTIONS: QuickAction[] = [
  { key: 'PAID', label: 'Mark as Paid', axis: 'payment', tint: 'success' },
  {
    key: 'PARTIALLY_PAID',
    label: 'Mark as Partially Paid',
    axis: 'payment',
    needsAmount: true,
    tint: 'warning',
  },
  { key: 'FAILED', label: 'Mark as Failed', axis: 'payment', tint: 'error', danger: true },
];

/**
 * Actions offered for a bill, excluding whichever status it already has.
 *
 * Also drops Draft once a bill is cancelled: the server refuses that transition with a 409 because
 * cancelling already released the linked items and returned the stock, so offering it would only
 * ever produce an error. Better to not present an action that cannot succeed.
 */
export function quickActionsFor(billStatus: string, paymentStatus: string): QuickAction[] {
  const bill = BILL_ACTIONS.filter((a) => {
    if (a.key === billStatus) return false;
    if (a.key === 'DRAFT' && billStatus === 'CANCELLED') return false;
    return true;
  });
  const payment = PAYMENT_ACTIONS.filter((a) => a.key !== paymentStatus);
  return [...bill, ...payment];
}
