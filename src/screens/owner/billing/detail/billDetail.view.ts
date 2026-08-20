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

/**
 * Whether the form may be (re)built from the bill the screen is currently holding.
 *
 * The screen hands the form hook a new `item` OBJECT far more often than it hands it a new bill:
 * every mode change refetches, and a two-call save hands back what its first call committed while
 * the save is still running. Rebuilding from those is right in view mode, where the form is nothing
 * but a rendering of the bill, and destructive in edit mode, where it is the user's unsaved work.
 *
 * That second case is not hypothetical. The payment-then-status save handed back the committed
 * payment mid-save, an unguarded rebuild ran while the edit form was still on screen, and it put
 * `billStatus` back to the server's value — a moment before the toast told the user their status
 * had not been saved. The status they had picked was already gone from the form by then.
 *
 * So the question is not "did the bill change" but "is this form the user's". `alreadySeeded` is
 * what separates a rebuild from the first fill: a screen opened straight into edit mode has an
 * empty form and nothing to lose, and must still be filled.
 */
export function acceptsFormSeed(mode: DetailMode, alreadySeeded: boolean): boolean {
  // An add has no bill behind it. Its form starts blank and only the user ever writes to it.
  if (mode === 'add') return false;
  return mode !== 'edit' || !alreadySeeded;
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

/**
 * What a refused save or delete says when the response carried no reason of its own.
 *
 * Here rather than as literals at the call sites so the hook and the screen cannot end up
 * describing the same failure in two different sentences.
 *
 * At the screen it is a floor today's code never stands on. Every non-success return from
 * `useBillDetailForm` already carries words — the hand-written early returns, `errorSummary` with
 * its own non-empty fallback, and the ones derived from `failureMessage`, which never yields an
 * empty string — and the screen is fed by `engine.save()` / `engine.remove()` and nothing else,
 * so the fallback arm cannot be reached. It is passed anyway because `failureMessage` takes a
 * fallback by contract, and so that the day a caller does reach the screen without the hook, the
 * sentence waiting there is already the right one.
 *
 * The create path and the payment-then-status path keep their own wording: each says something
 * these two cannot, and neither is ever the screen's fallback.
 */
export const SAVE_FAILED = 'Could not save this bill.';
export const DELETE_FAILED = 'Could not delete this bill.';

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

  // No customer check, and none on the phone either. Both annotations came off CreateBillRequest
  // when V121 made the columns nullable, and the phone is the half that hides: a counter sale's
  // phone is '', so leaving that check in place would keep refusing the bill long after the
  // customer check went — with a message about a customer that isn't there.

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

// ─── Which endpoint a save should use ────────────────────────────────────────

export type SaveRoute = 'PUT' | 'PATCH_STATUS' | 'PATCH_PAYMENT';

/** The fields that decide the route. A subset of the form, so this stays testable. */
export interface SaveShape {
  billStatus: string;
  paymentStatus: string;
  paidAmount: number;
  refundedAmount: number;
  /** Everything else the PUT would carry, hashed by the caller — see `contentKey`. */
  content: string;
}

/**
 * A stable string standing for "the parts of the bill a PUT would rewrite".
 *
 * Used only to answer "did anything other than the statuses change?". A hash rather than a deep
 * compare because the answer is a yes/no and the inputs are small.
 *
 * ⚠️ QUICK lines must be hashed by their CONTENT, not by `refId`. Every quick line carries
 * `refId: 0` — it has no server id — so a key built from `[kind, refId]` alone reads "one quick
 * line" for any quick line. Swap an item for a different one and the count is unchanged, the key
 * is unchanged, and if the payment also moved `saveRoute` would answer PATCH_PAYMENT: the swap
 * would never reach the server and the save would still report success.
 */
export function contentKey(form: BillFormState): string {
  return JSON.stringify([
    form.customerId,
    form.lines.map((l) => [
      l.kind,
      l.refId,
      l.bare?.quantity ?? null,
      l.quick
        ? [
            l.quick.lineId,
            l.quick.name,
            l.quick.price,
            l.quick.quantity,
            l.quick.unit,
            // A photo picked but not yet uploaded is a change the save has to act on, even when
            // nothing else about the line moved.
            !!l.quick.photo,
          ]
        : null,
    ]),
    form.notes.trim(),
    form.tips,
    form.discount.type,
    form.discount.value,
    form.taxRate,
    form.billDate,
  ]);
}

/**
 * Which endpoint this save should use.
 *
 * ⚠️ The single most important decision on this screen, and the reason it is a pure function with
 * its own tests. Three things make the full PUT the wrong tool for a status or payment change:
 *
 *  1. **`billStatus: "CANCELLED"` in a PUT body is a cascade trigger, not a label.** It detaches
 *     every billed order and appointment and drops-and-restocks every bare line — in the same
 *     request that is trying to save the user's edits.
 *  2. **PUT cannot express a payment at all.** `calculateFinancials` ends in
 *     `applySettlementAmounts`, which rewrites `paidAmount` and `refundedAmount` from the
 *     grandTotal it just recomputed. On PAID it forces `paidAmount = grandTotal`; on the two
 *     PARTIAL states it takes the client's number, but a PUT that also touched the lines would move
 *     the total under it. `PATCH /{id}/payment` is the only endpoint that means "money changed".
 *  3. **A no-op PUT is not a no-op.** Bare lines are repriced from the LIVE catalog on every write,
 *     and order-backed content re-deducts. PATCH has a no-op fast path; PUT does not.
 *
 * So: if nothing but the payment moved, PATCH the payment. If nothing but the bill status moved,
 * PATCH the status. Only a genuine content edit earns the PUT.
 */
export function saveRoute(original: SaveShape, next: SaveShape): SaveRoute {
  const contentChanged = original.content !== next.content;
  if (contentChanged) return 'PUT';

  const paymentChanged =
    original.paymentStatus !== next.paymentStatus ||
    original.paidAmount !== next.paidAmount ||
    original.refundedAmount !== next.refundedAmount;
  const statusChanged = original.billStatus !== next.billStatus;

  // Payment first: it is the one the PUT genuinely cannot express, so when both moved it is the
  // one that must not be folded in. The caller issues the status PATCH after.
  if (paymentChanged) return 'PATCH_PAYMENT';
  if (statusChanged) return 'PATCH_STATUS';

  // Nothing changed. Still a PUT rather than a no-op, because the user pressed Save and expects
  // something to happen — and with no content change there is nothing for it to damage.
  return 'PUT';
}

/** Whether a status PATCH is also needed after a payment PATCH. Both can move in one save. */
export function alsoNeedsStatusPatch(original: SaveShape, next: SaveShape): boolean {
  return (
    original.content === next.content &&
    original.billStatus !== next.billStatus &&
    (original.paymentStatus !== next.paymentStatus ||
      original.paidAmount !== next.paidAmount ||
      original.refundedAmount !== next.refundedAmount)
  );
}
