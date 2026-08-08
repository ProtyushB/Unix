import {
  DEFAULT_FILTERS,
  STOCK_MOVEMENT_LOCKED,
  appliedFilterChips,
  deleteBlockedReason,
  deleteRefusalMessage,
  deleteSuccessMessage,
  deriveStockTransfersView,
  directionLabel,
  hasActiveFilters,
  headerCollapses,
  isDirectionalReason,
  poolLabel,
  quickActionsFor,
  reasonLabel,
  showsFab,
  showsReasonChip,
  sortLabel,
  toQuery,
  type StockTransfersViewInput,
} from './stockTransfer.view';

const base: StockTransfersViewInput = {
  mode: 'browse',
  query: '',
  rowCount: 0,
  loadedOnce: false,
  hasError: false,
  filtered: false,
};

describe('deriveStockTransfersView', () => {
  it('puts ERROR ahead of everything, including a search in progress', () => {
    expect(deriveStockTransfersView({ ...base, hasError: true })).toBe('ERROR');
    expect(
      deriveStockTransfersView({ ...base, hasError: true, mode: 'search', query: 'argan' }),
    ).toBe('ERROR');
  });

  it('does not call a focused-but-empty search box a search', () => {
    expect(deriveStockTransfersView({ ...base, mode: 'search' })).toBe('SEARCH_IDLE');
  });

  it('walks a search from SEARCHING to results or no-results', () => {
    expect(deriveStockTransfersView({ ...base, mode: 'search', query: 'argan' })).toBe('SEARCHING');
    expect(
      deriveStockTransfersView({ ...base, mode: 'search', query: 'argan', loadedOnce: true }),
    ).toBe('NO_RESULTS');
    expect(
      deriveStockTransfersView({
        ...base,
        mode: 'search',
        query: 'argan',
        loadedOnce: true,
        rowCount: 3,
      }),
    ).toBe('SEARCH_RESULTS');
  });

  it('stays LOADING until a request has actually COMPLETED', () => {
    expect(deriveStockTransfersView(base)).toBe('LOADING');
  });

  it('tells "none yet" apart from "none match these filters"', () => {
    expect(deriveStockTransfersView({ ...base, loadedOnce: true })).toBe('EMPTY');
    expect(deriveStockTransfersView({ ...base, loadedOnce: true, filtered: true })).toBe(
      'FILTERED_EMPTY',
    );
  });

  it('separates a filtered list from a plain one even when both have rows', () => {
    expect(deriveStockTransfersView({ ...base, loadedOnce: true, rowCount: 4 })).toBe('MAIN');
    expect(
      deriveStockTransfersView({ ...base, loadedOnce: true, rowCount: 4, filtered: true }),
    ).toBe('FILTERED');
  });
});

describe('headerCollapses', () => {
  it('collapses only where there is a list to scroll', () => {
    expect(headerCollapses('MAIN')).toBe(true);
    expect(headerCollapses('FILTERED')).toBe(true);
    expect(headerCollapses('SEARCH_RESULTS')).toBe(true);
    expect(headerCollapses('EMPTY')).toBe(false);
    expect(headerCollapses('LOADING')).toBe(false);
    expect(headerCollapses('FILTERED_EMPTY')).toBe(false);
  });
});

describe('showsFab', () => {
  it('is hidden wherever a hero CTA already offers Transfer', () => {
    expect(showsFab('EMPTY')).toBe(false);
    expect(showsFab('ERROR')).toBe(false);
    expect(showsFab('NO_RESULTS')).toBe(false);
    expect(showsFab('SEARCH_IDLE')).toBe(false);
  });

  it('shows on a list, and on a filtered-empty one whose hero offers Clear filters instead', () => {
    expect(showsFab('MAIN')).toBe(true);
    expect(showsFab('FILTERED')).toBe(true);
    expect(showsFab('FILTERED_EMPTY')).toBe(true);
  });
});

describe('filters', () => {
  it('starts newest-first and unfiltered', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(DEFAULT_FILTERS.sortDir).toBe('desc');
  });

  it('counts a flipped sort order as narrowing', () => {
    expect(hasActiveFilters({ sortDir: 'asc' })).toBe(true);
  });

  it('sends NO `reason`, because the transfer controller reads none', () => {
    // The difference from consumption and wastage, and the reason `StockTransferQuery` omits the
    // key: `reason` is SORTABLE but not FILTERABLE here. A sheet copied from wastage would grow
    // reason chips that appear to work and silently return the unfiltered list.
    expect(Object.keys(toQuery(DEFAULT_FILTERS))).toEqual(['sortDir']);
  });

  it('sends no direction filter either — sourceType/destType are sortable, not filterable', () => {
    const keys = Object.keys(toQuery(DEFAULT_FILTERS));
    expect(keys).not.toContain('sourceType');
    expect(keys).not.toContain('destType');
  });
});

describe('appliedFilterChips', () => {
  it('draws nothing while the list is in its default order', () => {
    expect(appliedFilterChips(DEFAULT_FILTERS)).toEqual([]);
  });

  it('names the flipped order, because it changes what page 1 is', () => {
    expect(appliedFilterChips({ sortDir: 'asc' })).toEqual([{ id: 'sortDir', label: 'Oldest first' }]);
  });

  it('never grows a reason chip, whatever the filters hold', () => {
    // The whole point of `StockTransferQuery` omitting `reason`: a chip here would look like it
    // worked and return the unfiltered list.
    const labels = [...appliedFilterChips(DEFAULT_FILTERS), ...appliedFilterChips({ sortDir: 'asc' })]
      .map((c) => c.id)
      .join(',');
    expect(labels).not.toMatch(/reason/i);
  });
});

describe('sortLabel', () => {
  it('spells both orders the way the sheet does', () => {
    expect(sortLabel('desc')).toBe('Newest first');
    expect(sortLabel('asc')).toBe('Oldest first');
  });
});

describe('directionLabel', () => {
  it('reads the POOLS, which are the truth about which way the stock went', () => {
    expect(directionLabel('PRODUCT_INVENTORY', 'RAW_INVENTORY')).toBe('Product → Raw');
    expect(directionLabel('RAW_INVENTORY', 'PRODUCT_INVENTORY')).toBe('Raw → Product');
  });

  it('ignores the reason entirely — a contradictory record still shows its real direction', () => {
    // The record below claims PRODUCT_TO_RAW while its pools say the opposite. The server accepts
    // that pairing; a label built from the reason would report the move backwards forever.
    const row = { sourceType: 'RAW_INVENTORY', destType: 'PRODUCT_INVENTORY' } as const;
    expect(directionLabel(row.sourceType, row.destType)).toBe('Raw → Product');
    expect(directionLabel(row.sourceType, row.destType)).not.toBe(reasonLabel('PRODUCT_TO_RAW'));
  });

  it('says nothing at all when either end is missing', () => {
    // Half a direction is worse than none: "Product → Product" is a legal-looking sentence about
    // an illegal move.
    expect(directionLabel(null, 'RAW_INVENTORY')).toBe('');
    expect(directionLabel('RAW_INVENTORY', undefined)).toBe('');
  });

  it('uses the arrow, not the `·` separator, because this is not a quantity', () => {
    expect(directionLabel('PRODUCT_INVENTORY', 'RAW_INVENTORY')).not.toContain('·');
    expect(directionLabel('PRODUCT_INVENTORY', 'RAW_INVENTORY')).not.toContain('+');
  });
});

describe('poolLabel', () => {
  it('shortens both pools the way every mockup does', () => {
    expect(poolLabel('RAW_INVENTORY')).toBe('Raw');
    expect(poolLabel('PRODUCT_INVENTORY')).toBe('Product');
  });
});

describe('reason labels', () => {
  it('renders every member of the server enum', () => {
    expect(reasonLabel('PRODUCT_TO_RAW')).toBe('Product → Raw');
    expect(reasonLabel('RAW_TO_PRODUCT')).toBe('Raw → Product');
    expect(reasonLabel('REBALANCE')).toBe('Rebalance');
    expect(reasonLabel('CORRECTION')).toBe('Correction');
    expect(reasonLabel('OTHER')).toBe('Other');
    expect(reasonLabel(null)).toBe('');
  });

  it('separates the two reasons that NAME a direction from the three that do not', () => {
    expect(isDirectionalReason('PRODUCT_TO_RAW')).toBe(true);
    expect(isDirectionalReason('RAW_TO_PRODUCT')).toBe(true);
    expect(isDirectionalReason('REBALANCE')).toBe(false);
    expect(isDirectionalReason('CORRECTION')).toBe(false);
    expect(isDirectionalReason('OTHER')).toBe(false);
  });

  it('chips ONLY the non-directional reasons on a card', () => {
    // A "Product → Raw" chip beside the card's own "Product → Raw" line says it twice — and says
    // it from the untrusted source, so on a contradictory record the two would disagree.
    expect(showsReasonChip('PRODUCT_TO_RAW')).toBe(false);
    expect(showsReasonChip('RAW_TO_PRODUCT')).toBe(false);
    expect(showsReasonChip('REBALANCE')).toBe(true);
    expect(showsReasonChip('CORRECTION')).toBe(true);
    expect(showsReasonChip('OTHER')).toBe(true);
    expect(showsReasonChip(null)).toBe(false);
  });
});

describe('quickActionsFor', () => {
  it('offers exactly two actions — a transfer is immutable, so no edit and no status change', () => {
    expect(quickActionsFor({ id: 4 }).map((a) => a.id)).toEqual(['view', 'delete']);
  });

  it('labels the delete as the REVERSAL it is', () => {
    const del = quickActionsFor({ id: 4 }).find((a) => a.id === 'delete')!;
    expect(del.label).toBe('Delete & reverse');
    expect(del.destructive).toBe(true);
    expect(del.disabled).toBe(false);
    expect(del.sub).toMatch(/back/i);
  });

  it('disables rather than hides a delete it cannot offer, and says why', () => {
    // `batch.view.ts`'s rule: a missing row reads as a missing feature.
    const del = quickActionsFor({}).find((a) => a.id === 'delete')!;
    expect(del.disabled).toBe(true);
    expect(del.sub).toBe('This transfer has not been saved yet');
  });

  it('does NOT guess at the server-side lock', () => {
    // STOCK_MOVEMENT_LOCKED is not knowable from the DTO — nothing on the record reports it.
    // Guessing "locked" would hide a delete that would have succeeded.
    expect(deleteBlockedReason({ id: 9, lines: [{ sourceBatchId: 1, destBatchId: 2, quantity: 5 }] })).toBeNull();
  });
});

describe('deleteRefusalMessage', () => {
  it('frames a lock as protection rather than as a failure', () => {
    const msg = deleteRefusalMessage(STOCK_MOVEMENT_LOCKED, null);
    expect(msg).toMatch(/already been used/i);
    expect(msg).not.toMatch(/could not delete/i);
  });

  it('keeps the server sentence, which names the batch, but never shows it alone', () => {
    const msg = deleteRefusalMessage(STOCK_MOVEMENT_LOCKED, 'Batch BATCH-260710-02-T1 has 200 ml drawn.');
    expect(msg).toContain('BATCH-260710-02-T1');
    expect(msg).toMatch(/no longer be reversed/i);
  });

  it('falls back to the plain failure for any other code', () => {
    expect(deleteRefusalMessage('SOMETHING_ELSE', 'Server exploded')).toBe('Server exploded');
    expect(deleteRefusalMessage(undefined, null)).toBe('Could not delete this transfer');
  });
});

describe('deleteSuccessMessage', () => {
  it('says the stock went BACK — a delete here is a reversal, not a tidy-up', () => {
    expect(deleteSuccessMessage()).toMatch(/back/i);
  });
});
