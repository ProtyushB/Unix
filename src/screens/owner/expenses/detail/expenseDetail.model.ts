import type {
  ExpenseCategory,
  ExpenseDto,
  ExpenseFile,
  ExpensePayload,
  ExpenseRecurrence,
  ExpenseUpdatePayload,
  PaymentMethod,
} from '../../../../backend/modules/shared/expense.types';
import { joinIstInstant, splitIstInstant } from '../../shared/detail/wallClock';

/**
 * The Expense Detail form's state, and the two payloads it builds.
 *
 * RN-free so jest can cover it. The payload builders are the load-bearing part of this file: two of
 * the backend's traps are the SHAPE of what gets sent rather than a value in it, so they can only
 * be prevented here.
 */

export interface ExpenseFormState {
  title: string;
  category: ExpenseCategory;
  /** Kept as TEXT, not a number: a half-typed "12." must survive a render. */
  amount: string;
  paymentMethod: PaymentMethod | null;
  vendorName: string;
  recurrence: ExpenseRecurrence;
  /** `YYYY-MM-DD` IST — the `DateField` contract. Never a `Date`. */
  date: string;
  /** `HH:mm` IST — the slot list's contract. */
  time: string;
  reimbursable: boolean;
  /** An `employments(id)`, NOT a person id. */
  paidByEmployeeId: number | null;
  notes: string;
  /**
   * The receipts currently on the record.
   *
   * ⚠️ Always the FULL list. The server REPLACES this collection on update and writes an empty one
   * when the key is absent, so a partial list here silently erases attachments.
   */
  files: ExpenseFile[];
}

/**
 * A blank form.
 *
 * `category` defaults to `OTHER` rather than to nothing, matching Centrix: the field is required
 * server-side, and an unset dropdown on a form the user may not have scrolled to is a refusal
 * waiting to happen. `OTHER` is also what the server itself coerces to when the category feature is
 * off, so the default and the fallback agree.
 */
export function emptyForm(nowDate: string, nowTime: string): ExpenseFormState {
  return {
    title: '',
    category: 'OTHER',
    amount: '',
    paymentMethod: null,
    vendorName: '',
    recurrence: 'NONE',
    date: nowDate,
    time: nowTime,
    reimbursable: false,
    paidByEmployeeId: null,
    notes: '',
    files: [],
  };
}

/**
 * A saved record → the form that edits it.
 *
 * ⚠️ `recurrence` coalesces a NULL to `NONE`. The column is nullable and rows written before it
 * existed were deliberately not backfilled, so null is a value real records carry — and leaving it
 * null here would send `undefined` on the next save, which JSON.stringify drops entirely.
 */
export function toFormState(record: ExpenseDto | null | undefined): ExpenseFormState {
  const when = splitIstInstant(record?.expenseDate);
  return {
    title: String(record?.title ?? ''),
    category: (record?.category as ExpenseCategory) ?? 'OTHER',
    amount: record?.amount == null ? '' : String(record.amount),
    paymentMethod: (record?.paymentMethod as PaymentMethod) ?? null,
    vendorName: String(record?.vendorName ?? ''),
    recurrence: (record?.recurrence as ExpenseRecurrence) ?? 'NONE',
    date: when.date,
    time: when.time,
    reimbursable: Boolean(record?.reimbursable),
    paidByEmployeeId: record?.paidByEmployeeId == null ? null : Number(record.paidByEmployeeId),
    notes: String(record?.notes ?? ''),
    files: Array.isArray(record?.files) ? [...record.files] : [],
  };
}

/** The form's amount as a number, or 0 when it is blank or not a number. */
export function enteredAmount(form: ExpenseFormState): number {
  const n = Number(String(form?.amount ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Optional text → what to send.
 *
 * Blank becomes `null`, never `''`: the columns are nullable and a blank string is a value that
 * would then render as an empty vendor rather than as no vendor.
 */
function orNull(value: string | null | undefined): string | null {
  const s = String(value ?? '').trim();
  return s ? s : null;
}

/**
 * The POST body.
 *
 * ⚠️ Deliberately emits NO `reimbursed`, `reimbursedAt`, `reimbursedBy`, `createdAt` or `id`.
 * `recordExpense` never clears the first three and the mapper copies them straight through, so a
 * create carrying them would persist an already-settled expense and skip both of `markReimbursed`'s
 * eligibility checks. Only the UPDATE funnel is hardened server-side. Pinned by an `Object.keys`
 * test.
 *
 * ⚠️ `paidByEmployeeId` is nulled when `reimbursable` is false. Leaving a stale id behind would trip
 * the REIMBURSEMENT feature gate — which keys off the employee id, NOT the boolean — and 403 a
 * expense the user did not mark as reimbursable at all.
 */
export function buildCreatePayload(form: ExpenseFormState, businessId: number): ExpensePayload {
  const when = joinIstInstant(form.date, form.time);
  return {
    businessId,
    title: form.title.trim(),
    category: form.category,
    amount: enteredAmount(form),
    paymentMethod: form.paymentMethod ?? null,
    vendorName: orNull(form.vendorName),
    recurrence: form.recurrence || 'NONE',
    expenseDate: when || null,
    reimbursable: form.reimbursable,
    paidByEmployeeId: form.reimbursable ? (form.paidByEmployeeId ?? null) : null,
    notes: orNull(form.notes),
    files: form.files,
  };
}

/**
 * The PUT body — the create payload plus the id.
 *
 * ⚠️ `businessId` is sent even though the update funnel IGNORES it: it is still `@NotNull
 * @Positive`, so omitting it is a 400 naming a field the user cannot see.
 *
 * ⚠️ `files` is ALWAYS present, and that is the whole reason this is a separate function rather than
 * a spread at the call site. The server replaces the collection and writes an empty list when the
 * key is absent, so an update that omits it erases every receipt on the expense — silently, with a
 * 200.
 */
export function buildUpdatePayload(
  form: ExpenseFormState,
  businessId: number,
  id: number,
): ExpenseUpdatePayload {
  return { ...buildCreatePayload(form, businessId), id, files: form.files };
}

/**
 * One row of the detail screen's Details card.
 *
 * Built as data rather than JSX so the ORDER and the conditional rows are testable — "Reimburse to"
 * appears only on a reimbursable expense, and a screen that showed it always would be asking the
 * reader to interpret a blank.
 */
export interface DetailRow {
  label: string;
  value: string;
}
