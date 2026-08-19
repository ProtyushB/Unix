import { customerPickable, showsCustomerCard } from './customerGate';

describe('showsCustomerCard', () => {
  it('offers the customer when the module is on', () => {
    expect(showsCustomerCard(true, false)).toBe(true);
    expect(showsCustomerCard(true, true)).toBe(true);
  });

  it('hides it entirely when the module is off and the record has nobody', () => {
    // The whole point. A Customers-off business could not save a bill, order or appointment at all,
    // because the control it was being asked to fill pointed at a tab that is not there.
    expect(showsCustomerCard(false, false)).toBe(false);
  });

  it('still shows a customer the record already carries', () => {
    // Booked before the module was switched off, or created on another client. Hiding a fact is not
    // the same as removing a choice.
    expect(showsCustomerCard(false, true)).toBe(true);
  });
});

describe('customerPickable', () => {
  it('opens the picker only when the screen is editable and the module is on', () => {
    expect(customerPickable(true, true)).toBe(true);
  });

  it('stays shut in read mode', () => {
    expect(customerPickable(false, true)).toBe(false);
  });

  it('stays shut with the module off, even while editing', () => {
    // The card may still be on screen showing an existing customer — but there is nothing to pick
    // from, so tapping it would open an empty sheet.
    expect(customerPickable(true, false)).toBe(false);
    expect(customerPickable(false, false)).toBe(false);
  });
});
