import type { WastageReason } from '../../../../backend/modules/shared/wastage.types';
import { isWastageReason } from '../../../../backend/modules/shared/wastage.types';
import { shouldResumeCatalogPick } from '../../shared/detail/catalogPicker.view';
import type { BatchBreakdownRow, WastageFormState } from './wastageDetail.model';

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

/**
 * The line under the picker's search box.
 *
 * Names the pool it is showing, because the picker's stock column is only truthful for one of them
 * — see `showsPickerStock`. The board draws the Product-pool wording; the Raw one exists so the
 * sentence never describes a figure that is not on screen.
 */
export function pickerHelper(type: string): string {
  return type === 'RAW_INVENTORY'
    ? 'Showing stock in the Raw pool'
    : 'Showing stock in the Product pool';
}

/**
 * Whether the picker draws a stock figure at all.
 *
 * PRODUCT only, and this is a real limitation rather than a preference: the catalog list carries
 * `availableQuantity`, which is the SELLABLE figure, and there is no per-product raw figure on it.
 * Showing the sellable number while the form is set to Raw would promise stock the save cannot
 * draw — the exact thing that makes a picker untrustworthy — and fetching a raw total per row would
 * be one request per product in the catalog.
 *
 * So on the Raw pool the rows simply carry no stock slot and no zero-disable, which is how the
 * three shipped pickers already render. The Available line on the form still reports the real Raw
 * figure once a product is chosen, because that one is a single request.
 */
export function showsPickerStock(type: string): boolean {
  return type !== 'RAW_INVENTORY';
}

// ─── App bar ─────────────────────────────────────────────────────────────────

/** "Record Wastage" while composing; the product's own name once saved. */
export function appBarTitle(mode: DetailMode, itemName: string): string {
  return mode === 'add' ? 'Record Wastage' : itemName || 'Wastage';
}

/** "Write off stock" under the title while composing. Nothing in view mode. */
export function appBarSubtitle(mode: DetailMode): string {
  return mode === 'add' ? 'Write off stock' : '';
}

/** The form's one CTA. Named for what it does, not "Save". */
export function saveCtaLabel(): string {
  return 'Record wastage';
}

/**
 * The read screen's one destructive action.
 *
 * "Delete & restock", not "Delete": the restock is the consequence a user cannot undo by mistake
 * and cannot discover from the word Delete. It is stated on the button, in the confirm dialog, and
 * again in the sentence under the button.
 */
export function deleteCtaLabel(): string {
  return 'Delete & restock';
}

// ─── Notes ───────────────────────────────────────────────────────────────────

/**
 * Whether a note is compulsory.
 *
 * Only for `OTHER`, and it is the whole point of that chip: "Other" on its own records that
 * something was lost and nothing about what, which makes the row unauditable. Every other reason is
 * self-describing, so a note there stays optional.
 *
 * Takes the reason rather than the whole form so the label and the validator cannot disagree.
 */
export function notesRequired(reason: WastageReason | null | undefined): boolean {
  return reason === 'OTHER';
}

/** "Notes" / "Notes *" — the asterisk appears exactly when `notesRequired` says it should. */
export function notesLabel(reason: WastageReason | null | undefined): string {
  return notesRequired(reason) ? 'Notes (required)' : 'Notes';
}

// ─── The batch ledger ────────────────────────────────────────────────────────

/**
 * "Deducted oldest-first across 2 batches" — the caption above the breakdown table.
 *
 * Says "oldest-first" because that is the server's rule and the user did not choose any of these
 * batches: the form asked for a product, a pool and a quantity, and the ledger below is the answer
 * to "so where did it actually come from?".
 *
 * Empty at zero rows, so the caller draws no card rather than a caption over nothing.
 */
export function batchBreakdownCaption(count: number): string {
  if (count <= 0) return '';
  return `Deducted oldest-first across ${count} ${count === 1 ? 'batch' : 'batches'}`;
}

/**
 * "Restocks 400 ml to BATCH-260620-04 and 200 ml to BATCH-260715-11."
 *
 * Sits under Delete & restock and is the reason that button is not called Delete. Built from the
 * same ledger the breakdown table draws, so the promise and the table can never disagree.
 *
 * Empty when there is no ledger — a record whose deductions were not enriched cannot promise
 * anything specific, and a vague "restocks the stock" adds nothing to the button's own label.
 */
export function restockSentence(rows: BatchBreakdownRow[]): string {
  if (!rows.length) return '';
  const parts = rows.map((r) => `${r.qtyText} to ${r.batchLabel}`);
  if (parts.length === 1) return `Restocks ${parts[0]}.`;
  const last = parts[parts.length - 1];
  return `Restocks ${parts.slice(0, -1).join(', ')} and ${last}.`;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationErrors = Record<string, string>;

/** Everything the validator needs beyond the form itself. */
export interface WastageValidationContext {
  /**
   * The batch the write-off would start from — `pickWriteOffBatch`'s answer for the chosen product
   * AND pool. Null means there is no ACTIVE stock in that pool, which is a refusal rather than a
   * quantity problem.
   */
  batchId: number | null;
  /** Stock on hand IN THE CHOSEN POOL, in base units. Null = not known yet, which is not zero. */
  availableBaseQty: number | null;
  /** What the rows add up to, in base units — `enteredBaseQty(form)`. */
  enteredBaseQty: number;
}

/**
 * The create rules, mirroring `validateBatch`'s habit of naming the field rather than the form.
 *
 * Every one of these is also enforced somewhere behind the client, and every one is caught here
 * anyway, because the server's version of the refusal is worse to read:
 *
 *   • `itemId` — nothing else on the form means anything without a product.
 *   • pool — has no defensible default, so the *consequence* of the choice is what gets checked:
 *     with a product and a pool chosen and no `batchId` resolved, the pool the user is looking at
 *     holds no active stock. Writing off the sellable pool when they meant the consumable one is a
 *     silent loss of real stock, so this refuses rather than falling back to the other pool.
 *   • quantity — at least one row above zero, and no more than the pool actually holds. The ceiling
 *     moves when the POOL changes, not only when the quantity does, which is why the available
 *     figure is a parameter rather than something read off the form.
 *   • `reason` — must satisfy `isWastageReason`. ⚠️ The full EIGHT-member union, not the seven
 *     chips: a form seeded from an existing CORRECTION record would otherwise fail its own
 *     validation. The service guards this too and that guard is the last line, not the first — a
 *     bad enum reaching Spring is an HTTP 500 with nothing readable in it.
 *   • `notes` — required when the reason is OTHER; see `notesRequired`.
 *
 * There is deliberately NO `reportedAt` rule. The form collects no date (the server stamps it), and
 * unlike consumption's `consumedAt` the server runs no date validation on this column either — so a
 * future-date check here would guard a field that cannot be set and a rule that does not exist.
 */
export function validateWastage(
  form: WastageFormState,
  ctx: WastageValidationContext,
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (form.itemId == null) errors.itemId = 'Pick a product';

  if (!isWastageReason(form.reason)) errors.reason = 'Pick a reason';

  if (!(ctx.enteredBaseQty > 0)) {
    errors.quantity = 'Enter a quantity';
  } else if (ctx.availableBaseQty !== null && ctx.enteredBaseQty > ctx.availableBaseQty) {
    errors.quantity = `Only ${ctx.availableBaseQty} available in this pool`;
  }

  // Checked after the quantity so a blank form leads with "Pick a product" / "Enter a quantity"
  // rather than with a pool complaint about a product nobody has chosen yet.
  if (form.itemId != null && ctx.batchId == null) {
    errors.inventoryType = 'No active stock in this pool — check the Inventory Type';
  }

  if (notesRequired(form.reason) && !form.notes.trim()) {
    errors.notes = 'Say what happened';
  }

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
