import { emptyLine, helperLine, openingTab } from './addItemsSheet.view';

describe('openingTab', () => {
  it('opens on the records tab when the bill has a customer', () => {
    expect(openingTab(true)).toEqual({ top: 'RECORDS', kind: 'ORDER' });
  });

  it('opens on the catalog when the bill has nobody on it', () => {
    // The records tab is customer-scoped, so with no customer it can never fill. Opening there put
    // a dead end in front of the seller before they had done anything — and for a business with the
    // Customers module off, that was every bill it would ever write.
    expect(openingTab(false)).toEqual({ top: 'CATALOG', kind: 'PRODUCT' });
  });
});

describe('helperLine', () => {
  it("names the customer's records when there is one", () => {
    expect(helperLine('ORDER', true)).toBe("This customer's unbilled orders");
    expect(helperLine('APPOINTMENT', true)).toBe("This customer's unbilled appointments");
  });

  it('does not claim a customer when there is none', () => {
    expect(helperLine('ORDER', false)).not.toMatch(/this customer/i);
    expect(helperLine('APPOINTMENT', false)).not.toMatch(/this customer/i);
  });

  it('leaves the catalog captions alone — they never mentioned a customer', () => {
    expect(helperLine('PRODUCT', false)).toBe('Catalog — added as a bare line, or via a new order');
    expect(helperLine('PRODUCT', true)).toBe(helperLine('PRODUCT', false));
    expect(helperLine('SERVICE', true)).toBe(helperLine('SERVICE', false));
  });
});

describe('emptyLine', () => {
  it('names a customer who has nothing unbilled', () => {
    expect(emptyLine('ORDER', 'Sayak Das', true)).toBe('Sayak Das has no unbilled orders.');
    expect(emptyLine('APPOINTMENT', 'Sayak Das', true)).toBe(
      'Sayak Das has no unbilled appointments.',
    );
  });

  it('still falls back for a customer who exists but has no name', () => {
    // The original reason for the fallback, and it stays: a walk-in can be a real Person carrying
    // only a phone number.
    expect(emptyLine('ORDER', '', true)).toBe('This customer has no unbilled orders.');
  });

  it('says the bill has no customer rather than inventing one', () => {
    // The bug. `customerName || 'This customer'` answered "who is this?" when the question was
    // "is there anyone?", so a counter sale read as a named person with an empty history.
    expect(emptyLine('ORDER', '', false)).toBe(
      'This bill has no customer, so there are no orders to pull in.',
    );
    expect(emptyLine('APPOINTMENT', '', false)).toBe(
      'This bill has no customer, so there are no appointments to pull in.',
    );
  });

  it('never says "this customer" when there is not one', () => {
    expect(emptyLine('ORDER', '', false)).not.toMatch(/this customer/i);
    expect(emptyLine('APPOINTMENT', '', false)).not.toMatch(/this customer/i);
  });

  it('leaves the catalog empty states alone', () => {
    expect(emptyLine('PRODUCT', '', false)).toBe('No products in this catalog yet.');
    expect(emptyLine('SERVICE', '', false)).toBe('No services in this catalog yet.');
  });
});
