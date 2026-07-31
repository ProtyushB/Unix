/**
 * Pure view-state helpers for the Orders screen.
 *
 * Orders still derives its `view` inline in the screen, unlike Appointments, whose whole state
 * machine lives in `appointment.view.ts` with tests behind it. Extracting the rest is the obvious
 * follow-up; this module exists so that at least the new scroll behaviour is not another untested
 * conditional buried in a 1300-line component.
 */

export type OrdersView =
  | 'ERROR'
  | 'SEARCH'
  | 'NO_RESULTS'
  | 'LOADING'
  | 'EMPTY'
  | 'FILTERED_EMPTY'
  | 'FILTERED'
  | 'MAIN';

/**
 * Whether the header may auto-hide on scroll.
 *
 * Only the two populated browse states. Search pins its own field so the query stays editable
 * without scrolling back to the top, and the hero states have nothing to scroll under the header
 * anyway — hiding it there would leave the user with no search box and no filter chips, which is
 * the exact trap that `FILTERED_EMPTY` was introduced to avoid.
 */
export function headerCollapses(view: OrdersView): boolean {
  return view === 'MAIN' || view === 'FILTERED';
}
