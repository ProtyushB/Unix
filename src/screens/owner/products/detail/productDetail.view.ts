/**
 * View state and validation for the Product Detail screen. RN-free, same reason as the model.
 *
 * The screen has three MODES (what the user asked for) and four VIEWS (what is on screen right
 * now). Keeping them apart is what lets one component serve view, edit and add: mode decides
 * whether fields are editable, view decides whether there are any fields yet.
 */

import type { PackLevel, ProductFormState } from './productDetail.model';
import { toIntOrNull, toNumberOrNull } from './productDetail.model';

export type DetailMode = 'view' | 'edit' | 'add';

export type DetailView = 'LOADING' | 'ERROR' | 'READY' | 'SAVING';

export interface DetailViewInput {
  mode: DetailMode;
  loading: boolean;
  saving: boolean;
  hasError: boolean;
  hasItem: boolean;
}

/**
 * Precedence: saving beats everything (the overlay is blocking), then error, then the wait for
 * the record. Add mode never loads — there is nothing to fetch — so it is READY immediately.
 */
export function deriveDetailView(i: DetailViewInput): DetailView {
  if (i.saving) return 'SAVING';
  if (i.hasError) return 'ERROR';
  if (i.mode === 'add') return 'READY';
  if (i.loading || !i.hasItem) return 'LOADING';
  return 'READY';
}

/** Editable in edit and add; read-only in view. The whole mode/UI mapping is this one line. */
export function isEditable(mode: DetailMode): boolean {
  return mode === 'edit' || mode === 'add';
}

/**
 * Delete is offered wherever a saved record exists — both the read screen and the form. Add mode
 * has nothing to delete yet.
 */
export function showsDelete(mode: DetailMode): boolean {
  return mode === 'view' || mode === 'edit';
}

/** The read-only screen is the only one that offers a jump into editing. */
export function showsEditCta(mode: DetailMode): boolean {
  return mode === 'view';
}

export function appBarTitle(mode: DetailMode): string {
  if (mode === 'add') return 'New Product';
  if (mode === 'edit') return 'Edit Product';
  return 'Product details';
}

export function saveLabel(mode: DetailMode): string {
  return mode === 'add' ? 'Save Product' : 'Save';
}

/**
 * The app bar's second line, e.g. "Update this parlour product".
 *
 * Mode-dependent, because "Update this…" over a blank form is simply untrue — the record does not
 * exist yet. View mode has no subtitle at all: the product's own name is already the heading.
 */
export function detailSubtitle(mode: DetailMode, entityLabel: string): string {
  if (mode === 'add') return `Create a new ${entityLabel}`;
  if (mode === 'edit') return `Update this ${entityLabel}`;
  return '';
}

/**
 * Combos have no pricing ladder — the server's `ensureBaseSaleUnit` skips them and
 * `validateSaleUnits` exempts them, so showing the editor would offer something that is discarded.
 */
export function showsSaleUnitLadder(productType: string): boolean {
  return (productType || 'NORMAL') !== 'COMBO';
}

/** Inventory is a real business feature gate, not a mode question. */
export function showsInventorySection(inventoryTabEnabled: boolean): boolean {
  return inventoryTabEnabled;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationErrors = Record<string, string>;

/**
 * Ladder rules, mirroring the server's `validateSaleUnits` guard — including the wording. If the
 * two drift the user gets a 400 whose message the screen cannot render, which is the worst of
 * both worlds: a rejected save and no way to know why.
 *
 * Combos are exempt server-side, so they are exempt here.
 */
export function validateSaleUnits(form: ProductFormState): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!showsSaleUnitLadder(form.productType)) return errors;

  if (!form.stockUnit.trim()) {
    errors.stockUnit = 'Base unit name is required.';
  }

  let previous = 1;
  form.packs.forEach((pack: PackLevel, index: number) => {
    const key = `pack_${index}`;
    if (!pack.unit.trim()) {
      errors[key] = 'Pack levels need a name.';
      return;
    }
    const per = toIntOrNull(pack.perStock);
    if (per === null || per < 2) {
      errors[key] = 'Per stock must be a whole number of 2 or more.';
      return;
    }
    if (per <= previous) {
      errors[key] = 'Each level must hold more than the one above it.';
      return;
    }
    previous = per;
    const price = toNumberOrNull(pack.price);
    if (price !== null && price < 0) {
      errors[key] = 'Price cannot be negative.';
    }
  });

  return errors;
}

/**
 * Everything the server rejects, checked before the round trip. `name`, `price` and `businessId`
 * are `@NotNull` at the controller, so a missing one is a 400 rather than a partial save.
 */
export function validateProduct(form: ProductFormState): ValidationErrors {
  const errors: ValidationErrors = { ...validateSaleUnits(form) };

  if (!form.name.trim()) {
    errors.name = 'Product name is required.';
  }

  const price = toNumberOrNull(form.price);
  if (price === null) {
    errors.price = 'Price is required.';
  } else if (price < 0) {
    errors.price = 'Price cannot be negative.';
  }

  const volume = toNumberOrNull(form.volume);
  if (volume !== null && volume < 0) {
    errors.volume = 'Volume cannot be negative.';
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

// ─── Save progress ───────────────────────────────────────────────────────────

/**
 * One monotonic bar across a two-phase save (record, then images), matching the web portal's
 * numbers so the two feel the same. Upload occupies 18→90; the tail is the server's own work,
 * which we cannot measure but which is real time the user is waiting.
 */
export const UPLOAD_START = 18;
export const UPLOAD_CEIL = 90;

export function uploadPercent(loaded: number, total: number | undefined): number {
  if (!total || total <= 0) return UPLOAD_START;
  const span = UPLOAD_CEIL - UPLOAD_START;
  const pct = UPLOAD_START + (loaded / total) * span;
  return Math.min(UPLOAD_CEIL, Math.max(UPLOAD_START, Math.round(pct)));
}

export function savePhaseLabel(percent: number): string {
  if (percent >= 100) return 'Done';
  if (percent >= 95) return 'Finalizing…';
  if (percent >= 92) return 'Processing on server…';
  if (percent >= UPLOAD_START) return 'Uploading images…';
  return 'Saving…';
}
