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

// ─── The stock slot ──────────────────────────────────────────────────────────
//
// Added for the three stock-movement pickers (consumption, wastage, stock transfer), whose mockups
// show a stock figure and a breakdown of it on every row. Purely ADDITIVE: the three shipped
// callers — batch, order and appointment detail — pass no `stock` and no `disabled`, so every
// function here answers "nothing to draw" for them and their rows are byte-identical to before.
//
// `price` was NOT displaced by any of this. The updated mockups show name · brand · type · PRICE on
// the left and the stock figure on the right; they are two slots, not one slot with two owners.

/** The stock figure on a picker row: a total plus, when there is one, the level it breaks into. */
export interface CatalogStock {
  /** Base units, formatted — "1,530 g". */
  total: string;
  /** The same figure in the stock-in level — "3 tubs · 30 g". Absent when it would just repeat. */
  breakdown?: string | null;
}

/**
 * What the row's trailing column draws, or null when it draws nothing.
 *
 * The precedence is the point, and it is one line: a `disabledNote` REPLACES the breakdown. A row
 * at zero has a breakdown of "0 tubs", which is true, useless, and takes the place of the sentence
 * that actually explains why the row cannot be tapped ("no raw stock"). The note is the more useful
 * of the two, so it wins whenever it exists.
 *
 * Null in, null out — that is what keeps the three shipped callers unchanged.
 */
export function stockTrailing(row: {
  stock?: CatalogStock | null;
  disabledNote?: string | null;
}): { total: string; sub: string | null } | null {
  if (!row?.stock) return null;
  return { total: row.stock.total, sub: row.disabledNote || row.stock.breakdown || null };
}

/**
 * Whether the row is inert.
 *
 * Two independent reasons, and they mean different things to a reader: `alreadyAdded` says "you
 * already have this", `disabled` says "there is nothing here to take". Both make the row untappable,
 * which is why they are folded into one answer here rather than checked separately in the JSX.
 *
 * The shipped callers pass no `disabled`, so this reduces to the `alreadyAdded` check that was
 * already there.
 */
export function rowDisabled(input: { disabled?: boolean; alreadyAdded: boolean }): boolean {
  return input.alreadyAdded || input.disabled === true;
}

/**
 * The tint on the stock figure: red at zero, otherwise the success green the mockups use.
 *
 * Keyed off `disabled` rather than off parsing the total string — the caller knows whether the
 * number it formatted was zero, and re-deriving that from "0 ml" would break the moment a locale
 * formats it differently.
 */
export function stockTone(input: { disabled?: boolean }): 'success' | 'error' {
  return input.disabled === true ? 'error' : 'success';
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
