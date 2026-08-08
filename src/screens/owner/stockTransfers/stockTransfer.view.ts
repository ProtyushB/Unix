import type { StockTransferQuery } from '../../../backend/modules/shared/stockTransfer.types';

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

// FEATURE: `appliedFilterChips(f)`, `reasonLabel(reason)` — "PRODUCT_TO_RAW" → "Product → Raw" —
// FEATURE: and `directionLabel(sourceType, destType)`. All three are copy, so all three belong here
// FEATURE: where a test can pin them.
//
// FEATURE: ⚠️ The direction the row SHOWS must come from `sourceType`/`destType`, not from `reason`.
// FEATURE: `PRODUCT_TO_RAW` with `sourceType: 'RAW_INVENTORY'` is accepted by the server and is a
// FEATURE: lie in the audit log; the two pools are the truth and the reason is a label on top.

// FEATURE: `quickActionsFor(dto)` — the long-press sheet's actions. A transfer is immutable, so the
// FEATURE: list is short: View, and Delete (which REVERSES the move). No status change and no edit.
// FEATURE: ⚠️ Delete can be REFUSED with a 409 / `STOCK_MOVEMENT_LOCKED` once the destination batch
// FEATURE: has been drawn from — reversing it would take back stock that has already been sold or
// FEATURE: consumed. Follow `batch.view.ts`'s rule: render the row DISABLED with that reason rather
// FEATURE: than hiding it, because a missing row reads as a missing feature.
