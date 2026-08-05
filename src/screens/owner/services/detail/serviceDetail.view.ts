/**
 * View state and validation for the Service Detail screen. RN-free, same reason as the model.
 *
 * The screen has three MODES (what the user asked for) and four VIEWS (what is on screen right
 * now). Keeping them apart is what lets one component serve view, edit and add: mode decides
 * whether fields are editable, view decides whether there are any fields yet.
 */

import type { ServiceFormState } from './serviceDetail.model';
import { toIntOrNull, toNumberOrNull } from './serviceDetail.model';

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

/** Available / Unavailable is a form control, not a read-mode row. */
export function showsAvailabilitySegment(mode: DetailMode): boolean {
  return isEditable(mode);
}

/**
 * Whether to fetch the business's products for the Required Products picker.
 *
 * Always in a form, because anything can be picked. In read mode only when there is something to
 * name — a 500-row fetch to render an empty card is pure waste, but a service WITH required
 * products needs the list to turn its stored ids into names.
 */
export function shouldLoadProductOptions(mode: DetailMode, selectedCount: number): boolean {
  return isEditable(mode) || selectedCount > 0;
}

export function appBarTitle(mode: DetailMode): string {
  if (mode === 'add') return 'New Service';
  if (mode === 'edit') return 'Edit Service';
  return 'Service details';
}

/**
 * "Save Service" in BOTH form modes, unlike products, which shortens to "Save" when editing. The
 * mockups draw the same 131-wide button with a check glyph on every service form screen.
 */
export function saveLabel(_mode: DetailMode): string {
  return 'Save Service';
}

/**
 * The app bar's second line.
 *
 * Add mode's wording comes from the mockup verbatim rather than being generated from the entity
 * label, because "Add a new service to your offerings" says something the generic phrasing does
 * not. View mode has no subtitle at all: the service's own name is already the heading.
 */
export function detailSubtitle(mode: DetailMode, entityLabel: string): string {
  if (mode === 'add') return 'Add a new service to your offerings';
  if (mode === 'edit') return `Update this ${entityLabel}`;
  return '';
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationErrors = Record<string, string>;

/**
 * Everything the server rejects, checked before the round trip, plus one rule it does not enforce.
 *
 * `name`, `price` and `businessId` are `@NotNull` at the controller, so a missing one is a 400
 * rather than a partial save, and `description` is `@Size(max = 1000)`.
 *
 * `duration` has NO server constraint — a negative would be accepted. It is rejected here because
 * a service that takes minus ten minutes is not a thing, and zero means "unset", which is what
 * leaving the box blank already says. Blank stays valid and serialises as null.
 */
export function validateService(form: ServiceFormState): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!form.name.trim()) {
    errors.name = 'Service name is required.';
  }

  const price = toNumberOrNull(form.price);
  if (price === null) {
    errors.price = 'Price is required.';
  } else if (price < 0) {
    errors.price = 'Price cannot be negative.';
  }

  if (form.duration.trim() !== '') {
    const duration = toIntOrNull(form.duration);
    if (duration === null || duration <= 0) {
      errors.duration = 'Duration must be a whole number of minutes.';
    }
  }

  if (form.description.length > 1000) {
    errors.description = 'Description cannot exceed 1000 characters.';
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

// ─── Save progress ───────────────────────────────────────────────────────────

/**
 * One monotonic bar across a two-phase save (record, then images), matching the product screen and
 * the web portal so all three feel the same. Upload occupies 18→90; the tail is the server's own
 * work, which we cannot measure but which is real time the user is waiting.
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
