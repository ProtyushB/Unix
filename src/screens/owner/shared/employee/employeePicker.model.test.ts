import {
  employeeMetaLine,
  employeeName,
  filterEmployees,
  toEmployeeOption,
  toEmployeeOptions,
  type EmployeeOption,
} from './employeePicker.model';

describe('toEmployeeOption', () => {
  it('prefers the server-computed name', () => {
    expect(toEmployeeOption({ id: 4, name: 'Priya Sharma', firstName: 'X' }).name).toBe(
      'Priya Sharma',
    );
  });

  it('falls back to first + last, then to the id — never to a blank', () => {
    // A nameless row is unpickable in practice: there is nothing for the user to recognise.
    expect(toEmployeeOption({ id: 4, firstName: 'Priya', lastName: 'Sharma' }).name).toBe(
      'Priya Sharma',
    );
    expect(toEmployeeOption({ id: 4, firstName: 'Priya' }).name).toBe('Priya');
    expect(toEmployeeOption({ id: 4 }).name).toBe('Employee #4');
    expect(toEmployeeOption({ id: 4, name: '   ' }).name).toBe('Employee #4');
  });

  it('joins roles into one line and tolerates the field being absent', () => {
    expect(toEmployeeOption({ id: 4, roles: ['Stylist', 'Manager'] }).roles).toBe(
      'Stylist, Manager',
    );
    expect(toEmployeeOption({ id: 4 }).roles).toBe('');
    expect(toEmployeeOption({ id: 4, roles: [] }).roles).toBe('');
  });
});

describe('toEmployeeOptions', () => {
  it('drops rows with no usable id, because a pick on one would silently do nothing', () => {
    const rows = toEmployeeOptions([
      { id: 4, name: 'Priya' },
      { id: 0, name: 'Zero' },
      { id: NaN, name: 'Not a number' },
      { name: 'No id at all' } as never,
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Priya']);
  });

  it('handles a null list', () => {
    expect(toEmployeeOptions(null)).toEqual([]);
    expect(toEmployeeOptions(undefined)).toEqual([]);
  });
});

describe('filterEmployees', () => {
  const OPTIONS: EmployeeOption[] = [
    { id: 1, name: 'Priya Sharma', email: 'priya@salon.com', roles: 'Stylist' },
    { id: 2, name: 'Aman Kumar', email: 'aman@salon.com', roles: 'Manager' },
    { id: 3, name: 'Riya Singh', email: 'riya@salon.com', roles: 'Therapist' },
  ];

  it('returns the SAME array when blank, so an untouched box allocates nothing', () => {
    expect(filterEmployees(OPTIONS, '')).toBe(OPTIONS);
    expect(filterEmployees(OPTIONS, '  ')).toBe(OPTIONS);
    expect(filterEmployees(OPTIONS, null)).toBe(OPTIONS);
  });

  it('matches name, email OR role — exactly what the search box promises', () => {
    expect(filterEmployees(OPTIONS, 'priya').map((o) => o.id)).toEqual([1]);
    expect(filterEmployees(OPTIONS, 'aman@').map((o) => o.id)).toEqual([2]);
    expect(filterEmployees(OPTIONS, 'therapist').map((o) => o.id)).toEqual([3]);
  });

  it('is case-insensitive and trimmed', () => {
    expect(filterEmployees(OPTIONS, '  MANAGER ').map((o) => o.id)).toEqual([2]);
  });

  it('matches several rows on a shared substring', () => {
    expect(filterEmployees(OPTIONS, 'salon.com').map((o) => o.id)).toEqual([1, 2, 3]);
    expect(filterEmployees(OPTIONS, 'iya').map((o) => o.id)).toEqual([1, 3]);
  });
});

describe('employeeMetaLine', () => {
  it('joins email and roles, and drops the separator when one is missing', () => {
    expect(employeeMetaLine({ id: 1, name: 'P', email: 'p@x.com', roles: 'Stylist' })).toBe(
      'p@x.com · Stylist',
    );
    expect(employeeMetaLine({ id: 1, name: 'P', email: '', roles: 'Stylist' })).toBe('Stylist');
    expect(employeeMetaLine({ id: 1, name: 'P', email: 'p@x.com', roles: '' })).toBe('p@x.com');
    expect(employeeMetaLine({ id: 1, name: 'P', email: '', roles: '' })).toBe('');
  });
});

describe('employeeName', () => {
  const OPTIONS: EmployeeOption[] = [
    { id: 1, name: 'Priya Sharma', email: '', roles: '' },
  ];

  it('resolves a stored id to the name', () => {
    expect(employeeName(1, OPTIONS)).toBe('Priya Sharma');
  });

  it('names an id that is no longer in the list rather than showing nothing', () => {
    // Real case: the list is ACTIVE staff only, so an expense reimbursing someone who has since
    // left resolves to nothing. Blank would read as "no one was chosen", which is a different and
    // wrong statement about a settled reimbursement.
    expect(employeeName(99, OPTIONS)).toBe('Employee #99');
  });

  it('returns null when no one is chosen, which is not the same as an unknown id', () => {
    expect(employeeName(null, OPTIONS)).toBeNull();
    expect(employeeName(undefined, OPTIONS)).toBeNull();
  });
});
