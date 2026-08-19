/**
 * The Appointment Detail screen's mode machine, copy and validation.
 *
 * The first block is deliberately identical to the order and product screens' — three screens
 * agreeing about what "loading" means is worth more than three private definitions.
 */

import type { AppointmentFormState } from './appointmentDetail.model';

export type DetailMode = 'view' | 'edit' | 'add';
export type DetailView = 'LOADING' | 'ERROR' | 'READY' | 'SAVING';

export function deriveDetailView(input: {
  mode: DetailMode;
  loading: boolean;
  saving: boolean;
  hasError: boolean;
  hasItem: boolean;
}): DetailView {
  if (input.saving) return 'SAVING';
  if (input.hasError && !input.hasItem) return 'ERROR';
  if (input.mode === 'add') return 'READY';
  return input.loading || !input.hasItem ? 'LOADING' : 'READY';
}

export function isEditable(mode: DetailMode): boolean {
  return mode !== 'view';
}

export function showsDelete(mode: DetailMode): boolean {
  return mode === 'edit';
}

export function showsEditCta(mode: DetailMode): boolean {
  return mode === 'view';
}

/**
 * Whether the services picker offers "New Service".
 *
 * Add AND edit, matching the order screen's `showsCreateProduct` deliberately — the two screens
 * answer the same question and should not drift apart on it.
 */
export function showsCreateService(mode: DetailMode): boolean {
  return isEditable(mode);
}

// ─── Copy ────────────────────────────────────────────────────────────────────

export function appBarTitle(mode: DetailMode, appointmentNumber: string): string {
  if (mode === 'add') return 'Create Appointment';
  if (mode === 'edit') return appointmentNumber || 'Edit appointment';
  return appointmentNumber || 'Appointment details';
}

export function appBarSubtitle(mode: DetailMode): string {
  if (mode === 'add') return 'Schedule a new appointment';
  if (mode === 'edit') return 'Edit appointment';
  return 'Appointment details';
}

/** Plain "Save" when creating, per the mockup — shorter than the order screen's "Save Order". */
export function saveLabel(mode: DetailMode): string {
  return mode === 'add' ? 'Save' : 'Save Changes';
}

// ─── Locks ───────────────────────────────────────────────────────────────────

/** Same rule as an order: a billed appointment is frozen, and the server answers 409 if pushed. */
export function canEdit(billed: boolean): boolean {
  return !billed;
}

export function lockedReason(billNumber: string | null | undefined): string {
  return billNumber
    ? `On bill ${billNumber} — cancel the bill to edit this appointment`
    : 'This appointment is on a bill — cancel the bill to edit it';
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationErrors = Record<string, string>;

/**
 * Everything the server will not check.
 *
 * ⚠️ `@Valid` is MISSING on `POST`/`PUT /{module}Appointment`, exactly as it is on the order
 * endpoints, so every constraint annotation on `AppointmentDto` is dead code. Worse than the order
 * case in one respect: the web portal defaults a missing customer to person id **1** rather than
 * refusing, so there is no upstream precedent to lean on either.
 */
export function validateAppointment(form: AppointmentFormState): ValidationErrors {
  const errors: ValidationErrors = {};

  // No customer check — nullable since V121. This used to refuse rather than attach the appointment
  // to whoever person 1 happens to be, which was the right call while the column was NOT NULL; the
  // web has since dropped that fallback too, so absence now travels as absence on both clients.

  // NOT NULL with no server-side fallback: a missing date is an HTTP 500, not a validation error.
  if (!form.date) errors.date = 'Pick a date.';
  if (!form.time) errors.time = 'Pick a time.';

  if (!form.lines.length) errors.services = 'Add at least one service.';

  form.lines.forEach((line, index) => {
    if (!line.serviceId) errors[`line.${index}.service`] = 'This line has no service.';
    if (!(line.quantity > 0)) errors[`line.${index}.quantity`] = 'Quantity must be at least 1.';
  });

  if (!form.appointmentStatus) errors.status = 'Pick a status.';

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function errorSummary(errors: ValidationErrors): string {
  return (
    errors.customer ||
    errors.date ||
    errors.time ||
    errors.services ||
    'Please fix the highlighted fields.'
  );
}
