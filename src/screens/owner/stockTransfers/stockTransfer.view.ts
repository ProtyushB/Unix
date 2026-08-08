import type { InventoryType } from '../../../backend/modules/shared/inventory.types';
import type {
  StockTransferDto,
  StockTransferQuery,
  StockTransferReason,
} from '../../../backend/modules/shared/stockTransfer.types';

/**
 * The Stock Transfers screen's view state machine and its filter mapping.
 *
 * Same shape and reasoning as `batch.view.ts` / `consumption.view.ts`: this is where screens of this
 * kind actually break, and keeping it pure lets plain-node jest cover every branch with no render
 * harness. Nothing here may import React Native — `jest.config.js` only collects `*.test.ts`.
 */

export type StockTransfersView =
  | 'ERROR'
  | 'LOADING'
  | 'MAIN'
  | 'EMPTY'
  | 'SEARCH_IDLE'
  | 'SEARCHING'
  | 'SEARCH_RESULTS'
  | 'NO_RESULTS'
  | 'FILTERED'
  | 'FILTERED_EMPTY';

export interface StockTransfersViewInput {
  mode: 'browse' | 'search';
  query: string;
  rowCount: number;
  /** True once a request has COMPLETED at least once — never a plain `!loading`. */
  loadedOnce: boolean;
  hasError: boolean;
  /** True when any filter is narrowing the list. */
  filtered: boolean;
}

/**
 * Precedence: error, then search, then first-load, then filtered, then browse.
 *
 * FILTERED_EMPTY is kept even though this feature's only narrowing axis is the sort order, because
 * the pair is what stops "No transfers yet" being shown to a business that has hundreds — and the
 * moment the backend grows a filterable axis, the machine already handles it.
 */
export function deriveStockTransfersView(i: StockTransfersViewInput): StockTransfersView {
  if (i.hasError) return 'ERROR';

  if (i.mode === 'search') {
    // A focused box with nothing typed is not a search — do not render "0 results for ''".
    if (!i.query) return 'SEARCH_IDLE';
    if (!i.loadedOnce) return 'SEARCHING';
    return i.rowCount > 0 ? 'SEARCH_RESULTS' : 'NO_RESULTS';
  }

  if (!i.loadedOnce) return 'LOADING';
  if (i.filtered) return i.rowCount === 0 ? 'FILTERED_EMPTY' : 'FILTERED';
  return i.rowCount === 0 ? 'EMPTY' : 'MAIN';
}

/** The header collapses only where there is a list to scroll. */
export function headerCollapses(view: StockTransfersView): boolean {
  return view === 'MAIN' || view === 'FILTERED' || view === 'SEARCH_RESULTS';
}

/**
 * The FAB shows wherever there is no hero CTA offering the same thing.
 *
 * Two Transfer affordances on one screen is what this prevents: the empty state already carries a
 * button, and a floating + beside it reads as a different action.
 */
export function showsFab(view: StockTransfersView): boolean {
  return view === 'MAIN' || view === 'FILTERED' || view === 'FILTERED_EMPTY';
}

// ─── Filters ─────────────────────────────────────────────────────────────────

/**
 * What the sheet can narrow by: the SORT ORDER, and nothing else.
 *
 * ⚠️ There is deliberately no `reason` here, and that is the difference from consumption and
 * wastage. `StockTransferQuery` has no `reason` key because the transfer controller reads no such
 * param — `reason` is SORTABLE but not FILTERABLE. Both siblings do accept it, so a filter sheet
 * built by copying the wastage one grows reason chips that appear to work and silently return the
 * unfiltered list. Adding one here is a compile error, which is the point.
 *
 * There is no direction filter either, for the same reason: `sourceType` and `destType` are
 * sortable and not filterable. Sort by `sourceType` to group Product→Raw away from Raw→Product.
 */
export interface StockTransferFilters {
  /** Newest-first is the default everywhere in this app; ascending has to be explicit. */
  sortDir: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: StockTransferFilters = { sortDir: 'desc' };

/** Whether anything is narrowing the list. Sort order counts — it changes what page 1 is. */
export function hasActiveFilters(f: StockTransferFilters): boolean {
  return f.sortDir !== DEFAULT_FILTERS.sortDir;
}

/** Filters → the query the API layer sends. */
export function toQuery(f: StockTransferFilters): StockTransferQuery {
  return { sortDir: f.sortDir };
}

/** The sort order, as the sheet and the applied-chip row spell it. */
export function sortLabel(sortDir: 'asc' | 'desc'): string {
  return sortDir === 'asc' ? 'Oldest first' : 'Newest first';
}

/**
 * The chips under the search box, once the sheet has been used.
 *
 * Exactly one axis can appear, because exactly one is filterable — see `StockTransferFilters`. The
 * shape is a list anyway so the row does not have to change the day a second axis exists.
 */
export function appliedFilterChips(f: StockTransferFilters): { id: string; label: string }[] {
  if (f.sortDir === DEFAULT_FILTERS.sortDir) return [];
  return [{ id: 'sortDir', label: sortLabel(f.sortDir) }];
}

// ─── Direction and reason labels ─────────────────────────────────────────────

/** "Product" / "Raw" — the short pool names the mockups use everywhere. */
export function poolLabel(pool: InventoryType | null | undefined): string {
  return pool === 'RAW_INVENTORY' ? 'Raw' : 'Product';
}

/**
 * "Product → Raw" — the direction a record actually moved stock.
 *
 * ⚠️ Built from the POOLS, never from the reason. `PRODUCT_TO_RAW` alongside
 * `sourceType: 'RAW_INVENTORY'` is accepted by the server and is a lie in the audit log; a row that
 * drew its arrow from the reason would show that move backwards, and nothing would ever catch it.
 *
 * The `→` is a direction arrow, NOT a quantity separator — the `·` convention is for quantities.
 *
 * Empty when either end is missing: a half-known direction is worse than none, because "Product →
 * Product" is a legal-looking sentence about an illegal move.
 */
export function directionLabel(
  sourceType: InventoryType | null | undefined,
  destType: InventoryType | null | undefined,
): string {
  if (!sourceType || !destType) return '';
  return `${poolLabel(sourceType)} → ${poolLabel(destType)}`;
}

const REASON_LABELS: Record<StockTransferReason, string> = {
  PRODUCT_TO_RAW: 'Product → Raw',
  RAW_TO_PRODUCT: 'Raw → Product',
  REBALANCE: 'Rebalance',
  CORRECTION: 'Correction',
  OTHER: 'Other',
};

/** "PRODUCT_TO_RAW" → "Product → Raw". Falls back to the raw value rather than rendering blank. */
export function reasonLabel(reason: StockTransferReason | null | undefined): string {
  if (!reason) return '';
  return REASON_LABELS[reason] ?? String(reason);
}

/**
 * Whether a reason is one of the two that NAME a direction.
 *
 * The asymmetry in `STOCK_TRANSFER_REASONS` made explicit: the first two members restate the pools,
 * the last three say something the pools cannot.
 */
export function isDirectionalReason(reason: StockTransferReason | null | undefined): boolean {
  return reason === 'PRODUCT_TO_RAW' || reason === 'RAW_TO_PRODUCT';
}

/**
 * Whether the list card draws a reason chip.
 *
 * Only for the three NON-directional reasons. A `PRODUCT_TO_RAW` chip sitting beside the card's own
 * "Product → Raw" line says the same thing twice — and worse, it would say it from the untrusted
 * source, so on a contradictory record the two lines would disagree with no way to tell which is
 * true. Rebalance / Correction / Other carry information the arrow cannot.
 */
export function showsReasonChip(reason: StockTransferReason | null | undefined): boolean {
  return !!reason && !isDirectionalReason(reason);
}

// ─── Quick actions ───────────────────────────────────────────────────────────

export type StockTransferActionId = 'view' | 'delete';

export interface StockTransferAction {
  id: StockTransferActionId;
  label: string;
  /** Second line under the label — here, what Delete actually does or why it cannot. */
  sub?: string;
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * Why Delete cannot be offered, or null when it can.
 *
 * ⚠️ The real block — a 409 `STOCK_MOVEMENT_LOCKED`, raised once the destination batch has been
 * drawn from — is NOT knowable from the DTO. Nothing on the record reports it, so the client cannot
 * pre-empt it and this function must not pretend otherwise: guessing "locked" would hide a delete
 * that would have succeeded. The refusal is caught on the way back instead, and the confirm dialog
 * warns about it up front. See `deleteRefusalMessage`.
 */
export function deleteBlockedReason(record: StockTransferDto | null | undefined): string | null {
  if (record?.id == null) return 'This transfer has not been saved yet';
  return null;
}

/**
 * The long-press sheet's actions.
 *
 * Two, and that is the whole list: a transfer is IMMUTABLE, so there is no edit and no status
 * change. Delete is a REVERSAL rather than a tidy-up, which is why it is labelled as one.
 *
 * Follows `batch.view.ts`'s rule — a blocked action is rendered DISABLED with its reason rather than
 * hidden, because a missing row reads as a missing feature.
 */
export function quickActionsFor(
  record: StockTransferDto | null | undefined,
): StockTransferAction[] {
  const blocked = deleteBlockedReason(record);
  return [
    { id: 'view', label: 'View transfer' },
    {
      id: 'delete',
      label: 'Delete & reverse',
      sub: blocked ?? 'Puts the stock back in the pool it came from',
      destructive: true,
      disabled: blocked !== null,
    },
  ];
}

// ─── Delete copy ─────────────────────────────────────────────────────────────

/** The backend ErrorCode a refused reversal comes back with. */
export const STOCK_MOVEMENT_LOCKED = 'STOCK_MOVEMENT_LOCKED';

/**
 * What to say when the reversal was refused.
 *
 * ⚠️ `STOCK_MOVEMENT_LOCKED` is the system PROTECTING stock, not a failure, and "Could not delete"
 * frames it as a bug. The sentence has to explain that the moved stock has since been used, so
 * putting it back would take away something that is already gone.
 *
 * The server's own message names the batch and the shortfall, so it is appended rather than
 * discarded — but it is never shown alone, because on its own it reads like an exception.
 */
export function deleteRefusalMessage(
  code: string | null | undefined,
  error: string | null | undefined,
): string {
  if (code === STOCK_MOVEMENT_LOCKED) {
    const detail = (error ?? '').trim();
    const head =
      'This transfer can no longer be reversed — stock from the batch it created has already been used.';
    return detail ? `${head} ${detail}` : head;
  }
  return (error ?? '').trim() || 'Could not delete this transfer';
}

/** The toast after a successful reversal. Says the stock went BACK — a delete here is a reversal. */
export function deleteSuccessMessage(): string {
  return 'Transfer reversed — the stock is back in its original pool';
}
