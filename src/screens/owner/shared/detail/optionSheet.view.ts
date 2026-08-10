import type { SheetOption } from './parts/OptionSheet';

/**
 * The searchable half of `OptionSheet`, kept out of the `.tsx` so jest can cover it — the sheet
 * itself is untestable in this repo (node environment, `.tsx` is never collected).
 *
 * Search is OPT-IN on that sheet. Most callers list four to eight statuses, where a search box is
 * clutter; it exists for the expense category list, which is fifteen.
 */

/**
 * Narrow a sheet's options by a typed query.
 *
 * Matches the LABEL only, not `sub`. A `sub` is an explanation of a consequence ("Deducts from raw
 * batches"), and matching it would surface an option whose own name has nothing to do with what was
 * typed — the user sees a list that looks wrong and cannot tell why. If a caller ever genuinely
 * needs sub-matching it should be its own opt-in flag, not a silent widening of this rule.
 *
 * Case-insensitive substring, trimmed. A blank or whitespace-only query returns the list UNCHANGED
 * (the same array reference), so an untouched search box costs nothing and cannot reorder anything.
 */
export function filterSheetOptions(options: SheetOption[], query: string | null | undefined) {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return options;
  return options.filter((option) => option.label.toLowerCase().includes(q));
}

/**
 * What to say when a search matches nothing.
 *
 * Quotes the query back, because the alternative ("No matches") leaves the user unsure whether the
 * list is empty or their typing was. Curly quotes to match the catalog picker's own empty state.
 */
export function noOptionMatchText(query: string | null | undefined): string {
  const q = (query ?? '').trim();
  return q ? `No match for “${q}”.` : 'Nothing to choose from.';
}
