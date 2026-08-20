/**
 * The Bill Detail screen's mode machine, copy and validation.
 *
 * The first block is identical to the order and appointment screens'. The rest is not: a bill has
 * two independent status axes, a customer that locks itself, and a save that can be refused for
 * reasons the other two do not have.
 */

import { istToday } from '../bill.model';
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

// ─── The window a bill may be dated in ───────────────────────────────────────

/** An inclusive `YYYY-MM-DD` range. Both ends are days, never instants. */
export interface BillDateWindow {
  min: string;
  max: string;
}

/**
 * The range of days the server will accept a bill in, ready to hand to a date dialog.
 *
 * Mirrors `GenericBillService#validateBillDate`: no later than today, no earlier than 1 January of
 * the previous calendar year. The derivation is deliberately the same two lines the web half runs
 * in `BillSummarySection` — a max read straight off the IST clock and a floor built from its year —
 * so the two clients cannot drift into offering different days.
 *
 * The floor is a garbage-date guard (a wrong decade, an epoch default, a mistyped year), not a
 * period-close policy, which is why it is a year and a bit rather than a month.
 *
 * `today` is read in **Asia/Kolkata**, not on the device, and through the same `istToday` the create
 * seed uses. The zone is the whole point: the server compares against the IST day, so a max taken
 * from a device sitting in another zone would be a day out — offering a day the save then refuses
 * west of IST, and refusing the freshly seeded default east of it, where the form opens on an IST
 * "today" the device has not reached yet.
 *
 * Injectable so tests can pin a day; a caller should let it default, and should call it at the
 * moment the dialog opens rather than caching the result. See the note at its one call site.
 */
export function billDateBounds(today: string = istToday()): BillDateWindow {
  const max = today;
  const min = `${Number(max.slice(0, 4)) - 1}-01-01`;
  return { min, max };
}

/**
 * The day a dialog bounded by `bounds` should open on, given what the form currently holds.
 *
 * Exists because the form's date and the window are not guaranteed to agree. A bill written before
 * the floor — any bill older than about 19 months, which every business of that age has — is still
 * openable and still editable, and its own stored date is a day the picker is now forbidden to
 * offer. Handing a dialog a value outside the range it is told to enforce asks it to render a
 * contradiction; opening on the nearest day it IS allowed to show keeps the two consistent.
 *
 * This changes nothing about the form: it decides where the calendar lands, and the stored date
 * moves only if the user actually picks a different day.
 *
 * Empty falls back to the max — IST today, the same day a new bill is seeded with — rather than to
 * the device's today, which east of IST can be a day the window already excludes.
 */
export function billDatePickerDay(billDate: string, bounds: BillDateWindow): string {
  if (!billDate) return bounds.max;
  if (billDate < bounds.min) return bounds.min;
  if (billDate > bounds.max) return bounds.max;
  return billDate;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationErrors = Record<string, string>;

/**
 * Everything that would be refused, plus the things that would be accepted and then quietly do the
 * wrong thing.
 *
 * Unlike the order and appointment endpoints, the bill controller DOES carry `@Valid`, so the three
 * required fields fail cleanly at 400 rather than 500. These checks exist to say so before the
 * round trip, and to catch the two the server would take at face value.
 *
 * `today` is IST and injectable for the tests, for the reasons on `billDateBounds`.
 */
export function validateBill(form: BillFormState, today: string = istToday()): ValidationErrors {
  const errors: ValidationErrors = {};

  // No customer check, and none on the phone either. Both annotations came off CreateBillRequest
  // when V121 made the columns nullable, and the phone is the half that hides: a counter sale's
  // phone is '', so leaving that check in place would keep refusing the bill long after the
  // customer check went — with a message about a customer that isn't there.

  if (!form.lines.length) errors.items = 'Add at least one item.';

  /*
    The date is checked at ONE end only, and the asymmetry is deliberate.

    A future date is refused because the server refuses it (`validateBillDate`) and because nothing
    can put one in the form honestly: the picker is now bounded at today IST, and a stored bill
    cannot be dated after today either, since the server would not have taken it. So this rejects a
    value only a path around the picker can produce — the same value the server would 400 on, named
    against the field instead of arriving as a bare server message. It reads the device's clock to
    decide what "today" is, which is the one way it can be wrong; a phone whose clock lags the
    server across midnight would refuse a bill the server would take.

    The floor is NOT mirrored here, though the picker enforces it. `validateBill` runs before the
    save picks its route, and only the PUT carries a date at all — a payment or status PATCH sends
    none, so the server never looks at it. A bill written before 1 January of last year is an
    ordinary bill on any business older than about 19 months; refusing the form because of a date
    the user did not choose and is not sending would block marking a 2024 bill PAID, which the
    server does without complaint. That leaves a real gap — a CONTENT edit of a pre-floor bill does
    send the old date and the server does 400 on it — but it is a gap that closes by not re-sending
    an unchanged date, not by making the whole bill unsavable.
  */
  if (!form.billDate) errors.billDate = 'Pick a bill date.';
  else if (form.billDate > today) errors.billDate = 'A bill cannot be dated after today.';

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

/**
 * `NO_CHANGE` is a route in the sense that matters: it is what the save does, and what it does is
 * send nothing. It is not an error and not a refusal — the bill is already exactly what the user
 * asked for.
 */
export type SaveRoute = 'PUT' | 'PATCH_STATUS' | 'PATCH_PAYMENT' | 'NO_CHANGE';

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
 * PATCH the status. Only a genuine content edit earns the PUT, and a save with nothing behind it
 * earns no request at all.
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

  // Nothing moved on any axis, so there is nothing to write. This used to answer 'PUT' on the
  // grounds that the user pressed Save and expects something to happen, with "there is nothing for
  // it to damage" as the justification — which is point 3 above, stated backwards. An identical
  // body is not an identical bill: the server drops every bare line, restocks its batch ledger,
  // rebuilds the line from the LIVE catalog row and deducts again, so a bill issued at last
  // month's price silently re-totals at today's, and the FEFO round trip need not hand back the
  // batches it took. It answers 200 and the app says "Bill updated".
  return 'NO_CHANGE';
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

/**
 * Whether this form has anything worth saving — what the Save control's enabled state reads.
 *
 * Asked THROUGH `saveRoute` rather than by comparing the same five fields a second time. Two
 * copies of "has anything changed" is how the button and the routing decision come to disagree,
 * and the disagreement that matters is a live Save button on a bill the route has already decided
 * to write nothing for — an invitation to a save that does nothing, which is what greying the
 * button exists to withdraw. A field added to the shape now reaches both answers or neither.
 *
 * A null `original` means no saved bill stands behind this form — a create, or an edit whose fetch
 * has not landed. There is nothing to be unchanged from, so it counts as changed.
 */
export function hasUnsavedChanges(original: SaveShape | null, next: SaveShape): boolean {
  return original === null || saveRoute(original, next) !== 'NO_CHANGE';
}
