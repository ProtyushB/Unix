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

// ─── Multi-select mechanics ──────────────────────────────────────────────────

/**
 * Add or remove one id, preserving the order they were ticked in.
 *
 * `serviceDetail.model.ts` has its own `toggleProductId` doing the same thing. Deliberately not
 * imported across feature folders — this one belongs to the shared sheet and that one to the
 * service form, and coupling them would mean a change for one had to be safe for the other.
 */
export function togglePick(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/**
 * The ticks that are still real, dropping any that were committed while the user was elsewhere.
 *
 * Matters because the selection now outlives the sheet: someone can tick three products, leave to
 * create a fourth, and come back to find one of the three already on the record. Without this the
 * footer would promise "Add 3" while `onAdd` handed over a row the caller then ignores as a
 * duplicate — a count that lies by one.
 */
export function activePicks(picked: number[], alreadyAdded: number[]): number[] {
  if (!alreadyAdded.length) return picked;
  const added = new Set(alreadyAdded);
  return picked.filter((id) => !added.has(id));
}

// ─── The create round trip ───────────────────────────────────────────────────

/**
 * Whether it is time to push the create screen.
 *
 * The push waits for the sheet to be DOWN. A native stack push that lands while the picker Modal
 * is still mounted goes underneath it, leaving the user looking at the picker with an invisible
 * screen behind. Taking a plain boolean rather than the sheet state itself keeps this usable from
 * screens that spell "closed" differently — `null` on one, `'none'` on the others.
 */
export function shouldStartCreateNav(input: {
  pendingCreate: boolean;
  sheetOpen: boolean;
}): boolean {
  return input.pendingCreate && !input.sheetOpen;
}

/**
 * On regaining focus: reopen the picker because we left it to create something?
 *
 * The first-focus skip is the app-wide convention — a screen fires focus once on mount, and acting
 * on that would reopen the picker over a form nobody has touched.
 */
export function shouldResumeCatalogPick(input: {
  awaiting: boolean;
  isFirstFocus: boolean;
}): boolean {
  return input.awaiting && !input.isFirstFocus;
}
