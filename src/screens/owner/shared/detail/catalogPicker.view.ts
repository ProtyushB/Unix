/**
 * The catalog picker's "create a new one" affordance.
 *
 * Lives out here rather than inside `parts/CatalogPickerSheet.tsx` because jest only collects
 * `src/**\/*.test.ts` — a rule decided inside a `.tsx` cannot be tested at all.
 */

/**
 * Whether to draw the pill.
 *
 * The gate is the presence of the callback and nothing else — no permission check, no feature
 * flag. That is deliberately the same gate Centrix uses on its shared `ProductPickerField`
 * (`onCreateProduct`), where exactly one of four call sites passes it. A picker that cannot
 * usefully create its own resource simply does not hand one over, and the decision stays with the
 * caller that knows where "new" would land.
 */
export function showsCreateNew(onCreateNew?: (() => void) | null): boolean {
  return typeof onCreateNew === 'function';
}

/** "product" → "Product". Only the first letter; the rest is left as the caller wrote it. */
function titleCase(noun: string): string {
  const n = noun.trim();
  if (!n) return '';
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/**
 * "New Product" — the pill's visible label, built from the sheet's own `noun`.
 *
 * Derived rather than passed so a second caller cannot label its pill something different from
 * its footer button, which is built from the same noun. Title case matches this screen: its heading
 * is "Select Product", not "Select product".
 *
 * Empty noun falls back to a bare "New" rather than rendering "New " with a trailing space.
 */
export function createNewLabel(noun: string): string {
  const n = titleCase(noun);
  return n ? `New ${n}` : 'New';
}

/**
 * "Create new product" — what a screen reader announces.
 *
 * Distinct from the label on purpose. The back chevron announces `Close select product`, and two
 * controls in the same 36pt-tall bar that both start with the word the user is listening for are
 * hard to tell apart by ear; the verb up front separates them.
 */
export function createNewA11yLabel(noun: string): string {
  const n = noun.trim().toLowerCase();
  return n ? `Create new ${n}` : 'Create new';
}
