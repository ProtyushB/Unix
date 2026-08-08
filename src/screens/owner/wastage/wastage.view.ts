import type { InventoryType } from '../../../backend/modules/shared/inventory.types';
import type {
  WastageDto,
  WastageQuery,
  WastageReason,
} from '../../../backend/modules/shared/wastage.types';
import { WASTAGE_REASON_CHOICES } from '../../../backend/modules/shared/wastage.types';

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

// ─── Labels ──────────────────────────────────────────────────────────────────

/**
 * "EXPIRED" → "Expired".
 *
 * ⚠️ Resolves ALL EIGHT reasons, `CORRECTION` included, while the chips below offer only seven.
 * That asymmetry is the point: `CORRECTION` is a value the system writes and a record can carry
 * without being a button, so a label function that only knew the chip list would render a blank
 * where an existing record's reason goes. See the two arrays in `wastage.types.ts`.
 *
 * Null reads as an em dash rather than an empty string — a row with no reason still has a slot.
 */
const REASON_LABELS: Record<WastageReason, string> = {
  EXPIRED: 'Expired',
  DAMAGED: 'Damaged',
  SPILLED: 'Spilled',
  CONTAMINATED: 'Contaminated',
  THEFT: 'Theft',
  LOST: 'Lost',
  CORRECTION: 'Correction',
  OTHER: 'Other',
};

export function reasonLabel(reason: WastageReason | null | undefined): string {
  if (!reason) return '—';
  return REASON_LABELS[reason] ?? String(reason);
}

/** "Product" / "Raw" — the per-card pool badge. Empty when the record carries no pool. */
export function poolLabel(type: InventoryType | null | undefined): string {
  if (!type) return '';
  return type === 'RAW_INVENTORY' ? 'Raw' : 'Product';
}

// ─── Reason chips ────────────────────────────────────────────────────────────

/** One chip above the list: an id to filter by and the word drawn on it. */
export interface ReasonChip {
  value: WastageReason | 'ALL';
  label: string;
}

/**
 * The chip row: `All Reasons` and then the SEVEN offerable reasons.
 *
 * ⚠️ Seven, not eight. Built from `WASTAGE_REASON_CHOICES`, which excludes `CORRECTION` — offering
 * it would invite someone reconciling a stock miscount to file it as wastage, and the write-off
 * would absorb an error that was never a loss. `reasonLabel` above still knows all eight so a
 * CORRECTION record reads fine wherever it turns up.
 *
 * No per-chip counts anywhere: no endpoint reports one, and a chip with an invented number is worse
 * than a chip with none.
 */
export const REASON_CHIPS: readonly ReasonChip[] = [
  { value: 'ALL', label: 'All Reasons' },
  ...WASTAGE_REASON_CHOICES.map((r) => ({ value: r, label: reasonLabel(r) })),
];

/**
 * The chips drawn above the list once the sheet has been used — one per axis actually narrowing.
 *
 * Empty when nothing is narrowing, so the caller renders no row at all rather than an empty strip.
 * There is deliberately no pool chip: see `WastageFilters`.
 */
export function appliedFilterChips(f: WastageFilters): string[] {
  const chips: string[] = [];
  if (f.reason !== 'ALL') chips.push(reasonLabel(f.reason));
  if (f.sortDir !== DEFAULT_FILTERS.sortDir) chips.push('Oldest first');
  return chips;
}

/**
 * The card's second line: the timestamp, then the note after a `·` when there is one.
 *
 * `·`, never `+` — the same separator `mixedUnitLabel` and `formatStockedQty` use, so one screen
 * does not join two facts two different ways. Either half may be missing, and a missing half must
 * not leave a dangling separator.
 */
export function cardMetaLine(row: { whenText: string; notesSnippet: string }): string {
  return [row.whenText, row.notesSnippet].filter(Boolean).join(' · ');
}

// ─── Quick actions ───────────────────────────────────────────────────────────

export interface WastageAction {
  id: 'view' | 'delete';
  label: string;
  sub?: string;
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * The long-press sheet's actions.
 *
 * Short, because a wastage is IMMUTABLE: View, and Delete (which restocks). No status change, no
 * edit — the backend has no PUT and there is no lifecycle to move through.
 *
 * Delete is gated on ONE thing and it is not the record: the WASTAGE tab. The endpoint is
 * `@TabGated(WASTAGE)`, so with the tab off it 403s. Nothing about the record itself blocks it —
 * unlike a stock transfer, which locks once its destination batch has been drawn from.
 *
 * Follows `batch.view.ts`'s rule that a blocked action is DISABLED WITH A REASON rather than
 * hidden: an action that silently disappears reads as a bug, and the user has no way to learn that
 * a switch elsewhere is what took it away.
 */
export function quickActionsFor(
  record: WastageDto | null | undefined,
  opts: { wastageEnabled: boolean },
): WastageAction[] {
  const actions: WastageAction[] = [{ id: 'view', label: 'View wastage' }];

  const blocked = record?.id == null ? 'This wastage has not been saved' : null;
  const gated = opts.wastageEnabled ? null : 'The Wastage tab is switched off';

  actions.push({
    id: 'delete',
    label: 'Delete wastage',
    // Says what the delete DOES when it is available — a bare "Delete" hides the thing the user
    // most needs to know, which is that the stock comes back.
    sub: blocked ?? gated ?? 'Restocks what was written off',
    destructive: true,
    disabled: blocked !== null || gated !== null,
  });

  return actions;
}
