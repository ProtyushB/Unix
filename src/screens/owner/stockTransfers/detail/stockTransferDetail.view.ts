import type { InventoryType } from '../../../../backend/modules/shared/inventory.types';
import type {
  StockTransferDto,
  StockTransferReason,
} from '../../../../backend/modules/shared/stockTransfer.types';
import { isStockTransferReason } from '../../../../backend/modules/shared/stockTransfer.types';
// No `todayIst` import, unlike both siblings: there is no date rule here. See `validateStockTransfer`.
import { shouldResumeCatalogPick } from '../../shared/detail/catalogPicker.view';
import {
  deriveUnitLinesPayload,
  recordQtyLabel,
  unitLinesBaseQty,
} from '../../inventory/batchUnits';
import { poolLabel } from '../stockTransfer.view';
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

/**
 * Whether picking this reason should also move the pools.
 *
 * The two directional reasons ARE a direction, so choosing one has to set the pair — otherwise the
 * user picks "Raw → Product" on a Product → Raw form and the record ships a reason that contradicts
 * its own pools, which the server accepts and nothing later can detect. The three non-directional
 * ones say something the pools cannot, so they leave the direction alone.
 *
 * Returns all three fields together for the same reason `setDirection` does: they are one decision.
 */
export function reasonSelection(
  reason: StockTransferReason,
  currentSource: InventoryType,
): { sourceType: InventoryType; destType: InventoryType; reason: StockTransferReason } {
  if (reason === 'PRODUCT_TO_RAW') {
    return { sourceType: 'PRODUCT_INVENTORY', destType: 'RAW_INVENTORY', reason };
  }
  if (reason === 'RAW_TO_PRODUCT') {
    return { sourceType: 'RAW_INVENTORY', destType: 'PRODUCT_INVENTORY', reason };
  }
  return { sourceType: currentSource, destType: oppositePool(currentSource), reason };
}

// ─── App bar ─────────────────────────────────────────────────────────────────

/** "Transfer Stock" while composing; the product's name once saved. See `batchDetail.view.ts`. */
export function appBarTitle(mode: DetailMode, record: StockTransferDto | null): string {
  if (mode === 'add') return 'Transfer Stock';
  return record?.itemName?.trim() || 'Transfer';
}

export function appBarSubtitle(mode: DetailMode): string {
  return mode === 'add' ? 'Move stock between pools' : '';
}

/** The Reason field's helper, which is the whole explanation of why it is pre-filled. */
export function reasonHelper(): string {
  return 'Auto-set from direction — tap to override';
}

/** The summary line under the two pool selectors: "Moving  Product → Raw". */
export function movingSummary(source: InventoryType, dest: InventoryType): string {
  return `${poolLabel(source)} → ${poolLabel(dest)}`;
}

/**
 * The read screen's headline figure, split so the number can be drawn large and its unit small.
 *
 * "700 ml" becomes `{ amount: '700', unitText: 'ml moved' }`. Split rather than styled as one
 * string because the mockup sets the figure at three times the unit's size — merged, it can only be
 * one size, and the number stops being the thing the eye lands on.
 *
 * Reads through `recordQtyLabel`, so a record that was saved against a level renders "2 bottles
 * moved" rather than restating a base total nobody typed. A record with no quantity reads "—",
 * never "0" — those are different claims.
 */
export function movedHeadline(
  record: StockTransferDto | null,
  baseUnit = 'unit',
): { amount: string; unitText: string } {
  const label = recordQtyLabel(
    {
      quantity: record?.quantity,
      unitName: record?.unitName,
      // Almost always null on the way back — the server discards what it was sent.
      unitLines: record?.unitLines,
    },
    baseUnit,
  );
  const [amount, ...rest] = label.split(' ');
  return { amount, unitText: rest.length ? `${rest.join(' ')} moved` : 'moved' };
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationErrors = Record<string, string>;

export interface ValidateOptions {
  /**
   * Stock on hand IN THE SOURCE POOL, in base units. Null means "not known yet" — NOT zero — and
   * skips the ceiling check rather than refusing every quantity.
   */
  availableBaseQty?: number | null;
  /** The product's base unit name, so the over-draw message names what it counted. */
  baseUnit?: string;
  /**
   * The batch the transfer would start from, resolved from the source pool — the field the POST is
   * addressed by.
   *
   * ⚠️ `undefined` means "the caller is not checking this" and skips the rule; `null` means "we
   * looked in the source pool and there is nothing to draw from", which is a refusal. The two must
   * not be collapsed: defaulting an unresolved lookup to null would refuse every save on a form
   * whose pool has not answered yet.
   */
  sourceBatchId?: number | null;
}

/**
 * The create rules, mirroring what the server enforces and what it silently does not.
 *
 * Two of these have no server counterpart at all and are the reason this function is worth reading:
 *
 *   • the reason must not CONTRADICT the pools. `PRODUCT_TO_RAW` alongside
 *     `sourceType: 'RAW_INVENTORY'` is ACCEPTED, and the lie survives in the audit log forever.
 *   • a bad enum is an HTTP **500**, not a 400 — so `isStockTransferReason` is checked here as well
 *     as in the service, because by the time the service throws the user has already waited.
 *
 * The ceiling check and the BATCH lookup both re-run on the DIRECTION, not only on the quantity:
 * flipping the direction swaps which pool is the source, and with it both how much there is to move
 * and which batch the move would start from.
 *
 * There is no date rule here, unlike both siblings — see the note at the end of the function.
 */
export function validateStockTransfer(
  form: StockTransferFormState,
  options: ValidateOptions = {},
): ValidationErrors {
  const { availableBaseQty = null, baseUnit = 'unit' } = options;
  const errors: ValidationErrors = {};

  if (form.itemId == null) errors.itemId = 'Pick a product';

  if (!isCrossPool(form.sourceType, form.destType)) {
    // A same-pool transfer moves nothing, and the server refuses it.
    errors.sourceType = 'Source and destination must be different pools';
  }

  /*
    No batch to start from.

    Only asked once a product is chosen — before that "Pick a product" is the useful complaint and
    two errors would just be noise. `undefined` means the caller is not checking; `null` means the
    source pool was looked in and holds nothing drawable.

    Worth catching here rather than letting the server answer: the payload is addressed by
    `sourceBatchId`, so without one the request fails bean validation with a 400 naming a field this
    form never showed anyone — there is no batch picker to send the user back to. The message names
    the thing they CAN change, which is the direction or the product.
  */
  if (form.itemId != null && options.sourceBatchId === null) {
    errors.itemId = `No stock to move from the ${poolLabel(form.sourceType)} pool for this product`;
  }

  // `deriveUnitLinesPayload` returns null for an entry that is blank or all zeroes, and THAT null is
  // the signal — a zero-quantity movement means nothing and is accepted by nobody.
  const entered = deriveUnitLinesPayload(form.unitRows);
  if (!entered) {
    errors.quantity = 'Enter a quantity';
  } else if (availableBaseQty !== null && availableBaseQty !== undefined) {
    const wanted = unitLinesBaseQty(form.unitRows);
    if (wanted > availableBaseQty) {
      errors.quantity = `Only ${availableBaseQty} ${baseUnit} available in the ${poolLabel(
        form.sourceType,
      )} pool`;
    }
  }

  if (!isStockTransferReason(form.reason)) {
    errors.reason = 'Pick a valid transfer reason';
  } else if (
    (form.reason === 'PRODUCT_TO_RAW' || form.reason === 'RAW_TO_PRODUCT') &&
    form.reason !== directionalReason(form.sourceType, form.destType)
  ) {
    errors.reason = `Reason says ${form.reason === 'PRODUCT_TO_RAW' ? 'Product → Raw' : 'Raw → Product'}, but the stock moves the other way`;
  }

  /*
    There is deliberately NO `transferredAt` rule, and its absence is worth a note because both
    sibling features have one.

    `StockTransferPayload` has no such key — the controller ignores the field and stamps the row
    itself — so the value cannot travel, the form offers no date input, and `form.transferredAt` is
    `''` on every code path that reaches this function. A future-date check here would be a rule that
    can never fire, which reads as live protection and is not. It was removed rather than left in
    when the payload was corrected; if the endpoint ever grows the field, add the input and the rule
    back together.
  */

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The first error, for a toast when the offending field is scrolled out of sight. */
export function errorSummary(errors: ValidationErrors): string | null {
  const keys = Object.keys(errors);
  return keys.length ? errors[keys[0]] : null;
}
