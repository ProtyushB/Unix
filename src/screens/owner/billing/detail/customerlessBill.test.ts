/**
 * A bill, order or appointment that belongs to nobody.
 *
 * Since V121 `customer_id` is nullable on all six tables, so a counter sale is a real record rather
 * than a thing the seller has to invent a Person for. Unix refused it on both sides: the module
 * services threw before the request left the device, and the three form validators refused before
 * that.
 *
 * The bill payload is the subtle half. `customerId` was already `number | null` and travelled
 * correctly, but `customerPhone` was sent unconditionally as `form.customerPhone.trim()` — an empty
 * string for a counter sale, where the web omits the key and the column ends up NULL. Two clients
 * writing different things for the same state is the bug; the phone belongs to a customer or to no
 * one, so the two keys travel together.
 */
import { toFormState, buildBillPayload, type BillFormState } from './billDetail.model';
import { newBareLine } from './billLines';
import { hasErrors, validateBill } from './billDetail.view';

/** An empty bill with one line, and deliberately nobody on it. */
const form = (over: Partial<BillFormState> = {}): BillFormState => ({
  ...toFormState(null),
  customerId: null,
  customerPhone: '',
  billDate: '2026-08-19',
  lines: [newBareLine('PRODUCT', 77, 'Face Serum', 600, 2)],
  ...over,
});

/** What actually crosses the wire — undefined keys do not survive JSON. */
const wire = (payload: Record<string, unknown>) => JSON.parse(JSON.stringify(payload));

describe('a bill with no customer', () => {
  it('drops customerId AND customerPhone rather than sending null and an empty string', () => {
    const sent = wire(buildBillPayload(form(), 3));

    expect('customerId' in sent).toBe(false);
    expect('customerPhone' in sent).toBe(false);
    expect(sent.businessId).toBe(3);
  });

  it('still sends both when there is a customer', () => {
    const sent = wire(
      buildBillPayload(form({ customerId: 7, customerPhone: ' 9876543210 ' }), 3),
    );

    expect(sent.customerId).toBe(7);
    expect(sent.customerPhone).toBe('9876543210');
  });

  it('validates with neither a customer nor a phone', () => {
    // The phone check was the one that hid: it would have kept refusing on its own.
    expect(hasErrors(validateBill(form()))).toBe(false);
  });
});
