import type {
  ConsumptionQuery,
  ConsumptionReason,
} from '../../../backend/modules/shared/consumption.types';

/**
 * The Consumptions screen's view state machine and its filter mapping.
 *
 * Same shape and reasoning as `batch.view.ts` / `order.view.ts`: this is where screens of this kind
 * actually break, and keeping it pure lets plain-node jest cover every branch with no render
 * harness. Nothing here may import React Native — `jest.config.js` only collects `*.test.ts`.
 */

export type ConsumptionsView =
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

export interface ConsumptionsViewInput {
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
 * FILTERED_EMPTY is the pair that matters. "No consumptions yet" and "nothing matches Training"
 * call for completely different screens — one offers Record, the other offers Clear filters — and
 * showing the first-run empty state to a salon with 400 records because they tapped a reason chip
 * is the bug this pair prevents.
 */
export function deriveConsumptionsView(i: ConsumptionsViewInput): ConsumptionsView {
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
export function headerCollapses(view: ConsumptionsView): boolean {
  return view === 'MAIN' || view === 'FILTERED' || view === 'SEARCH_RESULTS';
}

/**
 * The FAB shows wherever there is no hero CTA offering the same thing.
 *
 * Two Record affordances on one screen is what this prevents: the empty state already carries a
 * button, and a floating + beside it reads as a different action.
 */
export function showsFab(view: ConsumptionsView): boolean {
  return view === 'MAIN' || view === 'FILTERED' || view === 'FILTERED_EMPTY';
}

// ─── Filters ─────────────────────────────────────────────────────────────────

/**
 * What the sheet can narrow by.
 *
 * `reason` and `sortDir` and NOTHING ELSE, because those are the only axes `/byBusiness` reads
 * beyond `search`. There is no date window, no status and no pool: a consumption always draws from
 * RAW, and the endpoint accepts no date params. A chip for an axis the server ignores looks like it
 * works and silently returns the unfiltered list.
 */
export interface ConsumptionFilters {
  reason: ConsumptionReason | 'ALL';
  /** Newest-first is the default everywhere in this app; ascending has to be explicit. */
  sortDir: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: ConsumptionFilters = { reason: 'ALL', sortDir: 'desc' };

/** Whether anything is narrowing the list. Sort order is a filter here — it changes what page 1 is. */
export function hasActiveFilters(f: ConsumptionFilters): boolean {
  return f.reason !== 'ALL' || f.sortDir !== DEFAULT_FILTERS.sortDir;
}

/**
 * Filters → the query the API layer sends.
 *
 * 'ALL' becomes `null` rather than a literal: the server treats an absent param as "no filter" and
 * would reject the string. `compactParams` in the impl then drops the key entirely — a `reason=`
 * with an empty value binds to a blank enum and answers 400.
 */
export function toQuery(f: ConsumptionFilters): ConsumptionQuery {
  return {
    reason: f.reason === 'ALL' ? null : f.reason,
    sortDir: f.sortDir,
  };
}

// FEATURE: `appliedFilterChips(f)` — the chips drawn above the list once the sheet has been used,
// FEATURE: and `reasonLabel(reason)` — "SERVICE_USE" → "Service use". Both are copy, so both belong
// FEATURE: here rather than in the `.tsx`, and both want a test. Render the chip list from
// FEATURE: `CONSUMPTION_REASONS` (all six are offered; there is no hidden member the way wastage
// FEATURE: has one).

// FEATURE: `quickActionsFor(dto)` — the long-press sheet's actions, in the mockup's order. A
// FEATURE: consumption is immutable, so the list is short: View, and Delete (which RESTOCKS). There
// FEATURE: is no status change and no edit. Model it on `quickActionsFor` in `batch.view.ts`,
// FEATURE: including its rule that a blocked action is DISABLED with a reason rather than hidden.
