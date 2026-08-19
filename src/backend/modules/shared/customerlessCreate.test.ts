/**
 * The module services must let a counter sale through.
 *
 * `createOrder` and `createAppointment` on both parlour and pharmacy threw
 * `'Customer ID and Business ID are required'` before the request ever left the device. That was
 * right while `customer_id` was NOT NULL; V121 made it nullable on all six tables, so the throw
 * became the only thing still refusing a walk-up sale.
 *
 * The business is a different matter and stays required — a record has to belong to a business, and
 * nothing downstream can guess which one.
 *
 * The get-by-customer lookups in the same files (`getOrdersByCustomer`, `getBillableAppointments`
 * and friends) take a customerId as an ARGUMENT and are correct to demand one; they are deliberately
 * not touched here.
 */
import { ParlourService } from '../parlour/service/parlour.service';
import { PharmacyService } from '../pharmacy/service/pharmacy.service';

/** Just enough of the api interface for the four calls under test. */
const stubApi = () =>
  ({
    createOrder: jest.fn().mockResolvedValue({ id: 1 }),
    createAppointment: jest.fn().mockResolvedValue({ id: 2 }),
  }) as never;

describe.each([
  ['parlour', (api: never) => new ParlourService(api)],
  ['pharmacy', (api: never) => new PharmacyService(api)],
])('%s service — creating without a customer', (_name, make) => {
  it('creates an order with no customer', async () => {
    const api = stubApi();
    const payload = { businessId: 3, orderItems: [{ productId: 9 }] };

    await make(api).createOrder(payload);

    expect((api as unknown as { createOrder: jest.Mock }).createOrder).toHaveBeenCalledWith(payload);
  });

  it('creates an appointment with no customer', async () => {
    const api = stubApi();
    const payload = {
      businessId: 3,
      appointmentDateTime: '2026-08-19T10:00:00',
      appointedServiceItems: [{ serviceId: 4 }],
    };

    await make(api).createAppointment(payload);

    expect(
      (api as unknown as { createAppointment: jest.Mock }).createAppointment,
    ).toHaveBeenCalledWith(payload);
  });

  it('still refuses an order with no business', async () => {
    const api = stubApi();

    await expect(make(api).createOrder({ orderItems: [{ productId: 9 }] })).rejects.toThrow(
      /Business ID is required/,
    );
    expect((api as unknown as { createOrder: jest.Mock }).createOrder).not.toHaveBeenCalled();
  });

  it('still refuses an appointment with no business', async () => {
    const api = stubApi();

    await expect(
      make(api).createAppointment({ appointmentDateTime: '2026-08-19T10:00:00' }),
    ).rejects.toThrow(/Business ID is required/);
  });
});

describe('parlour appointments keep the date requirement', () => {
  it('refuses an appointment with no date, which would be a 500 rather than a 400', async () => {
    const api = stubApi();

    await expect(new ParlourService(api).createAppointment({ businessId: 3 })).rejects.toThrow(
      /date and time is required/,
    );
  });
});
