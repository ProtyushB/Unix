import type { InventoryType } from '../../../../backend/modules/shared/inventory.types';
import type { StockTransferReason } from '../../../../backend/modules/shared/stockTransfer.types';
import { shouldResumeCatalogPick } from '../../shared/detail/catalogPicker.view';
import type { StockTransferFormState } from './stockTransferDetail.model';

/**
 * The Stock Transfer Detail screen's mode/view machine and its validation.
 *
 * Note what is missing: there is **no `'edit'` mode**. A transfer is immutable after creation and
 * the backend has no PUT, so the screen is only ever reading a saved record or composing a new one.
 * Correcting one means deleting it — which REVERSES the move, and which the server refuses once the
 * destination batch has been drawn from — and recording it again.
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

// ─── Direction ───────────────────────────────────────────────────────────────

/**
 * The other pool. A transfer is ALWAYS cross-pool — same-to-same is refused server-side — so the
 * destination is a function of the source and never a second free choice.
 */
export function oppositePool(source: InventoryType): InventoryType {
  return source === 'RAW_INVENTORY' ? 'PRODUCT_INVENTORY' : 'RAW_INVENTORY';
}

/**
 * The reason implied by a direction.
 *
 * ⚠️ Derived, never picked alongside the pools. `PRODUCT_TO_RAW` with `sourceType:
 * 'RAW_INVENTORY'` is ACCEPTED by the server and is a lie in the audit log — nothing rejects it, and
 * every later read of that record reports the move backwards. `sourceType`/`destType` are the truth;
 * the reason is a label on top of them.
 *
 * The three non-directional reasons (REBALANCE, CORRECTION, OTHER) are a separate axis: a form that
 * offers them must still set the pools independently, and must not let the pair contradict itself.
 * `directionalReason` is what a form should call when the user has only chosen a direction.
 */
export function directionalReason(source: InventoryType, dest: InventoryType): StockTransferReason {
  if (source === 'PRODUCT_INVENTORY' && dest === 'RAW_INVENTORY') return 'PRODUCT_TO_RAW';
  if (source === 'RAW_INVENTORY' && dest === 'PRODUCT_INVENTORY') return 'RAW_TO_PRODUCT';
  // A same-pool pair has no direction to name. OTHER rather than a throw: the validator is what
  // refuses the save, and a label function is the wrong place to crash.
  return 'OTHER';
}

/**
 * Whether the two ends are a legal pair.
 *
 * The rule the server enforces and the one thing a direction control must not allow: a transfer
 * moves stock BETWEEN the pools, so Product→Product moves nothing and is rejected.
 */
export function isCrossPool(source: InventoryType, dest: InventoryType): boolean {
  return source !== dest;
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
 *   • `sourceType !== destType` — use `isCrossPool`. A same-pool transfer moves nothing and the
 *     server refuses it.
 *   • quantity — at least one unit row above zero. `deriveUnitLinesPayload` returns null for an
 *     empty entry, and that null is the signal; do not post a zero.
 *   • quantity ≤ available stock IN THE SOURCE POOL. Flipping the direction changes the ceiling, so
 *     this check has to re-run on that field too, not only on the quantity.
 *   • `reason` — must satisfy `isStockTransferReason`. The service guards this too, and that guard
 *     is the last line rather than the first: a bad enum is an HTTP 500 with nothing readable in it.
 *   • the reason must not CONTRADICT the pools — see `directionalReason`. Nothing server-side
 *     catches this, and the lie survives in the audit log forever.
 *   • `transferredAt` — not in the future, compared as `YYYY-MM-DD` against **IST** today
 *     (`todayIst()`), because that is the day the server evaluates against.
 *
 * Mirror `validateBatch` in `batchDetail.view.ts`, including its habit of returning a message that
 * names the field rather than a generic one.
 */
export function validateStockTransfer(_form: StockTransferFormState): ValidationErrors {
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
