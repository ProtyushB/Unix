import type { WastageQuery, WastageReason } from '../../../backend/modules/shared/wastage.types';

/**
 * The Wastage screen's view state machine and its filter mapping.
 *
 * Same shape and reasoning as `batch.view.ts` / `consumption.view.ts`: this is where screens of this
 * kind actually break, and keeping it pure lets plain-node jest cover every branch with no render
 * harness. Nothing here may import React Native — `jest.config.js` only collects `*.test.ts`.
 */

export type WastageView =
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

export interface WastageViewInput {
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
 * FILTERED_EMPTY is the pair that matters. "Nothing written off yet" and "nothing matches Expired"
 * call for completely different screens — one offers Record, the other offers Clear filters — and
 * showing the first-run empty state to a salon with a year of write-offs because they tapped a
 * reason chip is the bug this pair prevents.
 */
export function deriveWastageView(i: WastageViewInput): WastageView {
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
export function headerCollapses(view: WastageView): boolean {
  return view === 'MAIN' || view === 'FILTERED' || view === 'SEARCH_RESULTS';
}

/**
 * The FAB shows wherever there is no hero CTA offering the same thing.
 *
 * Two Record affordances on one screen is what this prevents: the empty state already carries a
 * button, and a floating + beside it reads as a different action.
 */
export function showsFab(view: WastageView): boolean {
  return view === 'MAIN' || view === 'FILTERED' || view === 'FILTERED_EMPTY';
}

// ─── Filters ─────────────────────────────────────────────────────────────────

/**
 * What the sheet can narrow by.
 *
 * `reason` and `sortDir`, and NOTHING ELSE — those are the only axes `/byBusiness` reads beyond
 * `search`.
 *
 * ⚠️ In particular there is no POOL filter, and that is the surprising one: `inventoryType` is on
 * every wastage record, it appears in the SORT whitelist, and it is the obvious thing to want a
 * Product/Raw toggle for — but the controller reads no such query param. A toggle would look like
 * it worked and return the unfiltered list. `sortBy: 'inventoryType'` is the whole of what the
 * server offers on that axis; group by it rather than filtering by it.
 */
export interface WastageFilters {
  reason: WastageReason | 'ALL';
  /** Newest-first is the default everywhere in this app; ascending has to be explicit. */
  sortDir: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: WastageFilters = { reason: 'ALL', sortDir: 'desc' };

/** Whether anything is narrowing the list. Sort order counts — it changes what page 1 is. */
export function hasActiveFilters(f: WastageFilters): boolean {
  return f.reason !== 'ALL' || f.sortDir !== DEFAULT_FILTERS.sortDir;
}

/**
 * Filters → the query the API layer sends.
 *
 * 'ALL' becomes `null` rather than a literal: the server treats an absent param as "no filter" and
 * would reject the string. `compactParams` in the impl then drops the key entirely — a `reason=`
 * with an empty value binds to a blank enum and answers 400.
 */
export function toQuery(f: WastageFilters): WastageQuery {
  return {
    reason: f.reason === 'ALL' ? null : f.reason,
    sortDir: f.sortDir,
  };
}

// FEATURE: `appliedFilterChips(f)` and `reasonLabel(reason)` — "EXPIRED" → "Expired". Both are
// FEATURE: copy, so both belong here where a test can pin them.
//
// FEATURE: ⚠️ Draw the CHIPS from `WASTAGE_REASON_CHOICES` (seven) and resolve LABELS from the full
// FEATURE: `WastageReason` union (eight). `CORRECTION` is a value the system writes and a record can
// FEATURE: carry, but not one a person may pick — see the note in `wastage.types.ts`. A label
// FEATURE: function that only knew the seven would render a blank where an existing record's reason
// FEATURE: goes.

// FEATURE: `quickActionsFor(dto)` — the long-press sheet's actions. A wastage is immutable, so the
// FEATURE: list is short: View, and Delete (which RESTOCKS). No status change and no edit. Model it
// FEATURE: on `quickActionsFor` in `batch.view.ts`, including its rule that a blocked action is
// FEATURE: DISABLED with a reason rather than hidden.
