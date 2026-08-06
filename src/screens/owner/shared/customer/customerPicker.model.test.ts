import {
  canCreate,
  canSearch,
  contactLine,
  eligibilityLabel,
  eligibilityTone,
  fullName,
  initialsOf,
  matchLabel,
  resultsBanner,
  toCustomerMatches,
  toCustomerOption,
  toCustomerOptions,
  validateNewCustomer,
  viewAfterCancelCreate,
  viewAfterSearch,
} from './customerPicker.model';

describe('toCustomerOption', () => {
  it('reads the id from personId, because the customers list has no `id`', () => {
    // The single most likely way to break this picker: `/businesses/{id}/customers` returns a
    // projection over Person, and it keys the id as `personId`. Verified against live — the row has
    // ten keys and `id` is not one of them.
    const option = toCustomerOption({ personId: 7, firstName: 'Anjali', lastName: 'Rao' });
    expect(option?.id).toBe(7);
  });

  it('reads the id from `id` for a PersonDto, which is what lookup and create return', () => {
    expect(toCustomerOption({ id: 9, firstName: 'Rahul' })?.id).toBe(9);
  });

  it('prefers personId when a row somehow carries both', () => {
    expect(toCustomerOption({ personId: 7, id: 99, firstName: 'A' })?.id).toBe(7);
  });

  it('drops a row with no usable id rather than returning one that cannot be saved', () => {
    expect(toCustomerOption({ firstName: 'Ghost' })).toBeNull();
    expect(toCustomerOption(null)).toBeNull();
    expect(toCustomerOption({ personId: 'not-a-number', firstName: 'Ghost' })).toBeNull();
  });

  it('joins the two name halves and tolerates either being blank', () => {
    expect(toCustomerOption({ id: 1, firstName: 'Anjali', lastName: 'Rao' })?.name).toBe(
      'Anjali Rao',
    );
    expect(toCustomerOption({ id: 1, firstName: 'Anjali', lastName: '' })?.name).toBe('Anjali');
    expect(toCustomerOption({ id: 1, lastName: 'Rao' })?.name).toBe('Rao');
  });

  it('falls back to a contact detail when there is no name, so the row is never blank', () => {
    expect(toCustomerOption({ id: 1, email: 'a@b.com' })?.name).toBe('a@b.com');
    expect(toCustomerOption({ id: 1, phoneNumber: '+91 90000 12345' })?.name).toBe(
      '+91 90000 12345',
    );
    expect(toCustomerOption({ id: 12 })?.name).toBe('#12');
  });
});

describe('toCustomerOptions', () => {
  it('maps a page and skips the unusable rows', () => {
    const rows = [{ personId: 1, firstName: 'A' }, { firstName: 'no id' }, { personId: 2 }];
    expect(toCustomerOptions(rows).map((o) => o.id)).toEqual([1, 2]);
  });

  it('handles a non-array, which is what a failed response leaves behind', () => {
    expect(toCustomerOptions(undefined)).toEqual([]);
    expect(toCustomerOptions(null)).toEqual([]);
    expect(toCustomerOptions({})).toEqual([]);
  });
});

describe('toCustomerMatches', () => {
  const match = {
    person: { id: 4, firstName: 'Anjali', lastName: 'Rao', email: 'a@b.com', phoneNumber: '900' },
    matchedByEmail: true,
    matchedByPhone: true,
    existingCustomer: true,
  };

  it('carries the two things a plain option does not', () => {
    const [row] = toCustomerMatches([match]);
    expect(row).toEqual({
      id: 4,
      name: 'Anjali Rao',
      email: 'a@b.com',
      phone: '900',
      alreadyCustomer: true,
      matchedByEmail: true,
      matchedByPhone: true,
    });
  });

  it('dedupes by id — the same person can match on both fields', () => {
    expect(toCustomerMatches([match, match])).toHaveLength(1);
  });

  it('treats a missing flag as false rather than undefined', () => {
    const [row] = toCustomerMatches([{ person: { id: 4 } }]);
    expect(row.alreadyCustomer).toBe(false);
    expect(row.matchedByEmail).toBe(false);
    expect(row.matchedByPhone).toBe(false);
  });

  it('skips a match whose person carries no id', () => {
    expect(toCustomerMatches([{ person: { firstName: 'Ghost' } }])).toEqual([]);
    expect(toCustomerMatches([{}])).toEqual([]);
  });
});

describe('labels', () => {
  it('names which field matched, so two similar people can be told apart', () => {
    expect(matchLabel({ matchedByEmail: true, matchedByPhone: true })).toBe(
      'matched: email + phone',
    );
    expect(matchLabel({ matchedByEmail: true, matchedByPhone: false })).toBe('matched: email');
    expect(matchLabel({ matchedByEmail: false, matchedByPhone: true })).toBe('matched: phone');
    expect(matchLabel({ matchedByEmail: false, matchedByPhone: false })).toBe('');
  });

  it('distinguishes an existing customer from a stranger', () => {
    expect(eligibilityLabel({ alreadyCustomer: true })).toBe('Already your customer');
    expect(eligibilityLabel({ alreadyCustomer: false })).toBe('In Centrix · new to you');
    expect(eligibilityTone({ alreadyCustomer: true })).toBe('success');
    expect(eligibilityTone({ alreadyCustomer: false })).toBe('info');
  });

  it('builds the contact line from whichever halves exist', () => {
    expect(contactLine({ phone: '900', email: 'a@b.com' })).toBe('900 · a@b.com');
    expect(contactLine({ phone: '900', email: '' })).toBe('900');
    expect(contactLine({ phone: '', email: 'a@b.com' })).toBe('a@b.com');
    expect(contactLine({ phone: '', email: '' })).toBe('');
  });

  it('pluralises the results banner', () => {
    expect(resultsBanner(0)).toBe('No customer found in Centrix');
    expect(resultsBanner(1)).toBe('1 match in Centrix — pick the correct customer');
    expect(resultsBanner(2)).toBe('2 matches in Centrix — pick the correct customer');
  });

  it('initials: first + last, two letters for a single name, ? for nothing', () => {
    expect(initialsOf('Anjali Rao')).toBe('AR');
    expect(initialsOf('Priya')).toBe('PR');
    expect(initialsOf('Anjali Rao Sharma')).toBe('AS');
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('gates', () => {
  it('needs an email or a phone before the Centrix lookup can run', () => {
    expect(canSearch('', '')).toBe(false);
    expect(canSearch('   ', '  ')).toBe(false);
    expect(canSearch('a@b.com', '')).toBe(true);
    expect(canSearch('', '900')).toBe(true);
  });

  it('needs all three fields to create, matching the server', () => {
    expect(canCreate({ name: 'A', email: 'a@b.com', phone: '900' })).toBe(true);
    expect(canCreate({ name: '', email: 'a@b.com', phone: '900' })).toBe(false);
    expect(canCreate({ name: 'A', email: '', phone: '900' })).toBe(false);
    expect(canCreate({ name: 'A', email: 'a@b.com', phone: ' ' })).toBe(false);
  });

  it('validates with one message rather than per-field errors', () => {
    expect(validateNewCustomer({ name: 'A', email: 'a@b.com', phone: '900' })).toBeNull();
    expect(validateNewCustomer({ name: '', email: '', phone: '' })).toBe(
      'Name, email and phone are all required.',
    );
  });
});

describe('view machine', () => {
  it('sends a zero-hit search to `empty`, not back to the list', () => {
    expect(viewAfterSearch(0)).toBe('empty');
    expect(viewAfterSearch(2)).toBe('results');
  });

  it('returns from a cancelled create to wherever the search landed', () => {
    // Not to the list: the user got here by searching and rejecting the hits, so dropping them at
    // the top would make them do it again.
    expect(viewAfterCancelCreate(2)).toBe('results');
    expect(viewAfterCancelCreate(0)).toBe('empty');
  });
});

describe('fullName', () => {
  it('is blank when the row has neither half', () => {
    expect(fullName({})).toBe('');
  });
});
