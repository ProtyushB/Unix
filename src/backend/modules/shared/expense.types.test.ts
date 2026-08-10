import {
  DEFAULT_EXPENSE_SORT,
  EXPENSE_CATEGORIES,
  EXPENSE_RECURRENCES,
  EXPENSE_SORT_KEYS,
  PAYMENT_METHODS,
  categoryLabel,
  isExpenseCategory,
  isExpenseRecurrence,
  isExpenseSortKey,
  isPaymentMethod,
  paymentMethodLabel,
  recurrenceLabel,
  reimbursementState,
  type ExpensePayload,
  type ExpenseUpdatePayload,
} from './expense.types';

describe('EXPENSE_CATEGORIES', () => {
  it('carries exactly the fifteen server values', () => {
    // Membership is the server's DB CHECK constraint. A sixteenth here without a migration is a
    // 500 at flush, not a validation error.
    expect(EXPENSE_CATEGORIES.map((c) => c.value).sort()).toEqual([
      'BANK_FEES',
      'CLEANING_HYGIENE',
      'INSURANCE',
      'LICENSES_FEES',
      'MAINTENANCE_REPAIR',
      'MARKETING_ADVERTISING',
      'OFFICE_SUPPLIES',
      'OTHER',
      'PROFESSIONAL_SERVICES',
      'RENT_LEASE',
      'STAFF_WELFARE',
      'TAXES',
      'TRAINING_DEVELOPMENT',
      'TRANSPORT_FUEL',
      'UTILITIES',
    ]);
  });

  it('keeps the server declaration order, ending with OTHER', () => {
    expect(EXPENSE_CATEGORIES[0].value).toBe('MAINTENANCE_REPAIR');
    expect(EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1].value).toBe('OTHER');
  });

  it('labels the ampersand categories in full — the shorter forms are a different category', () => {
    // "Maintenance" and "Cleaning" are not members; rendering those would name a bucket that does
    // not exist and cannot be filtered to.
    expect(categoryLabel('MAINTENANCE_REPAIR')).toBe('Maintenance & Repair');
    expect(categoryLabel('CLEANING_HYGIENE')).toBe('Cleaning & Hygiene');
    expect(categoryLabel('MARKETING_ADVERTISING')).toBe('Marketing & Advertising');
  });

  it('falls back to the raw value so an unknown member still renders', () => {
    expect(categoryLabel('FUTURE_BUCKET')).toBe('FUTURE_BUCKET');
    expect(categoryLabel(null)).toBe('');
  });

  it('guards membership, because a bad enum is a 500 rather than a 400', () => {
    expect(isExpenseCategory('UTILITIES')).toBe(true);
    expect(isExpenseCategory('utilities')).toBe(false);
    expect(isExpenseCategory('FOOD')).toBe(false);
    expect(isExpenseCategory(null)).toBe(false);
  });
});

describe('PAYMENT_METHODS', () => {
  it('carries exactly the five server values and NO blank member', () => {
    // Centrix carries a { value: '' } placeholder for its Listbox; an empty string is not a member
    // and would be a 500. Absence is modelled as null here instead.
    expect(PAYMENT_METHODS.map((p) => p.value)).toEqual([
      'CASH',
      'CARD',
      'UPI',
      'NET_BANKING',
      'WALLET',
    ]);
    expect(isPaymentMethod('')).toBe(false);
  });

  it('renders absence as a dash, so the row keeps its shape', () => {
    expect(paymentMethodLabel('NET_BANKING')).toBe('Net Banking');
    expect(paymentMethodLabel(null)).toBe('—');
    expect(paymentMethodLabel('')).toBe('—');
  });
});

describe('EXPENSE_RECURRENCES', () => {
  it('carries exactly the six server values', () => {
    expect(EXPENSE_RECURRENCES.map((r) => r.value)).toEqual([
      'NONE',
      'DAILY',
      'WEEKLY',
      'MONTHLY',
      'QUARTERLY',
      'YEARLY',
    ]);
  });

  it('reads a NULL as "does not repeat" rather than blank', () => {
    // The column is nullable and rows written before it existed were deliberately not backfilled,
    // so null is a value a real row carries — not a missing field.
    expect(recurrenceLabel(null)).toBe("Doesn't repeat");
    expect(recurrenceLabel(undefined)).toBe("Doesn't repeat");
    expect(recurrenceLabel('')).toBe("Doesn't repeat");
    expect(recurrenceLabel('NONE')).toBe("Doesn't repeat");
  });

  it('labels the real repeat intervals', () => {
    expect(recurrenceLabel('MONTHLY')).toBe('Every month');
    expect(recurrenceLabel('QUARTERLY')).toBe('Every quarter');
  });

  it('guards membership', () => {
    expect(isExpenseRecurrence('MONTHLY')).toBe(true);
    expect(isExpenseRecurrence('FORTNIGHTLY')).toBe(false);
    expect(isExpenseRecurrence(null)).toBe(false);
  });
});

describe('EXPENSE_SORT_KEYS', () => {
  it('carries exactly the six whitelisted fields', () => {
    expect([...EXPENSE_SORT_KEYS]).toEqual([
      'id',
      'expenseDate',
      'title',
      'category',
      'amount',
      'vendorName',
    ]);
    expect(DEFAULT_EXPENSE_SORT).toBe('expenseDate');
  });

  it('is CASE-SENSITIVE — the server does a plain Set.contains', () => {
    // A miscased key is not an error server-side; it silently sorts by expenseDate instead, so the
    // list looks sorted by something it is not. Catching it here is the only place it shows up.
    expect(isExpenseSortKey('expenseDate')).toBe(true);
    expect(isExpenseSortKey('expensedate')).toBe(false);
    expect(isExpenseSortKey('EXPENSEDATE')).toBe(false);
  });

  it('has no reimbursement key, because the pill is derived and never sortable', () => {
    expect(isExpenseSortKey('reimbursed')).toBe(false);
    expect(isExpenseSortKey('reimbursable')).toBe(false);
  });
});

describe('reimbursementState', () => {
  it('separates "not reimbursable" from "pending" — they are not the same row', () => {
    // The trap this exists to prevent: treating !reimbursed as pending would put every ordinary
    // company-paid expense into the reimbursement queue.
    expect(reimbursementState({ reimbursable: false, reimbursed: false })).toBe('NOT_REIMBURSABLE');
    expect(reimbursementState({ reimbursable: true, reimbursed: false })).toBe('PENDING');
    expect(reimbursementState({ reimbursable: true, reimbursed: true })).toBe('SETTLED');
  });

  it('treats a missing flag as not reimbursable rather than guessing', () => {
    expect(reimbursementState({})).toBe('NOT_REIMBURSABLE');
    expect(reimbursementState({ reimbursable: null, reimbursed: null })).toBe('NOT_REIMBURSABLE');
  });

  it('ignores a stray reimbursed=true on a non-reimbursable row', () => {
    // The server does not forbid this combination (flipping reimbursable back to false on a settled
    // row is unguarded), so the client must not render such a row as settled.
    expect(reimbursementState({ reimbursable: false, reimbursed: true })).toBe('NOT_REIMBURSABLE');
  });
});

describe('the payload contracts', () => {
  it('has no reimbursement keys on create — they would bypass the settle workflow', () => {
    // recordExpense never clears these and the mapper copies them through, so a POST carrying
    // reimbursed:true persists a settled expense without either eligibility check running.
    //
    // This assertion is the @ts-expect-error lines, not the expect() below: each one FAILS
    // TYPECHECK if the key is ever added to ExpensePayload (an unused @ts-expect-error is itself
    // an error), so `npm run typecheck` is what enforces it. The runtime body just needs the object
    // to exist. The equivalent runtime guarantee — that the BUILDER never emits these keys — is
    // pinned separately by an Object.keys test on buildCreatePayload.
    const payload: ExpensePayload = {
      businessId: 1,
      title: 'March electricity bill',
      category: 'UTILITIES',
      amount: 8450,
    };
    // @ts-expect-error — reimbursed is not on the create payload, and must not be.
    payload.reimbursed = true;
    // @ts-expect-error — reimbursedAt is server-stamped by markReimbursed.
    payload.reimbursedAt = '2026-08-09T00:00:00Z';
    // @ts-expect-error — reimbursedBy is server-stamped by markReimbursed.
    payload.reimbursedBy = 42;
    // @ts-expect-error — createdAt is server-stamped by @PrePersist and discarded if sent.
    payload.createdAt = '2026-08-09T00:00:00Z';
    // @ts-expect-error — an id belongs to the update payload only.
    payload.id = 7;

    expect(payload.title).toBe('March electricity bill');
  });

  it('carries businessId on update even though the server ignores it', () => {
    // Ignored by the update funnel but still @NotNull @Positive, so omitting it is a 400 naming a
    // field the user never sees.
    const update: ExpenseUpdatePayload = {
      id: 7,
      businessId: 1,
      title: 'CCTV repair',
      category: 'MAINTENANCE_REPAIR',
      amount: 3200,
      files: [],
    };
    expect(update.businessId).toBe(1);
    // files present-and-empty is meaningful: absent would ERASE the receipts, not leave them.
    expect(update.files).toEqual([]);
  });
});
