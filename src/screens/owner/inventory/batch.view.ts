import type { InventoryStatus } from '../../../backend/modules/shared/inventory.types';
import type { BatchDto } from './batch.model';

/**
 * The Inventory screen's view state machine and its action gates.
 *
 * Same shape and reasoning as `product.view.ts` / `order.view.ts`: this is where screens of this
 * kind actually break, and keeping it pure lets plain-node jest cover every branch with no render
 * harness. Nothing here may import React Native — `jest.config.js` only collects `*.test.ts`.
 */

export type InventoryView =
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

export interface InventoryViewInput {
  mode: 'browse' | 'search';
  query: string;
  rowCount: number;
  /** True once a request has COMPLETED at least once — never a plain `!loading`. */
  loadedOnce: boolean;
  hasError: boolean;
  /** True when any filter is narrowing the list (status, expiry, or a non-default type). */
  filtered: boolean;
}

/**
 * Precedence: error, then search, then first-load, then filtered, then browse.
 *
 * FILTERED_EMPTY exists — unlike on Products — because a status chip genuinely can empty the list.
 * "No batches yet" and "no batches match On Hold" call for completely different screens: one offers
 * Add, the other offers Clear filters. Showing the first-run empty state to a business with 128
 * batches because they tapped Quarantined is the bug this pair prevents.
 */
export function deriveInventoryView(i: InventoryViewInput): InventoryView {
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
export function headerCollapses(view: InventoryView): boolean {
  return view === 'MAIN' || view === 'FILTERED' || view === 'SEARCH_RESULTS';
}

/**
 * The FAB shows wherever there is no hero CTA offering the same thing.
 *
 * Two Add affordances on one screen is the specific thing this prevents: the empty state already
 * carries an "Add Batch" button, and a floating + beside it reads as a different action.
 */
export function showsFab(view: InventoryView): boolean {
  return view === 'MAIN' || view === 'FILTERED' || view === 'FILTERED_EMPTY';
}

// ─── Action gates ────────────────────────────────────────────────────────────

/**
 * A batch can be deleted only while UNTOUCHED.
 *
 * Three conditions, mirroring the backend guard exactly — a client that only checked `firstUsedAt`
 * would offer Delete on a combo-break batch and eat a 400.
 *
 * `firstUsedAt` rather than a quantity comparison because it is monotonic: sell from a batch then
 * cancel the order and the stock comes back, so `remaining === purchased` again — but the batch has
 * been in play and its history must not be erasable.
 */
export function canDeleteBatch(batch: BatchDto | null | undefined): boolean {
  if (!batch) return false;
  return !batch.firstUsedAt && batch.source !== 'COMBO_BREAK' && batch.source !== 'STOCK_TRANSFER';
}

/** Why Delete is disabled, for the tooltip. Null when it is actually allowed. */
export function deleteBlockedReason(batch: BatchDto | null | undefined): string | null {
  if (!batch) return 'This batch is not available.';
  if (canDeleteBatch(batch)) return null;
  if (batch.firstUsedAt) {
    return 'Stock has been drawn from this batch, so it can no longer be deleted.';
  }
  return 'System-generated batches (combo break / stock transfer) cannot be deleted — record a wastage or change the status instead.';
}

/**
 * Dispose writes off what is left of an EXPIRED batch.
 *
 * Two independent gates, and both matter:
 *
 *  - the SERVER refuses anything that is not EXPIRED with stock remaining, so offering it
 *    elsewhere would only ever produce an error;
 *  - it POSTs to the WASTAGE controller, which is `@TabGated(WASTAGE)`. Inventory-on with
 *    Wastage-off is a legal configuration, and there the action could only ever 403 — so the tab
 *    hides the button rather than letting the user find out by tapping it.
 */
export function canDispose(batch: BatchDto | null | undefined, wastageEnabled: boolean): boolean {
  if (!batch || !wastageEnabled) return false;
  return batch.status === 'EXPIRED' && Number(batch.remainingQuantity ?? 0) > 0;
}

// ─── Quick actions ───────────────────────────────────────────────────────────

export type BatchActionId = 'view' | 'status' | 'dispose' | 'delete';

export interface BatchAction {
  id: BatchActionId;
  label: string;
  /** Second line under the label, for the actions whose availability needs explaining. */
  sub?: string;
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * The long-press sheet's actions, in the mockup's order.
 *
 * Status change is offered as a single entry rather than one row per target: the targets come from
 * `GET /{id}/allowedTransitions` and are not known until that resolves, so listing "Put on hold"
 * and "Quarantine" up front would sometimes offer a move the server refuses.
 *
 * Delete is included but DISABLED when blocked, rather than hidden. A missing row reads as a
 * missing feature; a disabled one with a reason teaches why this particular batch is protected.
 */
export function quickActionsFor(
  batch: BatchDto | null | undefined,
  opts: { wastageEnabled: boolean },
): BatchAction[] {
  const actions: BatchAction[] = [
    { id: 'status', label: 'Change status' },
    { id: 'view', label: 'View batch detail' },
  ];

  if (canDispose(batch, opts.wastageEnabled)) {
    actions.push({
      id: 'dispose',
      label: 'Dispose · write off remaining',
      sub: 'Expired batches with stock only',
      destructive: true,
    });
  }

  const blocked = deleteBlockedReason(batch);
  actions.push({
    id: 'delete',
    label: 'Delete batch',
    sub: blocked ?? 'Untouched batches only',
    destructive: true,
    disabled: blocked !== null,
  });

  return actions;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export type ExpiryFilter = 'ANY' | 'EXPIRING_30' | 'EXPIRED';

export interface InventoryFilters {
  status: InventoryStatus | 'ALL';
  /** No 'ALL': the list shows exactly one pool at a time, as the mockup's toggle draws it. */
  type: 'PRODUCT_INVENTORY' | 'RAW_INVENTORY';
  expiry: ExpiryFilter;
}

export const DEFAULT_FILTERS: InventoryFilters = {
  status: 'ALL',
  type: 'PRODUCT_INVENTORY',
  expiry: 'ANY',
};

/** Whether anything is narrowing the list. The type toggle is NOT a filter — it is the pool. */
export function hasActiveFilters(f: InventoryFilters): boolean {
  return f.status !== 'ALL' || f.expiry !== 'ANY';
}

/**
 * Filters → the query the API layer sends.
 *
 * 'ALL' and 'ANY' become `null` rather than a literal, because the server treats an absent param as
 * "no filter" and would reject the string.
 */
export function toQuery(f: InventoryFilters): {
  inventoryType: InventoryFilters['type'];
  status: InventoryStatus | null;
  expiringWithinDays: number | null;
  expiredOnly: boolean | null;
} {
  return {
    inventoryType: f.type,
    status: f.status === 'ALL' ? null : f.status,
    expiringWithinDays: f.expiry === 'EXPIRING_30' ? 30 : null,
    expiredOnly: f.expiry === 'EXPIRED' ? true : null,
  };
}

/** The chips shown above the list once the sheet has been used. */
export function appliedFilterChips(f: InventoryFilters): { id: string; label: string }[] {
  const chips: { id: string; label: string }[] = [];
  if (f.status !== 'ALL') chips.push({ id: 'status', label: statusLabel(f.status) });
  if (f.expiry === 'EXPIRING_30') chips.push({ id: 'expiry', label: 'Expiring ≤30d' });
  if (f.expiry === 'EXPIRED') chips.push({ id: 'expiry', label: 'Expired' });
  return chips;
}

/** "ON_HOLD" → "On Hold". The theme keys on the raw value; only the label is title-cased. */
export function statusLabel(status: InventoryStatus | 'ALL'): string {
  if (status === 'ALL') return 'All';
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * The label on a "change status to" BUTTON: "Put on hold", not "On Hold".
 *
 * Deliberately not `statusLabel`. That one names a state, which is right on a pill and on a filter
 * chip — both of which describe what a batch IS. A button describes what pressing it DOES, and a
 * button reading "On Hold" next to a "Current: Active" pill reads as a second status display
 * rather than an action. The mockup's wording is the imperative for exactly this reason.
 *
 * Unknown targets fall back to the state name — a server that grows a new status should still get
 * a pressable button rather than a blank one.
 */
export function transitionLabel(status: InventoryStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Make active';
    case 'ON_HOLD':
      return 'Put on hold';
    case 'QUARANTINED':
      return 'Quarantine';
    case 'EXPIRED':
      return 'Mark expired';
    case 'DEPLETED':
      return 'Mark depleted';
    default:
      return statusLabel(status);
  }
}
