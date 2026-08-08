import { shouldResumeCatalogPick } from '../../shared/detail/catalogPicker.view';
import type { WastageFormState } from './wastageDetail.model';

/**
 * The Wastage Detail screen's mode/view machine and its validation.
 *
 * Note what is missing: there is **no `'edit'` mode**. A wastage is immutable after creation and the
 * backend has no PUT, so the screen is only ever reading a saved record or composing a new one.
 * Correcting one means deleting it — which RESTOCKS — and recording it again.
 */

export type DetailMode = 'view' | 'add';
export type DetailView = 'LOADING' | 'ERROR' | 'READY' | 'SAVING';

export interface DetailViewInput {
  mode: DetailMode;
  loading: boolean;
  saving: boolean;
  hasError: boolean;
  hasItem: boolean;
}

/**
 * Precedence: saving, then error, then add-is-always-ready, then loading.
 *
 * Add never loads — there is nothing to fetch — so it must not fall through to LOADING and render a
 * spinner over an empty form the user is trying to fill in.
 */
export function deriveDetailView(i: DetailViewInput): DetailView {
  if (i.saving) return 'SAVING';
  if (i.hasError) return 'ERROR';
  if (i.mode === 'add') return 'READY';
  if (i.loading || !i.hasItem) return 'LOADING';
  return 'READY';
}

/** The one place mode becomes "are these fields inputs". */
export function isEditable(mode: DetailMode): boolean {
  return mode === 'add';
}

/** Delete lives on the read screen only. */
export function showsDelete(mode: DetailMode): boolean {
  return mode === 'view';
}

/**
 * There is no Edit affordance anywhere on this screen.
 *
 * Kept as a named function rather than simply omitted, because every sibling detail screen has one
 * and its absence here is a deliberate decision rather than an oversight.
 */
export function showsEditCta(): boolean {
  return false;
}

/** Whether the picker offers "New Product". Only while composing. */
export function showsCreateProduct(mode: DetailMode): boolean {
  return mode === 'add';
}

/**
 * Whether to fetch the product catalog.
 *
 * Add mode only, and only when nothing is held and nothing is in flight. Clearing the held rows is
 * therefore how the screen re-arms this after returning from creating a product.
 */
export function shouldLoadCatalog(input: {
  mode: DetailMode;
  hasRows: boolean;
  loading: boolean;
}): boolean {
  return input.mode === 'add' && !input.hasRows && !input.loading;
}

/**
 * On regaining focus: do we reopen the picker because we left it to create a product?
 *
 * Delegates to the shared rule — four screens ask the same question, and four copies of it would be
 * four chances to drift.
 */
export function shouldResumeProductPick(input: {
  awaitingProduct: boolean;
  isFirstFocus: boolean;
}): boolean {
  return shouldResumeCatalogPick({
    awaiting: input.awaitingProduct,
    isFirstFocus: input.isFirstFocus,
  });
}

/**
 * The Product/Raw explainer under the pool segmented control.
 *
 * Wastage is the only one of the three features that asks the user which pool to write off from,
 * and the two are not interchangeable: one is stock you sell, the other is stock you use up. Same
 * copy as the batch form's `typeDescription`, deliberately — the pools mean the same thing there.
 */
export function poolDescription(type: string): string {
  return type === 'RAW_INVENTORY'
    ? 'Consumable stock — used during services.'
    : 'Sellable stock — decremented on orders.';
}

// FEATURE: `appBarTitle(mode, record)` and `appBarSubtitle(mode)` — copy, so they belong here where
// FEATURE: a test can pin them. See `batchDetail.view.ts` for the shape.

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationErrors = Record<string, string>;

/**
 * FEATURE: the create rules.
 *
 * Deliberately EMPTY rather than half-written — a validator that passes some checks reads as
 * complete and is trusted. What has to go in, and why each one is worth catching on the client:
 *
 *   • `itemId` — "Pick a product". Nothing else on the form means anything without it.
 *   • `inventoryType` — must be set. There is no defensible default: the same product can hold
 *     stock in both pools, and writing off the sellable one when the user meant the consumable one
 *     is a silent loss of real stock.
 *   • quantity — at least one unit row above zero. `deriveUnitLinesPayload` returns null for an
 *     empty entry, and that null is the signal; do not post a zero.
 *   • quantity ≤ available stock IN THE CHOSEN POOL. Switching the pool changes the ceiling, so
 *     this check has to re-run on that field too, not only on the quantity.
 *   • `reason` — must satisfy `isWastageReason`. The service guards this too, and that guard is the
 *     last line rather than the first: a bad enum is an HTTP 500 with nothing readable in it.
 *     ⚠️ Validate against the full eight-member union, not the seven chips — a form seeded from an
 *     existing CORRECTION record would otherwise fail its own validation.
 *   • `reportedAt` — not in the future, compared as `YYYY-MM-DD` against **IST** today
 *     (`todayIst()`), because that is the day the server evaluates against.
 *
 * Mirror `validateBatch` in `batchDetail.view.ts`, including its habit of returning a message that
 * names the field rather than a generic one.
 */
export function validateWastage(_form: WastageFormState): ValidationErrors {
  return {};
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The first error, for a toast when the offending field is scrolled out of sight. */
export function errorSummary(errors: ValidationErrors): string | null {
  const keys = Object.keys(errors);
  return keys.length ? errors[keys[0]] : null;
}
