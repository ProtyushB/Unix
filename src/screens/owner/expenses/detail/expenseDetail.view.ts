import type { ExpenseDto } from '../../../../backend/modules/shared/expense.types';
import { reimbursementState } from '../../../../backend/modules/shared/expense.types';
import { formatExpenseDay } from '../expense.model';
import type { ExpenseFormState } from './expenseDetail.model';
import { enteredAmount } from './expenseDetail.model';

/**
 * The Expense Detail screen's mode/view machine, its gates, its validation and its copy.
 *
 * Note what is DIFFERENT from its stock-ops siblings: there IS an `'edit'` mode. Consumption,
 * wastage and stock transfers are immutable because changing one means re-running a stock movement;
 * an expense moves no stock, so it has a real PUT and a real edit affordance.
 */

export type DetailMode = 'view' | 'add' | 'edit';
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

/** Both writing modes put the fields into inputs. */
export function isEditable(mode: DetailMode): boolean {
  return mode === 'add' || mode === 'edit';
}

/** Delete lives on the read screen only. */
export function showsDelete(mode: DetailMode): boolean {
  return mode === 'view';
}

/**
 * Whether the Edit affordance is drawn. TRUE here, unlike every stock-ops screen.
 *
 * Named rather than assumed, because the sibling screens all return `false` from a function of this
 * name and a reader arriving from one of them would otherwise expect the same.
 */
export function showsEditCta(mode: DetailMode): boolean {
  return mode === 'view';
}

/**
 * Whether "Mark reimbursed" is offered.
 *
 * Only on a saved record that is reimbursable and not yet settled — exactly the PENDING state. The
 * server answers 409 `STATE_CONFLICT` for the other two, so this gate is what keeps a reachable
 * refusal off the screen rather than relying on the error path.
 */
export function showsMarkReimbursed(mode: DetailMode, item: ExpenseDto | null): boolean {
  return mode === 'view' && !!item && reimbursementState(item) === 'PENDING';
}

/**
 * Whether the "Reimburse to" picker is shown.
 *
 * Follows the toggle, not the saved record: turning the switch on has to reveal the field
 * immediately, and turning it off has to hide it — along with clearing the id, which the form hook
 * does.
 */
export function showsEmployeePicker(form: Pick<ExpenseFormState, 'reimbursable'>): boolean {
  return !!form?.reimbursable;
}

// ─── App bar ─────────────────────────────────────────────────────────────────

export function appBarTitle(mode: DetailMode, item: ExpenseDto | null): string {
  if (mode === 'add') return 'Record Expense';
  if (mode === 'edit') return 'Edit Expense';
  return String(item?.title ?? '').trim() || 'Expense';
}

/**
 * The line under the title.
 *
 * Add explains the form. Edit says WHEN the record was made, which is the one fact an editor needs
 * and cannot see anywhere else on the form. View shows category and date, which is the pair the
 * amount hero below does not repeat.
 */
export function appBarSubtitle(mode: DetailMode, item: ExpenseDto | null): string {
  if (mode === 'add') return 'Log a business expense';
  if (mode === 'edit') {
    const day = formatExpenseDay(item?.createdAt);
    return day ? `Editing · recorded ${day}` : 'Editing';
  }
  return '';
}

/** The save button's label. "Record" while composing, "Save" while correcting. */
export function saveCtaLabel(mode: DetailMode): string {
  return mode === 'edit' ? 'Save' : 'Record';
}

/** The full-width button at the foot of the form. */
export function saveButtonLabel(mode: DetailMode): string {
  return mode === 'edit' ? 'Save changes' : 'Record expense';
}

export const DELETE_CTA = 'Delete expense';
export const EDIT_CTA = 'Edit';
export const MARK_REIMBURSED_CTA = 'Mark reimbursed';

// ─── Dialogs ─────────────────────────────────────────────────────────────────

export const DELETE_TITLE = 'Delete this expense?';
export const DELETE_BODY = 'This removes the record. It cannot be undone.';

export const REIMBURSE_TITLE = 'Mark as reimbursed?';
/**
 * Says both consequences: the stamp is automatic, and the row leaves the pending list.
 *
 * The second half matters because the pending filter is how the reimbursement queue is worked, and
 * a row vanishing from it looks like a bug if nobody said it would.
 */
export const REIMBURSE_BODY =
  'The settlement timestamp is recorded automatically and it leaves the pending list.';
export const REIMBURSE_CONFIRM = 'Mark reimbursed';

/**
 * The 409 the reimburse action can answer with.
 *
 * `STATE_CONFLICT` means the expense is not reimbursable or is already settled — reachable by two
 * taps on one row, or by two devices. It is the system holding a line, not a failure, and "Could
 * not mark reimbursed" is the wrong thing to say about a row that already is.
 */
export function reimburseRefusalMessage(code: string | undefined, error: string | null): string {
  if (code === 'STATE_CONFLICT') {
    return error || 'This expense has already been reimbursed.';
  }
  return error || 'Could not mark this expense reimbursed.';
}

/**
 * The 403s a write can answer with.
 *
 * Two different tab/feature gates reach this screen and they mean different things — one says the
 * whole Expenses tab is off for this business, the other says reimbursement specifically is off
 * while an employee is attached. A single "Not allowed" would leave the user unable to act on
 * either.
 */
export function writeRefusalMessage(code: string | undefined, error: string | null): string {
  if (code === 'TAB_DISABLED') return 'Expenses are turned off for this business.';
  if (code === 'FEATURE_DISABLED') {
    return 'Staff reimbursement is turned off. Save without a reimbursement, or turn the feature on.';
  }
  if (code === 'BUSINESS_NOT_ACTIVATED') return 'This business is not active yet.';
  return error || 'Could not save this expense.';
}

/**
 * Which message the detail screen's banner shows, or null for none.
 *
 * A SAVE error outranks a LOAD error, because it is the more recent thing the user did and the one
 * they are waiting on. A load failure that is still on screen underneath is not more interesting
 * than "your save was refused".
 *
 * This exists because the screen had neither: `saveError` was set by the form hook and rendered
 * nowhere, so every write refusal — the 403 when the Expenses tab is off, the 403 when
 * reimbursement is off, the 409 on an already-settled expense, a receipt that failed to upload —
 * left the form sitting there looking like nothing had happened. That is exactly the flaw this
 * feature's own notes call out in the web portal's expense page; it is not one to reproduce.
 */
export function detailBanner(
  saveError: string | null | undefined,
  loadError: string | null | undefined,
): string | null {
  return saveError || loadError || null;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationErrors = Record<string, string>;

/**
 * The create/update rules.
 *
 * Every one is also enforced behind the client, and every one is caught here anyway because the
 * server's version reads worse — and in two cases is a 500 rather than a 400:
 *
 *   • `title` — `@NotBlank`. No `@Size` server-side, but the column is 255, and an over-long title
 *     is a `DataIntegrityViolationException` at flush, i.e. a 500 with nothing readable in it.
 *   • `amount` — `@NotNull @Positive`. Zero and negatives are refused; so is a non-number, which
 *     would otherwise serialise as `null` and read as "missing" rather than "not a number".
 *   • `paidByEmployeeId` — required when `reimbursable` is on. The server does NOT enforce this
 *     pairing (it gates on the id, not the boolean), so an expense can be saved as reimbursable
 *     with nobody to reimburse — which is unactionable rather than wrong, and worth refusing here.
 *
 * There is deliberately NO date rule. `expenseDate` has no server-side validation at all — unlike
 * consumption's `consumedAt`, a future value is accepted — and inventing a client-only rule would
 * refuse a saving a user has every right to make (a rent payment dated the 1st, entered late).
 */
export const TITLE_MAX = 255;

export function validateExpense(form: ExpenseFormState): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!form.title?.trim()) {
    errors.title = 'Give the expense a title';
  } else if (form.title.trim().length > TITLE_MAX) {
    errors.title = `Keep the title under ${TITLE_MAX} characters`;
  }

  const amount = enteredAmount(form);
  const typed = String(form.amount ?? '').trim();
  if (!typed) {
    errors.amount = 'Enter an amount';
  } else if (!Number.isFinite(Number(typed))) {
    errors.amount = 'Enter a number';
  } else if (!(amount > 0)) {
    errors.amount = 'Amount must be more than zero';
  }

  if (form.reimbursable && form.paidByEmployeeId == null) {
    errors.paidByEmployeeId = 'Choose who to reimburse';
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

// ─── Field copy ──────────────────────────────────────────────────────────────

export const REIMBURSE_QUESTION = 'Reimburse a staff member?';
export const REIMBURSE_HELPER =
  'Turn on if a team member paid out of pocket — you’ll choose whom to reimburse and can mark it settled later.';

/**
 * Whether the category picker is shown at all.
 *
 * ⚠️ When the platform's `expenseCategory` feature is off the server SILENTLY REWRITES whatever was
 * sent to `OTHER`, on create and on update, with no error. Showing the picker anyway would display
 * a choice the server discards — so the screen hides it and lets the default stand.
 */
export function showsCategoryPicker(categoryEnabled: boolean): boolean {
  return categoryEnabled;
}
