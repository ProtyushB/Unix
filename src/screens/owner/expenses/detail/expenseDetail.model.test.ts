import {
  buildCreatePayload,
  buildUpdatePayload,
  emptyForm,
  enteredAmount,
  toFormState,
  type ExpenseFormState,
} from './expenseDetail.model';

const form: ExpenseFormState = {
  title: '  CCTV repair  ',
  category: 'MAINTENANCE_REPAIR',
  amount: '3200',
  paymentMethod: 'UPI',
  vendorName: '  SecureTech ',
  recurrence: 'MONTHLY',
  date: '2026-08-04',
  time: '17:10',
  reimbursable: true,
  paidByEmployeeId: 42,
  notes: '  Front-door camera replaced ',
  files: [{ dmsFileId: 9, fileName: 'cctv.jpg' }],
};

describe('emptyForm', () => {
  it('defaults the category to OTHER, matching the server’s own fallback', () => {
    // The field is required server-side, so an unset dropdown on a form the user may not have
    // scrolled to is a refusal waiting to happen. OTHER is also what the server coerces to when the
    // category feature is off, so the default and the fallback agree.
    const f = emptyForm('2026-08-09', '14:30');
    expect(f.category).toBe('OTHER');
    expect(f.recurrence).toBe('NONE');
    expect(f.reimbursable).toBe(false);
    expect(f.paidByEmployeeId).toBeNull();
    expect(f.files).toEqual([]);
    expect(f.date).toBe('2026-08-09');
    expect(f.time).toBe('14:30');
  });
});

describe('toFormState', () => {
  it('splits the stored INSTANT into the IST date and time the controls edit', () => {
    // 11:40Z is 17:10 IST — the two controls must show the wall clock the user typed, not UTC.
    const f = toFormState({ expenseDate: '2026-08-04T11:40:00.000Z' });
    expect(f.date).toBe('2026-08-04');
    expect(f.time).toBe('17:10');
  });

  it('coalesces a NULL recurrence to NONE', () => {
    // The column is nullable and rows predating it were not backfilled, so null is a value real
    // records carry. Leaving it null would send `undefined` on the next save, which
    // JSON.stringify drops entirely.
    expect(toFormState({}).recurrence).toBe('NONE');
    expect(toFormState({ recurrence: null }).recurrence).toBe('NONE');
    expect(toFormState({ recurrence: 'QUARTERLY' }).recurrence).toBe('QUARTERLY');
  });

  it('keeps the amount as text so a half-typed value survives a render', () => {
    expect(toFormState({ amount: 3200 }).amount).toBe('3200');
    expect(toFormState({}).amount).toBe('');
  });

  it('COPIES the files array rather than aliasing the record’s', () => {
    const files = [{ dmsFileId: 1 }];
    const f = toFormState({ files });
    expect(f.files).toEqual(files);
    expect(f.files).not.toBe(files);
  });

  it('survives a null record', () => {
    expect(toFormState(null).title).toBe('');
    expect(toFormState(undefined).files).toEqual([]);
  });
});

describe('enteredAmount', () => {
  it('reads the typed text, and answers 0 for anything unusable', () => {
    expect(enteredAmount({ ...form, amount: '3200' })).toBe(3200);
    expect(enteredAmount({ ...form, amount: ' 12.5 ' })).toBe(12.5);
    expect(enteredAmount({ ...form, amount: '' })).toBe(0);
    expect(enteredAmount({ ...form, amount: 'abc' })).toBe(0);
  });
});

describe('buildCreatePayload', () => {
  it('NEVER emits the reimbursement or server-stamped keys', () => {
    // The trap: recordExpense does not clear reimbursed/reimbursedAt/reimbursedBy and the mapper
    // copies them through, so a create carrying them persists an already-settled expense and skips
    // both of markReimbursed's eligibility checks. Only the UPDATE funnel is hardened server-side.
    const keys = Object.keys(buildCreatePayload(form, 3));
    for (const forbidden of ['reimbursed', 'reimbursedAt', 'reimbursedBy', 'createdAt', 'id']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('sends the expenseDate as an INSTANT with an offset', () => {
    // expenseDate binds as Instant; a zone-less value cannot be parsed and answers 500.
    expect(buildCreatePayload(form, 3).expenseDate).toBe('2026-08-04T17:10:00+05:30');
  });

  it('trims text and turns blanks into null, never empty strings', () => {
    const p = buildCreatePayload(form, 3);
    expect(p.title).toBe('CCTV repair');
    expect(p.vendorName).toBe('SecureTech');
    expect(p.notes).toBe('Front-door camera replaced');

    const blank = buildCreatePayload({ ...form, vendorName: '   ', notes: '' }, 3);
    expect(blank.vendorName).toBeNull();
    expect(blank.notes).toBeNull();
  });

  it('NULLS the employee when reimbursable is off', () => {
    // The REIMBURSEMENT feature gate keys off paidByEmployeeId, NOT the boolean — so a stale id
    // left behind would 403 an expense the user never marked reimbursable.
    const off = buildCreatePayload({ ...form, reimbursable: false }, 3);
    expect(off.reimbursable).toBe(false);
    expect(off.paidByEmployeeId).toBeNull();

    const on = buildCreatePayload(form, 3);
    expect(on.paidByEmployeeId).toBe(42);
  });

  it('sends NONE rather than omitting the recurrence', () => {
    expect(buildCreatePayload({ ...form, recurrence: 'NONE' }, 3).recurrence).toBe('NONE');
  });

  it('sends a null date when no day was picked, which means "stamp it now"', () => {
    expect(buildCreatePayload({ ...form, date: '' }, 3).expenseDate).toBeNull();
  });

  it('carries the businessId it was given', () => {
    expect(buildCreatePayload(form, 3).businessId).toBe(3);
  });
});

describe('buildUpdatePayload', () => {
  it('ALWAYS carries files — omitting them erases every receipt, silently, with a 200', () => {
    // The server replaces the collection and writes an empty list when the key is absent. This is
    // the single most damaging way to get this payload wrong.
    const p = buildUpdatePayload(form, 3, 7);
    expect(Object.keys(p)).toContain('files');
    expect(p.files).toEqual([{ dmsFileId: 9, fileName: 'cctv.jpg' }]);

    // And an emptied list is a legitimate value — the user removed them all — not an omission.
    const cleared = buildUpdatePayload({ ...form, files: [] }, 3, 7);
    expect(cleared.files).toEqual([]);
    expect(Object.keys(cleared)).toContain('files');
  });

  it('carries the id AND the businessId, though the server ignores the latter', () => {
    // Ignored by the update funnel but still @NotNull @Positive: omitting it is a 400 naming a
    // field the user cannot see.
    const p = buildUpdatePayload(form, 3, 7);
    expect(p.id).toBe(7);
    expect(p.businessId).toBe(3);
  });

  it('still emits none of the reimbursement keys', () => {
    const keys = Object.keys(buildUpdatePayload(form, 3, 7));
    for (const forbidden of ['reimbursed', 'reimbursedAt', 'reimbursedBy', 'createdAt']) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
