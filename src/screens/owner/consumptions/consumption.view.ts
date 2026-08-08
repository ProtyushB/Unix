import {
  CONSUMPTION_REASONS,
  type ConsumptionDto,
  type ConsumptionQuery,
  type ConsumptionReason,
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

// ─── Reason copy ─────────────────────────────────────────────────────────────

/**
 * The chip word for a reason, taken off the mockup rather than derived from the enum.
 *
 * ⚠️ A lookup, and it has to be: two of the six cannot be produced by title-casing their constant.
 * `INTERNAL_USE` reads "Internal" and `SAMPLING` reads "Sample" on the board — a generic
 * `split('_').map(titleCase)` would render "Internal Use" and "Sampling", which is a different chip
 * row from the one the design shows. The enum is the wire value; this is the word.
 *
 * 'ALL' is included because the filter row's head chip is drawn from the same function — a second
 * literal for it in the `.tsx` is a second place for the wording to drift.
 */
const REASON_LABELS: Record<ConsumptionReason | 'ALL', string> = {
  ALL: 'All Reasons',
  SERVICE_USE: 'Service Use',
  INTERNAL_USE: 'Internal',
  TRAINING: 'Training',
  SAMPLING: 'Sample',
  TESTING: 'Testing',
  OTHER: 'Other',
};

/** "SERVICE_USE" → "Service Use". Unknown values fall back to the raw string, never to a blank. */
export function reasonLabel(reason: ConsumptionReason | 'ALL' | null | undefined): string {
  if (!reason) return REASON_LABELS.OTHER;
  return REASON_LABELS[reason] ?? String(reason);
}

/**
 * The tint a reason chip carries. Not a colour — a palette ROLE the `.tsx` resolves.
 *
 * Only SERVICE_USE is accented. It is the reason behind almost every record, so tinting all six
 * would make the accent mean "this is a consumption" rather than "this one is the ordinary case",
 * and a list where every chip is coloured has no signal left in the colour.
 */
export type ReasonTone = 'accent' | 'info' | 'muted';

export function reasonTone(reason: ConsumptionReason | null | undefined): ReasonTone {
  if (reason === 'SERVICE_USE') return 'accent';
  if (reason === 'INTERNAL_USE' || reason === 'TRAINING') return 'info';
  return 'muted';
}

/** Every chip the reason row draws, head included. Ordered as `CONSUMPTION_REASONS` orders them. */
export function reasonChoices(): (ConsumptionReason | 'ALL')[] {
  return ['ALL', ...CONSUMPTION_REASONS];
}

/**
 * The chips shown above the list once the sheet has been used.
 *
 * Sort order earns a chip because `hasActiveFilters` already counts it as narrowing — a screen that
 * says "Filtered" in its subtitle and then shows no chip to clear leaves the user hunting for what
 * changed.
 */
export function appliedFilterChips(f: ConsumptionFilters): { id: string; label: string }[] {
  const chips: { id: string; label: string }[] = [];
  if (f.reason !== 'ALL') chips.push({ id: 'reason', label: reasonLabel(f.reason) });
  if (f.sortDir === 'asc') chips.push({ id: 'sort', label: 'Oldest first' });
  return chips;
}

// ─── Quick actions ───────────────────────────────────────────────────────────

export type ConsumptionActionId = 'view' | 'delete';

export interface ConsumptionAction {
  id: ConsumptionActionId;
  label: string;
  /** Second line under the label, for the action whose consequence needs saying out loud. */
  sub?: string;
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * Why Delete is unavailable, or null when it is allowed.
 *
 * ⚠️ There is exactly ONE reason, and it is not a business rule: the row has no id to delete. The
 * consumption controller has **no guard on DELETE at all** — no immutability window, no "already
 * billed", not even a tab gate — so any condition invented here would be a client-side refusal the
 * server would have honoured. Inventory's `deleteBlockedReason` mirrors a real backend guard; this
 * one deliberately mirrors nothing.
 */
export function deleteBlockedReason(record: ConsumptionDto | null | undefined): string | null {
  if (!record || record.id == null) return 'This consumption is not available.';
  return null;
}

/**
 * The long-press sheet's actions, in the mockup's order.
 *
 * Short because a consumption is IMMUTABLE: there is no status to change and no edit to offer, so
 * the sheet is View and Delete. Delete is included even when blocked, DISABLED with its reason —
 * `batch.view.ts`'s rule, and for its reason: a missing row reads as a missing feature, a disabled
 * one with a sentence under it teaches why.
 */
export function quickActionsFor(record: ConsumptionDto | null | undefined): ConsumptionAction[] {
  const blocked = deleteBlockedReason(record);
  return [
    { id: 'view', label: 'View consumption' },
    {
      id: 'delete',
      label: 'Delete & restock',
      // The one sentence that must survive a copy edit: deleting puts the stock back.
      sub: blocked ?? 'Returns the quantity to its source batches',
      destructive: true,
      disabled: blocked !== null,
    },
  ];
}
