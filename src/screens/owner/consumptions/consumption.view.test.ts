import { CONSUMPTION_REASONS } from '../../../backend/modules/shared/consumption.types';
import {
  DEFAULT_FILTERS,
  appliedFilterChips,
  deleteBlockedReason,
  deriveConsumptionsView,
  hasActiveFilters,
  headerCollapses,
  quickActionsFor,
  reasonChoices,
  reasonLabel,
  showsFab,
  toQuery,
  type ConsumptionsViewInput,
} from './consumption.view';

const base: ConsumptionsViewInput = {
  mode: 'browse',
  query: '',
  rowCount: 0,
  loadedOnce: false,
  hasError: false,
  filtered: false,
};

describe('deriveConsumptionsView', () => {
  it('puts ERROR ahead of everything, including a search in progress', () => {
    expect(deriveConsumptionsView({ ...base, hasError: true })).toBe('ERROR');
    expect(
      deriveConsumptionsView({ ...base, hasError: true, mode: 'search', query: 'argan' }),
    ).toBe('ERROR');
  });

  it('does not call a focused-but-empty search box a search', () => {
    // "0 results for ''" is the thing this prevents.
    expect(deriveConsumptionsView({ ...base, mode: 'search' })).toBe('SEARCH_IDLE');
  });

  it('walks a search from SEARCHING to results or no-results', () => {
    expect(deriveConsumptionsView({ ...base, mode: 'search', query: 'argan' })).toBe('SEARCHING');
    expect(
      deriveConsumptionsView({ ...base, mode: 'search', query: 'argan', loadedOnce: true }),
    ).toBe('NO_RESULTS');
    expect(
      deriveConsumptionsView({
        ...base,
        mode: 'search',
        query: 'argan',
        loadedOnce: true,
        rowCount: 3,
      }),
    ).toBe('SEARCH_RESULTS');
  });

  it('stays LOADING until a request has actually COMPLETED', () => {
    // Not `!loading`: that flag is false on the very first render, so a plain negation marks the
    // screen loaded before any request exists and flashes the empty hero at a busy salon.
    expect(deriveConsumptionsView(base)).toBe('LOADING');
  });

  it('tells "none yet" apart from "none match these filters"', () => {
    // The pair that stops a salon with 400 records seeing "No consumptions yet" because they tapped
    // a reason chip. One screen offers Record, the other offers Clear filters.
    expect(deriveConsumptionsView({ ...base, loadedOnce: true })).toBe('EMPTY');
    expect(deriveConsumptionsView({ ...base, loadedOnce: true, filtered: true })).toBe(
      'FILTERED_EMPTY',
    );
  });

  it('separates a filtered list from a plain one even when both have rows', () => {
    expect(deriveConsumptionsView({ ...base, loadedOnce: true, rowCount: 4 })).toBe('MAIN');
    expect(deriveConsumptionsView({ ...base, loadedOnce: true, rowCount: 4, filtered: true })).toBe(
      'FILTERED',
    );
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
  it('is hidden wherever a hero CTA already offers Record', () => {
    // Two Record affordances on one screen read as two different actions.
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
  it('starts unfiltered and newest-first', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(DEFAULT_FILTERS.sortDir).toBe('desc');
  });

  it('counts a reason and a flipped sort order as narrowing', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, reason: 'TRAINING' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sortDir: 'asc' })).toBe(true);
  });

  it('sends null rather than the string "ALL"', () => {
    // The server reads an absent param as "no filter" and rejects the literal. `compactParams` then
    // drops the key entirely — `reason=` binds to a blank enum and answers 400.
    expect(toQuery(DEFAULT_FILTERS).reason).toBeNull();
    expect(toQuery({ reason: 'SERVICE_USE', sortDir: 'desc' }).reason).toBe('SERVICE_USE');
  });

  it('carries the sort direction through', () => {
    expect(toQuery({ reason: 'ALL', sortDir: 'asc' }).sortDir).toBe('asc');
  });
});

describe('reasonLabel', () => {
  it('uses the mockup word, which two of the six do not title-case into', () => {
    // The tripwire against a generic `split('_').map(titleCase)`: that produces "Internal Use" and
    // "Sampling", which is a different chip row from the one the board draws.
    expect(reasonLabel('INTERNAL_USE')).toBe('Internal');
    expect(reasonLabel('SAMPLING')).toBe('Sample');
  });

  it('labels the other four and the filter head', () => {
    expect(reasonLabel('SERVICE_USE')).toBe('Service Use');
    expect(reasonLabel('TRAINING')).toBe('Training');
    expect(reasonLabel('TESTING')).toBe('Testing');
    expect(reasonLabel('OTHER')).toBe('Other');
    expect(reasonLabel('ALL')).toBe('All Reasons');
  });

  it('never renders a blank chip for a missing reason', () => {
    expect(reasonLabel(null)).toBe('Other');
    expect(reasonLabel(undefined)).toBe('Other');
  });

  it('has a word for EVERY member of the enum — no chip may render as undefined', () => {
    for (const reason of CONSUMPTION_REASONS) {
      expect(reasonLabel(reason)).toBeTruthy();
      expect(reasonLabel(reason)).not.toMatch(/_/);
    }
  });
});

describe('reasonChoices', () => {
  it('offers all six plus the head — consumption hides none, unlike wastage', () => {
    expect(reasonChoices()).toEqual(['ALL', ...CONSUMPTION_REASONS]);
    expect(reasonChoices()).toHaveLength(7);
  });
});

describe('appliedFilterChips', () => {
  it('draws nothing while the defaults are in force', () => {
    expect(appliedFilterChips(DEFAULT_FILTERS)).toEqual([]);
  });

  it('names the reason with the same word the chip row uses', () => {
    expect(appliedFilterChips({ reason: 'SAMPLING', sortDir: 'desc' })).toEqual([
      { id: 'reason', label: 'Sample' },
    ]);
  });

  it('gives the flipped sort order a chip of its own', () => {
    // `hasActiveFilters` already counts sort as narrowing. A subtitle that says "filtered" with no
    // chip to clear leaves the user hunting for what changed.
    expect(appliedFilterChips({ reason: 'ALL', sortDir: 'asc' })).toEqual([
      { id: 'sort', label: 'Oldest first' },
    ]);
    expect(appliedFilterChips({ reason: 'TRAINING', sortDir: 'asc' })).toHaveLength(2);
  });
});

describe('quickActionsFor', () => {
  it('offers View and Delete, in that order, and nothing else', () => {
    // A consumption is immutable: no status change, no edit. Either would only ever 404.
    expect(quickActionsFor({ id: 5 }).map((a) => a.id)).toEqual(['view', 'delete']);
  });

  it('says out loud that Delete restocks', () => {
    const del = quickActionsFor({ id: 5 }).find((a) => a.id === 'delete');
    expect(del?.label).toBe('Delete & restock');
    expect(del?.sub).toMatch(/returns/i);
    expect(del?.destructive).toBe(true);
    expect(del?.disabled).toBe(false);
  });

  it('DISABLES a blocked Delete rather than hiding it, with the reason underneath', () => {
    const del = quickActionsFor(null).find((a) => a.id === 'delete');
    expect(del).toBeDefined();
    expect(del?.disabled).toBe(true);
    expect(del?.sub).toBe('This consumption is not available.');
  });
});

describe('deleteBlockedReason', () => {
  it('blocks ONLY on a missing id — the server guards this endpoint with nothing at all', () => {
    // No immutability window, no billed check, not even a tab gate. Any other condition invented
    // here would be a client-side refusal the server would have honoured.
    expect(deleteBlockedReason({ id: 5 })).toBeNull();
    expect(deleteBlockedReason({ id: 5, reason: 'TRAINING' })).toBeNull();
    expect(deleteBlockedReason({ id: 5, consumedAt: '2020-01-01T00:00:00' })).toBeNull();
    expect(deleteBlockedReason({})).toBe('This consumption is not available.');
    expect(deleteBlockedReason(null)).toBe('This consumption is not available.');
  });
});
