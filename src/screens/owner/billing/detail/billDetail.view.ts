/**
 * The Bill Detail screen's mode machine, copy and validation.
 *
 * The first block is identical to the order and appointment screens'. The rest is not: a bill has
 * two independent status axes, a customer that locks itself, and a save that can be refused for
 * reasons the other two do not have.
 */

import { settlementField } from './billMoney';
import type { BillFormState } from './billDetail.model';

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

// ─── Statuses ────────────────────────────────────────────────────────────────

/**
 * The two axes are INDEPENDENT. A bill can be FINALIZED and UNPAID at once — that is a delivered
 * order awaiting payment, not a contradiction — which is why they are two dropdowns and not one.
 */
export const BILL_STATUSES = ['DRAFT', 'FINALIZED', 'CANCELLED'] as const;

export const PAYMENT_STATUSES = [
  'UNPAID',
  'PAID',
  'PARTIALLY_PAID',
  'REFUNDED',
  'PARTIAL_REFUNDED',
  'FAILED',
] as const;

export const BILL_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  FINALIZED: 'Finalized',
  CANCELLED: 'Cancelled',
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Unpaid',
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partially Paid',
  REFUNDED: 'Refunded',
  PARTIAL_REFUNDED: 'Partially Refunded',
  FAILED: 'Failed',
};

export function billStatusLabel(status: string | null | undefined): string {
  if (!status) return '';
  return BILL_STATUS_LABEL[status] ?? status;
}

export function paymentStatusLabel(status: string | null | undefined): string {
  if (!status) return '';
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

/**
 * The one transition rule the backend enforces: `CANCELLED → DRAFT` is a 409.
 *
 * Not arbitrary — cancelling already released the billed items and returned the stock, so there is
 * nothing coherent to go back to. Filtering the option out is kinder than offering something that
 * can only fail, and it is what the billing list already does.
 */
export function billStatusOptions(current: string): readonly string[] {
  if (current === 'CANCELLED') return BILL_STATUSES.filter((s) => s !== 'DRAFT');
  return BILL_STATUSES;
}

// ─── Copy ────────────────────────────────────────────────────────────────────

export function appBarTitle(mode: DetailMode, billNumber: string): string {
  if (mode === 'add') return 'Create Bill';
  if (mode === 'edit') return billNumber || 'Edit bill';
  return billNumber || 'Bill details';
}

export function appBarSubtitle(mode: DetailMode): string {
  if (mode === 'add') return 'Select items and fill in details';
  if (mode === 'edit') return 'Edit bill';
  return 'Bill details';
}

export function saveLabel(mode: DetailMode): string {
  return mode === 'add' ? 'Save' : 'Save Changes';
}

// ─── Customer lock ───────────────────────────────────────────────────────────

/**
 * The customer locks the moment the first order or appointment is attached.
 *
 * NOT a function of the mode, which is the easy mistake — the mockup draws Edit with a lock and Add
 * without one, but the rule behind both is the same and Add locks too once something is attached.
 * A bill's customer comes from what is on it: everything billed together must belong to one person,
 * and the picker is filtered by that person, so changing it afterwards would orphan the lines.
 */
export function customerLocked(attachedCount: number): boolean {
  return attachedCount > 0;
}

export const CUSTOMER_LOCK_NOTE =
  'Locked — customer comes from the selected orders & appointments.';

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationErrors = Record<string, string>;

/**
 * Everything that would be refused, plus the things that would be accepted and then quietly do the
 * wrong thing.
 *
 * Unlike the order and appointment endpoints, the bill controller DOES carry `@Valid`, so the three
 * required fields fail cleanly at 400 rather than 500. These checks exist to say so before the
 * round trip, and to catch the two the server would take at face value.
 */
export function validateBill(form: BillFormState): ValidationErrors {
  const errors: ValidationErrors = {};

  // @NotNull / @NotBlank on CreateBillRequest.
  if (form.customerId == null) errors.customer = 'Pick a customer for this bill.';
  if (!form.customerPhone.trim()) {
    errors.customerPhone = 'This customer has no phone number, which a bill requires.';
  }

  if (!form.lines.length) errors.items = 'Add at least one item.';
  if (!form.billDate) errors.billDate = 'Pick a bill date.';
  if (!form.billStatus) errors.billStatus = 'Pick a bill status.';
  if (!form.paymentStatus) errors.paymentStatus = 'Pick a payment status.';

  // The server 400s on either of these, and the message it sends is less specific than this one.
  const field = settlementField(form.paymentStatus);
  if (field === 'paidAmount' && !(form.paidAmount > 0)) {
    errors.paidAmount = 'Enter how much has been paid.';
  }
  if (field === 'refundedAmount' && !(form.refundedAmount > 0)) {
    errors.refundedAmount = 'Enter how much was refunded.';
  }

  if (form.taxRate < 0 || form.taxRate > 100)
    errors.taxRate = 'Tax rate must be between 0 and 100.';
  if (form.discount.type === 'PERCENTAGE' && form.discount.value > 100) {
    errors.discount = 'A percentage discount cannot exceed 100.';
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function errorSummary(errors: ValidationErrors): string {
  return (
    errors.customer ||
    errors.customerPhone ||
    errors.items ||
    errors.paidAmount ||
    errors.refundedAmount ||
    'Please fix the highlighted fields.'
  );
}

/**
 * Whether a status change should go through `PATCH /{id}/status` instead of the full PUT.
 *
 * ⚠️ This is the sharpest edge on the whole screen. Sending `billStatus: "CANCELLED"` in a PUT body
 * is not a label change — it detaches every billed order and appointment and drops-and-restocks
 * every bare line, in the same request that is also trying to save the user's edits. The PATCH does
 * the cancellation cleanly and on purpose. So a save that is ONLY a cancellation must not be a PUT.
 */
export function isCancellationOnly(
  original: { billStatus: string },
  form: { billStatus: string },
): boolean {
  return form.billStatus === 'CANCELLED' && original.billStatus !== 'CANCELLED';
}
