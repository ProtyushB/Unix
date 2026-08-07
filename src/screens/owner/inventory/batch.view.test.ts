import {
  DEFAULT_FILTERS,
  appliedFilterChips,
  canDeleteBatch,
  canDispose,
  deleteBlockedReason,
  deriveInventoryView,
  hasActiveFilters,
  headerCollapses,
  quickActionsFor,
  showsFab,
  statusLabel,
  toQuery,
  transitionLabel,
  type InventoryViewInput,
} from './batch.view';
import type { BatchDto } from './batch.model';
import type { InventoryStatus } from '../../../backend/modules/shared/inventory.types';

const v = (over: Partial<InventoryViewInput> = {}): InventoryViewInput => ({
  mode: 'browse',
  query: '',
  rowCount: 3,
  loadedOnce: true,
  hasError: false,
  filtered: false,
  ...over,
});

const batch = (over: Partial<BatchDto> = {}): BatchDto => ({
  id: 1,
  status: 'ACTIVE',
  purchasedQuantity: 50,
  remainingQuantity: 12,
  firstUsedAt: null,
  source: null,
  ...over,
});

describe('deriveInventoryView', () => {
  it('lets an error win over everything else', () => {
    // An empty list from a request that never returned is not "no batches yet".
    expect(deriveInventoryView(v({ hasError: true, rowCount: 0 }))).toBe('ERROR');
    expect(deriveInventoryView(v({ hasError: true, mode: 'search', query: 'x' }))).toBe('ERROR');
  });

  it('does not call a focused-but-empty search box a search', () => {
    expect(deriveInventoryView(v({ mode: 'search', query: '' }))).toBe('SEARCH_IDLE');
  });

  it('walks the search branch', () => {
    expect(deriveInventoryView(v({ mode: 'search', query: 'a', loadedOnce: false }))).toBe(
      'SEARCHING',
    );
    expect(deriveInventoryView(v({ mode: 'search', query: 'a', rowCount: 2 }))).toBe(
      'SEARCH_RESULTS',
    );
    expect(deriveInventoryView(v({ mode: 'search', query: 'a', rowCount: 0 }))).toBe('NO_RESULTS');
  });

  it('loads before it judges emptiness', () => {
    expect(deriveInventoryView(v({ loadedOnce: false, rowCount: 0 }))).toBe('LOADING');
  });

  it('tells "no batches at all" apart from "none match this filter"', () => {
    // The whole reason this pair exists: one offers Add, the other offers Clear filters. Showing
    // the first-run empty state to a business with 128 batches is the bug being prevented.
    expect(deriveInventoryView(v({ rowCount: 0, filtered: false }))).toBe('EMPTY');
    expect(deriveInventoryView(v({ rowCount: 0, filtered: true }))).toBe('FILTERED_EMPTY');
    expect(deriveInventoryView(v({ rowCount: 4, filtered: true }))).toBe('FILTERED');
    expect(deriveInventoryView(v({ rowCount: 4, filtered: false }))).toBe('MAIN');
  });
});

describe('headerCollapses / showsFab', () => {
  it('collapses the header only where there is a list to scroll', () => {
    expect(headerCollapses('MAIN')).toBe(true);
    expect(headerCollapses('FILTERED')).toBe(true);
    expect(headerCollapses('SEARCH_RESULTS')).toBe(true);
    expect(headerCollapses('EMPTY')).toBe(false);
    expect(headerCollapses('LOADING')).toBe(false);
  });

  it('hides the FAB exactly where the hero already offers Add', () => {
    // Two Add affordances on one screen read as two different actions.
    expect(showsFab('EMPTY')).toBe(false);
    expect(showsFab('ERROR')).toBe(false);
    expect(showsFab('NO_RESULTS')).toBe(false);
    expect(showsFab('MAIN')).toBe(true);
    // Filtered-empty has no Add hero — it offers Clear filters — so the FAB stays.
    expect(showsFab('FILTERED_EMPTY')).toBe(true);
  });
});

describe('canDeleteBatch', () => {
  it('allows deleting an untouched, manually-added batch', () => {
    expect(canDeleteBatch(batch())).toBe(true);
  });

  it('blocks once stock has been drawn, even if it was all returned', () => {
    // firstUsedAt is monotonic on purpose: sell then cancel restores the quantity, but the batch
    // has been in play and its history must not be erasable.
    expect(canDeleteBatch(batch({ firstUsedAt: '2026-08-01T10:00:00Z' }))).toBe(false);
    expect(
      canDeleteBatch(
        batch({
          firstUsedAt: '2026-08-01T10:00:00Z',
          remainingQuantity: 50,
          purchasedQuantity: 50,
        }),
      ),
    ).toBe(false);
  });

  it('blocks system-minted batches regardless of use', () => {
    // A client checking only firstUsedAt would offer Delete here and eat a 400.
    expect(canDeleteBatch(batch({ source: 'COMBO_BREAK' }))).toBe(false);
    expect(canDeleteBatch(batch({ source: 'STOCK_TRANSFER' }))).toBe(false);
  });

  it('is false for a missing batch rather than throwing', () => {
    expect(canDeleteBatch(null)).toBe(false);
    expect(canDeleteBatch(undefined)).toBe(false);
  });
});

describe('deleteBlockedReason', () => {
  it('is null when deletion is actually allowed', () => {
    expect(deleteBlockedReason(batch())).toBeNull();
  });

  it('explains WHICH rule blocked it', () => {
    expect(deleteBlockedReason(batch({ firstUsedAt: '2026-08-01T00:00:00Z' }))).toContain(
      'drawn from',
    );
    expect(deleteBlockedReason(batch({ source: 'COMBO_BREAK' }))).toContain('System-generated');
  });
});

describe('canDispose', () => {
  it('needs an EXPIRED batch with stock left', () => {
    expect(canDispose(batch({ status: 'EXPIRED', remainingQuantity: 9 }), true)).toBe(true);
    // The server refuses these, so offering them could only ever produce an error.
    expect(canDispose(batch({ status: 'ACTIVE', remainingQuantity: 9 }), true)).toBe(false);
    expect(canDispose(batch({ status: 'EXPIRED', remainingQuantity: 0 }), true)).toBe(false);
  });

  it('needs the WASTAGE tab, which is a DIFFERENT tab from INVENTORY', () => {
    // Inventory-on with Wastage-off is legal, and there dispose could only ever 403.
    expect(canDispose(batch({ status: 'EXPIRED', remainingQuantity: 9 }), false)).toBe(false);
  });
});

describe('quickActionsFor', () => {
  it('always offers status change and detail', () => {
    const ids = quickActionsFor(batch(), { wastageEnabled: true }).map((a) => a.id);
    expect(ids).toContain('status');
    expect(ids).toContain('view');
  });

  it('offers status as ONE entry, not one row per target', () => {
    // Targets come from allowedTransitions and are unknown until it resolves; listing them up
    // front would sometimes offer a move the server refuses.
    const status = quickActionsFor(batch(), { wastageEnabled: true }).filter(
      (a) => a.id === 'status',
    );
    expect(status).toHaveLength(1);
  });

  it('includes Dispose only when it would succeed', () => {
    const expired = batch({ status: 'EXPIRED', remainingQuantity: 9 });
    expect(quickActionsFor(expired, { wastageEnabled: true }).map((a) => a.id)).toContain(
      'dispose',
    );
    expect(quickActionsFor(expired, { wastageEnabled: false }).map((a) => a.id)).not.toContain(
      'dispose',
    );
    expect(quickActionsFor(batch(), { wastageEnabled: true }).map((a) => a.id)).not.toContain(
      'dispose',
    );
  });

  it('shows Delete DISABLED with a reason rather than hiding it', () => {
    // A missing row reads as a missing feature; a disabled one teaches why this batch is protected.
    const used = quickActionsFor(batch({ firstUsedAt: '2026-08-01T00:00:00Z' }), {
      wastageEnabled: true,
    });
    const del = used.find((a) => a.id === 'delete');
    expect(del).toBeDefined();
    expect(del?.disabled).toBe(true);
    expect(del?.sub).toContain('drawn from');

    const fresh = quickActionsFor(batch(), { wastageEnabled: true }).find((a) => a.id === 'delete');
    expect(fresh?.disabled).toBe(false);
  });
});

describe('filters', () => {
  it('defaults to the Product pool with nothing narrowing it', () => {
    expect(DEFAULT_FILTERS).toEqual({ status: 'ALL', type: 'PRODUCT_INVENTORY', expiry: 'ANY' });
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it('does not count the type toggle as a filter — it is which pool you are in', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, type: 'RAW_INVENTORY' })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, status: 'ON_HOLD' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, expiry: 'EXPIRING_30' })).toBe(true);
  });

  it('sends null, not "ALL"/"ANY", so the server sees an absent param', () => {
    // A literal 'ALL' binds to a blank enum server-side and 400s.
    expect(toQuery(DEFAULT_FILTERS)).toEqual({
      inventoryType: 'PRODUCT_INVENTORY',
      status: null,
      expiringWithinDays: null,
      expiredOnly: null,
    });
  });

  it('maps the expiry choices onto the two server params', () => {
    expect(toQuery({ ...DEFAULT_FILTERS, expiry: 'EXPIRING_30' })).toMatchObject({
      expiringWithinDays: 30,
      expiredOnly: null,
    });
    expect(toQuery({ ...DEFAULT_FILTERS, expiry: 'EXPIRED' })).toMatchObject({
      expiringWithinDays: null,
      expiredOnly: true,
    });
  });

  it('summarises only what is actually narrowing the list', () => {
    expect(appliedFilterChips(DEFAULT_FILTERS)).toEqual([]);
    expect(appliedFilterChips({ ...DEFAULT_FILTERS, type: 'RAW_INVENTORY' })).toEqual([]);
    expect(
      appliedFilterChips({ status: 'ON_HOLD', type: 'PRODUCT_INVENTORY', expiry: 'EXPIRING_30' }),
    ).toEqual([
      { id: 'status', label: 'On Hold' },
      { id: 'expiry', label: 'Expiring ≤30d' },
    ]);
  });
});

describe('statusLabel', () => {
  it('title-cases the underscored server value', () => {
    // The theme keys on the RAW value; only the label is prettified.
    expect(statusLabel('ON_HOLD')).toBe('On Hold');
    expect(statusLabel('QUARANTINED')).toBe('Quarantined');
    expect(statusLabel('ALL')).toBe('All');
  });
});

describe('transitionLabel', () => {
  it('reads as the action, not as the state', () => {
    // A button sitting under "Current: Active" that says "On Hold" reads as a second status
    // display. The imperative is what makes it legible as something to press.
    expect(transitionLabel('ON_HOLD')).toBe('Put on hold');
    expect(transitionLabel('QUARANTINED')).toBe('Quarantine');
    expect(transitionLabel('ACTIVE')).toBe('Make active');
    expect(transitionLabel('EXPIRED')).toBe('Mark expired');
    expect(transitionLabel('DEPLETED')).toBe('Mark depleted');
  });

  it('differs from the pill label for every status it renames', () => {
    // Pins the two apart: if someone "simplifies" this back to statusLabel, this fails.
    expect(transitionLabel('ON_HOLD')).not.toBe(statusLabel('ON_HOLD'));
    expect(transitionLabel('QUARANTINED')).not.toBe(statusLabel('QUARANTINED'));
  });

  it('still labels a status the app does not know about', () => {
    // A server that grows a new status should get a pressable button, not a blank one.
    expect(transitionLabel('SOMETHING_NEW' as InventoryStatus)).toBe('Something New');
  });
});
