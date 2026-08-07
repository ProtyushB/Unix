import { todayIst } from '../../../../utils/dateRange';
import { shouldResumeCatalogPick } from '../../shared/detail/catalogPicker.view';
import type { BatchFormState } from './batchDetail.model';

/**
 * The Batch Detail screen's mode/view machine and its validation.
 *
 * Note what is missing: there is **no `'edit'` mode**. Batches are immutable after creation and the
 * backend has no PUT, so the screen is only ever reading a saved batch or composing a new one. The
 * product/order screens' third mode has no counterpart here, and adding one would produce a form
 * whose Save could only 404.
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
 * Add never loads — there is nothing to fetch — so it must not fall through to LOADING and render
 * a spinner over an empty form the user is trying to fill in.
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

export function appBarTitle(mode: DetailMode, batchNumber: string): string {
  return mode === 'add' ? 'Add Batch' : batchNumber || 'Batch';
}

export function appBarSubtitle(mode: DetailMode): string {
  return mode === 'add' ? 'New inventory batch' : '';
}

/** Delete lives on the read screen only, and only for a batch that has one. */
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

/**
 * Whether the picker offers "New Product".
 *
 * Only while composing a batch. In view mode the picker is unreachable anyway, but the rule is
 * stated here beside its siblings rather than left implicit in JSX — that is the whole point of
 * this mode machine.
 */
export function showsCreateProduct(mode: DetailMode): boolean {
  return mode === 'add';
}

/**
 * Whether to fetch the product catalog.
 *
 * Add mode only, and only when nothing is held and nothing is in flight. Clearing the held rows is
 * therefore how the screen re-arms this after returning from creating a product — without a
 * refetch the user would come back to a picker that does not list the thing they just made, which
 * is the one outcome that would make the whole affordance pointless.
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
 * The first-focus skip is the app-wide convention (ProductsScreen and its three siblings do the
 * same) — a screen fires focus once on mount, and acting on that would fight the mount-time fetch
 * instead of resuming anything.
 */
export function shouldResumeProductPick(input: {
  awaitingProduct: boolean;
  isFirstFocus: boolean;
}): boolean {
  // Delegates now that Orders and Appointments do the same thing — the rule is one rule, and
  // three copies of it would be three chances to drift.
  return shouldResumeCatalogPick({
    awaiting: input.awaitingProduct,
    isFirstFocus: input.isFirstFocus,
  });
}

/** The Product/Raw explainer under the segmented control. */
export function typeDescription(type: string): string {
  return type === 'RAW_INVENTORY'
    ? 'Consumable stock — used during services.'
    : 'Sellable stock — decremented on orders.';
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationErrors = Record<string, string>;

/**
 * Mirrors `InventoryMapper`'s create rules, which THROW server-side.
 *
 * Duplicated on the client deliberately: the server's failure is a raw 400 with an exception
 * message, so catching these here is the difference between an inline field error and an opaque
 * red banner. If the server rules change, this must follow.
 *
 * The dates are compared as `YYYY-MM-DD` strings against **IST** today, because that is the day
 * the server evaluates them against — a device in another timezone would otherwise disagree with
 * the backend for a whole day at a time.
 */
export function validateBatch(form: BatchFormState, today: string = todayIst()): ValidationErrors {
  const errors: ValidationErrors = {};

  if (form.itemId == null) errors.itemId = 'Pick a product';

  const purchased = Number(form.purchasedQuantity);
  if (form.purchasedQuantity.trim() === '') {
    errors.purchasedQuantity = 'Enter a quantity';
  } else if (!Number.isFinite(purchased) || purchased <= 0) {
    errors.purchasedQuantity = 'Quantity must be more than zero';
  } else if (!Number.isInteger(purchased)) {
    // Stored as a whole base-unit count; a fraction cannot be represented.
    errors.purchasedQuantity = 'Quantity must be a whole number';
  }

  if (form.remainingQuantity.trim() !== '') {
    const remaining = Number(form.remainingQuantity);
    if (!Number.isFinite(remaining) || remaining < 0) {
      errors.remainingQuantity = 'Remaining cannot be negative';
    } else if (!Number.isInteger(remaining)) {
      errors.remainingQuantity = 'Remaining must be a whole number';
    } else if (Number.isFinite(purchased) && remaining > purchased) {
      errors.remainingQuantity = 'Remaining cannot exceed the purchased quantity';
    }
  }

  if (form.manufactureDate && form.manufactureDate > today) {
    errors.manufactureDate = 'Manufacture date cannot be in the future';
  }

  if (form.expiryDate) {
    if (form.expiryDate <= today) {
      // Strictly after today: a batch expiring today is born EXPIRED, which the server rejects.
      errors.expiryDate = 'Expiry must be after today — a batch expiring today is already expired';
    } else if (form.manufactureDate && form.expiryDate < form.manufactureDate) {
      errors.expiryDate = 'Expiry cannot be before the manufacture date';
    }
  }

  if (form.receivedDate && form.receivedDate > today) {
    errors.receivedDate = 'Received date cannot be in the future';
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

// ─── Date picker bounds ──────────────────────────────────────────────────────

/**
 * The bounds each date field hands its picker, so the invalid range cannot be chosen at all.
 *
 * Cheaper than validating after the fact and far clearer: the user never picks a date only to be
 * told it was impossible. Mirrors the same rules `validateBatch` enforces.
 */
export function dateBounds(
  field: 'manufactureDate' | 'expiryDate' | 'receivedDate',
  form: BatchFormState,
  today: string = todayIst(),
): { min?: string; max?: string } {
  if (field === 'manufactureDate') return { max: today };
  if (field === 'receivedDate') return { max: today };

  // Expiry is TOMORROW at the earliest, not today — the server rejects a batch that expires on the
  // day it is entered. A `min` of today would let the picker offer a date validation then refuses,
  // which is the worst of both.
  const tomorrow = addIstDaysFrom(today, 1);
  const min =
    form.manufactureDate && form.manufactureDate > tomorrow ? form.manufactureDate : tomorrow;
  return { min };
}

/** `YYYY-MM-DD` + n days, without re-deriving "today" — the caller already pinned it. */
function addIstDaysFrom(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
