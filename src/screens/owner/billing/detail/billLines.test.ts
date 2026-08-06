import {
  attachedIds,
  attachedLine,
  bareToWrite,
  newBareLine,
  toBillLines,
  toCustomProducts,
  toCustomServices,
} from './billLines';

/** A fetched bill with all three line kinds, shaped as the GET actually returns them. */
function serverBill(): Record<string, unknown> {
  return {
    id: 52,
    billNumber: 'BILL-05082026-014',
    billedOrderDetails: [
      {
        id: 94,
        orderNumber: 'ORD-05082026-042',
        orderDate: '2026-08-05T08:44:00Z',
        totalAmount: 626,
        orderedProductItemsWithDetails: [{ productId: 5 }, { productId: 9 }, { productId: 11 }],
      },
    ],
    billedAppointmentDetails: [
      {
        id: 12,
        appointmentNumber: 'APT-05082026-001',
        appointmentDate: '2026-08-05',
        totalAmount: 5000,
        appointmentItems: [{ serviceId: 21 }, { serviceId: 22 }],
      },
    ],
    bareProducts: [
      {
        refId: 77,
        name: 'Face Serum',
        quantity: 2,
        itemPrice: 600,
        totalPrice: 1200,
        discount: 0,
        personId: 2,
        sellingUnit: 'bottle',
        unitMultiplier: 1,
        unitLines: [{ unit: 'bottle', perStock: 1, qty: 2, price: 600 }],
        stockDeducted: true,
      },
    ],
    bareServices: [
      {
        refId: 21,
        name: 'Threading',
        quantity: 1,
        itemPrice: 250,
        totalPrice: 250,
        discount: 10,
        personId: 3,
      },
    ],
  };
}

describe('toBillLines', () => {
  it('flattens the three kinds in the drawn order: orders, appointments, then bare lines', () => {
    expect(toBillLines(serverBill()).map((l) => l.kind)).toEqual([
      'ORDER',
      'APPOINTMENT',
      'PRODUCT',
      'SERVICE',
    ]);
  });

  it('labels an order row the way the mockup does', () => {
    const [order] = toBillLines(serverBill());
    expect(order.label).toBe('ORD-05082026-042');
    expect(order.sublabel).toBe('Order · 5 Aug · 3 items');
    expect(order.amount).toBe(626);
  });

  it('labels an appointment row, counting services rather than items', () => {
    const appt = toBillLines(serverBill())[1];
    expect(appt.label).toBe('APT-05082026-001');
    expect(appt.sublabel).toBe('Appointment · 5 Aug · 2 services');
  });

  it('puts the quantity in a bare line label and marks it billed directly', () => {
    const product = toBillLines(serverBill())[2];
    expect(product.label).toBe('Face Serum  ×2');
    expect(product.sublabel).toBe('Billed directly · Product');
    expect(product.amount).toBe(1200);
  });

  it('leaves the quantity off a single bare line', () => {
    const service = toBillLines(serverBill())[3];
    expect(service.label).toBe('Threading');
  });

  it('keeps the raw bare row, which is what the PUT has to rebuild from', () => {
    expect(toBillLines(serverBill())[2].bare?.refId).toBe(77);
    // Ref lines carry none — they are rebuilt from their id alone.
    expect(toBillLines(serverBill())[0].bare).toBeUndefined();
  });

  it('reads a plain date by parts rather than through a timezone', () => {
    // '2026-08-05' must be 5 Aug everywhere, not 4 Aug west of Greenwich.
    const appt = toBillLines(serverBill())[1];
    expect(appt.sublabel).toContain('5 Aug');
  });

  it('drops a ref row with no id and survives an empty bill', () => {
    expect(toBillLines({ billedOrderDetails: [{ orderNumber: 'X' }] })).toEqual([]);
    expect(toBillLines(null)).toEqual([]);
    expect(toBillLines({})).toEqual([]);
  });
});

describe('toCustomProducts — the rebuild', () => {
  it('renames refId to productId, because the two sides disagree', () => {
    // The read side calls it a ref (a bare line is not a product row); the write side wants the
    // product's own id. Getting this wrong sends productId: undefined and fails the catalog lookup.
    expect(toCustomProducts(serverBill().bareProducts)[0].productId).toBe(77);
  });

  it('renames personId to salesPersonId — same person, different name on each side', () => {
    expect(toCustomProducts(serverBill().bareProducts)[0].salesPersonId).toBe(2);
  });

  it('carries the sale-unit fields, or the line is re-priced in base units', () => {
    const [p] = toCustomProducts(serverBill().bareProducts);
    expect(p.sellingUnit).toBe('bottle');
    expect(p.unitMultiplier).toBe(1);
    expect(p.unitLines).toEqual([{ unit: 'bottle', perStock: 1, qty: 2, price: 600 }]);
  });

  it('sends NO price — the server re-resolves it', () => {
    // CreateBillRequest.CustomProductItem has no price field at all; BillProductLinePricer owns it.
    const [p] = toCustomProducts(serverBill().bareProducts);
    expect(p).not.toHaveProperty('itemPrice');
    expect(p).not.toHaveProperty('totalPrice');
    expect(p).not.toHaveProperty('price');
  });

  it('carries quantity and discount', () => {
    const [p] = toCustomProducts(serverBill().bareProducts);
    expect(p.quantity).toBe(2);
    expect(p.discount).toBe(0);
  });

  it('drops a line with no usable refId rather than sending productId 0', () => {
    // productId 0 fails the catalog lookup and takes the whole save with it.
    expect(toCustomProducts([{ name: 'ghost', quantity: 1 }])).toEqual([]);
  });

  it('defaults a missing quantity to 1, never 0', () => {
    expect(toCustomProducts([{ refId: 5 }])[0].quantity).toBe(1);
  });

  it('handles a bill with no bare products', () => {
    expect(toCustomProducts(undefined)).toEqual([]);
    expect(toCustomProducts(null)).toEqual([]);
  });
});

describe('toCustomServices', () => {
  it('renames refId to serviceId and personId to servicePersonId', () => {
    const [s] = toCustomServices(serverBill().bareServices);
    expect(s.serviceId).toBe(21);
    expect(s.servicePersonId).toBe(3);
    expect(s.quantity).toBe(1);
    expect(s.discount).toBe(10);
  });

  it('has no sale-unit fields — services have no ladder', () => {
    const [s] = toCustomServices(serverBill().bareServices);
    expect(s).not.toHaveProperty('sellingUnit');
    expect(s).not.toHaveProperty('unitMultiplier');
  });
});

describe('round trip', () => {
  it('survives fetch → display → write with every field intact', () => {
    const lines = toBillLines(serverBill());
    const { customProducts, customServices } = bareToWrite(lines);

    expect(customProducts).toEqual([
      {
        productId: 77,
        salesPersonId: 2,
        quantity: 2,
        discount: 0,
        sellingUnit: 'bottle',
        unitMultiplier: 1,
        unitLines: [{ unit: 'bottle', perStock: 1, qty: 2, price: 600 }],
      },
    ]);
    expect(customServices).toEqual([
      { serviceId: 21, servicePersonId: 3, quantity: 1, discount: 10 },
    ]);
  });

  it('echoes the attached ids, auto-generated orders included', () => {
    // An auto-generated order comes back in billedOrderDetails like any other, and leaving it out
    // RELEASES it — the bill loses the item and an orphan unbilled order appears in the picker.
    const lines = toBillLines(serverBill());
    expect(attachedIds(lines, 'ORDER')).toEqual([94]);
    expect(attachedIds(lines, 'APPOINTMENT')).toEqual([12]);
  });

  it('drops a removed line from the write arrays', () => {
    const lines = toBillLines(serverBill()).filter((l) => l.kind !== 'PRODUCT');
    expect(bareToWrite(lines).customProducts).toEqual([]);
    expect(attachedIds(lines, 'ORDER')).toEqual([94]);
  });
});

describe('adding lines', () => {
  it('builds a bare line for a quick-added catalog row', () => {
    const line = newBareLine('PRODUCT', 77, 'Face Serum', 600, 2);
    expect(line.kind).toBe('PRODUCT');
    expect(line.amount).toBe(600);
    expect(bareToWrite([line]).customProducts).toEqual([
      {
        productId: 77,
        salesPersonId: 2,
        quantity: 1,
        discount: 0,
        sellingUnit: null,
        unitMultiplier: null,
        unitLines: null,
      },
    ]);
  });

  it('builds a line for an order picked from the billable list', () => {
    const line = attachedLine('ORDER', {
      id: 51,
      orderNumber: 'ORD-05082026-051',
      orderDate: '2026-08-05T08:00:00Z',
      totalAmount: 1240,
      orderItems: [{}, {}],
    });
    expect(line).toMatchObject({
      kind: 'ORDER',
      refId: 51,
      label: 'ORD-05082026-051',
      amount: 1240,
    });
    expect(line?.sublabel).toContain('2 items');
  });

  it('refuses a record with no id', () => {
    expect(attachedLine('ORDER', { orderNumber: 'X' })).toBeNull();
  });
});
