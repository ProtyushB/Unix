import {
  TITLE_MAX,
  appBarSubtitle,
  appBarTitle,
  deriveDetailView,
  errorSummary,
  hasErrors,
  isEditable,
  reimburseRefusalMessage,
  saveButtonLabel,
  saveCtaLabel,
  showsCategoryPicker,
  showsDelete,
  showsEditCta,
  showsEmployeePicker,
  showsMarkReimbursed,
  validateExpense,
  writeRefusalMessage,
  type DetailViewInput,
} from './expenseDetail.view';
import type { ExpenseFormState } from './expenseDetail.model';

const base: DetailViewInput = {
  mode: 'view',
  loading: false,
  saving: false,
  hasError: false,
  hasItem: true,
};

const form: ExpenseFormState = {
  title: 'CCTV repair',
  category: 'MAINTENANCE_REPAIR',
  amount: '3200',
  paymentMethod: 'UPI',
  vendorName: '',
  recurrence: 'NONE',
  date: '2026-08-04',
  time: '17:10',
  reimbursable: false,
  paidByEmployeeId: null,
  notes: '',
  files: [],
};

describe('deriveDetailView', () => {
  it('puts SAVING ahead of everything, so a save cannot be hidden by a stale error', () => {
    expect(deriveDetailView({ ...base, saving: true, hasError: true })).toBe('SAVING');
  });

  it('never loads in add mode, because there is nothing to fetch', () => {
    expect(deriveDetailView({ ...base, mode: 'add', hasItem: false, loading: true })).toBe('READY');
  });

  it('waits for the record in view and edit', () => {
    expect(deriveDetailView({ ...base, hasItem: false })).toBe('LOADING');
    expect(deriveDetailView({ ...base, mode: 'edit', hasItem: false })).toBe('LOADING');
    expect(deriveDetailView(base)).toBe('READY');
  });
});

describe('mode gates', () => {
  it('makes fields inputs in BOTH writing modes', () => {
    expect(isEditable('add')).toBe(true);
    expect(isEditable('edit')).toBe(true);
    expect(isEditable('view')).toBe(false);
  });

  it('HAS an edit affordance — unlike every stock-ops screen', () => {
    // Consumption, wastage and stock transfer all return false from a function of this name,
    // because changing one means re-running a stock movement. An expense moves no stock.
    expect(showsEditCta('view')).toBe(true);
    expect(showsEditCta('add')).toBe(false);
    expect(showsEditCta('edit')).toBe(false);
  });

  it('offers Delete only on a saved record', () => {
    expect(showsDelete('view')).toBe(true);
    expect(showsDelete('add')).toBe(false);
    expect(showsDelete('edit')).toBe(false);
  });

  it('offers Mark reimbursed for exactly the PENDING state', () => {
    // The server 409s for the other two, so this gate keeps a reachable refusal off the screen
    // rather than leaving it to the error path.
    const pending = { reimbursable: true, reimbursed: false };
    expect(showsMarkReimbursed('view', pending)).toBe(true);
    expect(showsMarkReimbursed('view', { reimbursable: true, reimbursed: true })).toBe(false);
    expect(showsMarkReimbursed('view', { reimbursable: false, reimbursed: false })).toBe(false);
    expect(showsMarkReimbursed('edit', pending)).toBe(false);
    expect(showsMarkReimbursed('view', null)).toBe(false);
  });

  it('reveals the employee picker from the TOGGLE, not the saved record', () => {
    expect(showsEmployeePicker({ reimbursable: true })).toBe(true);
    expect(showsEmployeePicker({ reimbursable: false })).toBe(false);
  });

  it('hides the category picker when the feature is off, because the server rewrites the value', () => {
    // Category is silently coerced to OTHER on create AND update when the feature is off — showing
    // the picker would display a choice the server discards.
    expect(showsCategoryPicker(true)).toBe(true);
    expect(showsCategoryPicker(false)).toBe(false);
  });
});

describe('app-bar copy', () => {
  it('names the action while writing and the expense once saved', () => {
    expect(appBarTitle('add', null)).toBe('Record Expense');
    expect(appBarTitle('edit', { title: 'CCTV repair' })).toBe('Edit Expense');
    expect(appBarTitle('view', { title: 'CCTV repair' })).toBe('CCTV repair');
    // Never a nameless bar.
    expect(appBarTitle('view', { title: '  ' })).toBe('Expense');
    expect(appBarTitle('view', null)).toBe('Expense');
  });

  it('tells an editor WHEN the record was made — the one fact the form does not show', () => {
    expect(appBarSubtitle('add', null)).toBe('Log a business expense');
    expect(appBarSubtitle('edit', { createdAt: '2026-08-04T11:40:00.000Z' })).toMatch(
      /^Editing · recorded \d{2} [A-Z][a-z]{2} \d{4}$/,
    );
    // A record with no createdAt still gets a coherent line.
    expect(appBarSubtitle('edit', {})).toBe('Editing');
    expect(appBarSubtitle('view', {})).toBe('');
  });

  it('labels the save action for what it does in each mode', () => {
    expect(saveCtaLabel('add')).toBe('Record');
    expect(saveCtaLabel('edit')).toBe('Save');
    expect(saveButtonLabel('add')).toBe('Record expense');
    expect(saveButtonLabel('edit')).toBe('Save changes');
  });
});

describe('refusal copy', () => {
  it('words a 409 as "already reimbursed", not as a failure', () => {
    // Reachable by two taps on one row, or two devices. "Could not mark reimbursed" is the wrong
    // thing to say about a row that already is.
    expect(reimburseRefusalMessage('STATE_CONFLICT', null)).toBe(
      'This expense has already been reimbursed.',
    );
    // The server's own sentence wins when it sent one — it names the expense.
    expect(reimburseRefusalMessage('STATE_CONFLICT', 'Expense 7 is already reimbursed')).toBe(
      'Expense 7 is already reimbursed',
    );
    expect(reimburseRefusalMessage(undefined, null)).toBe(
      'Could not mark this expense reimbursed.',
    );
  });

  it('tells the two 403s apart — they need different actions from the user', () => {
    expect(writeRefusalMessage('TAB_DISABLED', null)).toMatch(/turned off for this business/);
    expect(writeRefusalMessage('FEATURE_DISABLED', null)).toMatch(/Staff reimbursement/);
    expect(writeRefusalMessage('BUSINESS_NOT_ACTIVATED', null)).toMatch(/not active yet/);
    expect(writeRefusalMessage(undefined, 'boom')).toBe('boom');
    expect(writeRefusalMessage(undefined, null)).toBe('Could not save this expense.');
  });
});

describe('validateExpense', () => {
  it('passes a filled-in form', () => {
    expect(validateExpense(form)).toEqual({});
  });

  it('demands a title', () => {
    expect(validateExpense({ ...form, title: '' }).title).toBe('Give the expense a title');
    expect(validateExpense({ ...form, title: '   ' }).title).toBe('Give the expense a title');
  });

  it('caps the title at the COLUMN width — over it is a 500, not a 400', () => {
    // No @Size server-side, so an over-long title reaches the DB and throws at flush.
    expect(validateExpense({ ...form, title: 'x'.repeat(TITLE_MAX) }).title).toBeUndefined();
    expect(validateExpense({ ...form, title: 'x'.repeat(TITLE_MAX + 1) }).title).toMatch(/255/);
  });

  it('separates "no amount" from "not a number" from "not positive"', () => {
    expect(validateExpense({ ...form, amount: '' }).amount).toBe('Enter an amount');
    expect(validateExpense({ ...form, amount: 'abc' }).amount).toBe('Enter a number');
    expect(validateExpense({ ...form, amount: '0' }).amount).toBe('Amount must be more than zero');
    expect(validateExpense({ ...form, amount: '-5' }).amount).toBe('Amount must be more than zero');
    expect(validateExpense({ ...form, amount: '0.01' }).amount).toBeUndefined();
  });

  it('requires an employee when reimbursable is on — the server does NOT enforce the pairing', () => {
    // The feature gate keys off the id, not the boolean, so the server would accept a reimbursable
    // expense with nobody to reimburse. That is unactionable rather than wrong, so it is refused
    // here.
    expect(validateExpense({ ...form, reimbursable: true }).paidByEmployeeId).toBe(
      'Choose who to reimburse',
    );
    expect(
      validateExpense({ ...form, reimbursable: true, paidByEmployeeId: 42 }).paidByEmployeeId,
    ).toBeUndefined();
    // And not when the toggle is off, even with a stale id.
    expect(
      validateExpense({ ...form, reimbursable: false, paidByEmployeeId: null }).paidByEmployeeId,
    ).toBeUndefined();
  });

  it('has NO date rule — the server runs none, and a back-dated expense is legitimate', () => {
    // Unlike consumption's consumedAt, expenseDate has no server-side validation at all. A rent
    // payment dated the 1st and entered on the 9th must save.
    expect(validateExpense({ ...form, date: '2020-01-01' })).toEqual({});
    expect(validateExpense({ ...form, date: '2099-01-01' })).toEqual({});
  });
});

describe('error helpers', () => {
  it('reports emptiness and names the first offender', () => {
    expect(hasErrors({})).toBe(false);
    expect(errorSummary({})).toBeNull();
    expect(hasErrors({ title: 'Give the expense a title' })).toBe(true);
    expect(errorSummary({ title: 'Give the expense a title', amount: 'Enter an amount' })).toBe(
      'Give the expense a title',
    );
  });
});
