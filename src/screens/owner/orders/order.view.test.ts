import { headerCollapses, type OrdersView } from './order.view';

describe('headerCollapses', () => {
  it('lets the header hide on the two populated browse states', () => {
    expect(headerCollapses('MAIN')).toBe(true);
    expect(headerCollapses('FILTERED')).toBe(true);
  });

  // FILTERED_EMPTY is the load-bearing one: it exists precisely so the filter controls stay
  // reachable when a filter emptied the list. Letting the header hide there would undo that.
  it('pins the header everywhere else', () => {
    const pinned: OrdersView[] = [
      'ERROR',
      'SEARCH',
      'NO_RESULTS',
      'LOADING',
      'EMPTY',
      'FILTERED_EMPTY',
    ];
    for (const v of pinned) {
      expect(headerCollapses(v)).toBe(false);
    }
  });
});
