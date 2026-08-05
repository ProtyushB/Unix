/**
 * A bill's lines: reading the four shapes a GET returns, and rebuilding the two shapes a PUT wants.
 *
 * This module exists because the bill is the one resource with **no round-trip shape**. Every other
 * screen can echo the DTO it fetched; a bill cannot. The GET hands back:
 *
 *   billedOrderDetails[]        enriched order snapshots
 *   billedAppointmentDetails[]  enriched appointment snapshots
 *   bareProducts[]              BareBillLineDto
 *   bareServices[]              BareBillLineDto
 *
 * and the PUT wants:
 *
 *   billedOrders: number[]      just the ids
 *   billedAppointments: number[]
 *   customProducts[]            CustomProductItem — a DIFFERENT shape from BareBillLineDto
 *   customServices[]            CustomServiceItem
 *
 * Getting the rebuild wrong is not an error. Omitting `customProducts` removes the bare lines AND
 * restocks their inventory; getting a field wrong re-prices or re-attributes a line. So the mapping
 * lives here, alone, with a test per field.
 */

// ─── Read shapes ─────────────────────────────────────────────────────────────

/** One bare line as the GET returns it. `refId` is the product or service id, NOT a line id. */
export interface BareBillLine {
  refId?: unknown;
  name?: unknown;
  quantity?: unknown;
  itemPrice?: unknown;
  totalPrice?: unknown;
  discount?: unknown;
  /** Who the line is attributed to. Becomes `salesPersonId` / `servicePersonId` on the way back. */
  personId?: unknown;
  sellingUnit?: unknown;
  unitMultiplier?: unknown;
  unitLines?: unknown;
  stockDeducted?: unknown;
  [k: string]: unknown;
}

interface RawRef {
  id?: unknown;
  [k: string]: unknown;
}

// ─── Display ─────────────────────────────────────────────────────────────────

export type BillLineKind = 'ORDER' | 'APPOINTMENT' | 'PRODUCT' | 'SERVICE';

/** One row of the BILLED ITEMS list, whichever of the three kinds it is. */
export interface BillLine {
  kind: BillLineKind;
  /** Order/appointment id, or product/service id for a bare line. Unique WITHIN a kind, not across. */
  refId: number;
  /** "ORD-05082026-042" or "Face Serum ×2". */
  label: string;
  /** "Order · 5 Aug · 3 items" or "Billed directly · Product". */
  sublabel: string;
  amount: number;
  /** Bare lines only — the row the PUT has to rebuild. */
  bare?: BareBillLine;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toId(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** "5 Aug" from an instant or a YYYY-MM-DD, without a timezone round trip. */
function shortDate(v: unknown): string {
  const raw = str(v);
  if (!raw) return '';
  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  // A plain date has no zone to get wrong, so read it as parts.
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${Number(ymd[3])} ${MONTHS[Number(ymd[2]) - 1] ?? ''}`;
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return '';
  return `${parsed.getDate()} ${MONTHS[parsed.getMonth()]}`;
}

function countLabel(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

/**
 * The three kinds of line, flattened into one list in the order the mockup draws them: attached
 * orders, then attached appointments, then the bare lines.
 *
 * ⚠️ `billedOrderDetails` is typed `List<Object>` server-side and arrives as a plain map parsed out
 * of the FROZEN snapshot JSON, not as a live DTO. It is a picture of the order at the moment the
 * bill was saved. Read it for display; never treat it as current.
 */
export function toBillLines(item: Record<string, unknown> | null): BillLine[] {
  const lines: BillLine[] = [];

  for (const raw of arrayOf(item?.billedOrderDetails)) {
    const id = toId((raw as RawRef).id);
    if (id === null) continue;
    const r = raw as Record<string, unknown>;
    const items = arrayOf(r.orderedProductItemsWithDetails ?? r.orderItems).length;
    lines.push({
      kind: 'ORDER',
      refId: id,
      label: str(r.orderNumber) || `Order #${id}`,
      sublabel: ['Order', shortDate(r.orderDate ?? r.createdAt), countLabel(items, 'item')]
        .filter(Boolean)
        .join(' · '),
      amount: num(r.totalAmount),
    });
  }

  for (const raw of arrayOf(item?.billedAppointmentDetails)) {
    const id = toId((raw as RawRef).id);
    if (id === null) continue;
    const r = raw as Record<string, unknown>;
    const items = arrayOf(r.appointmentItems ?? r.appointedServiceItems).length;
    lines.push({
      kind: 'APPOINTMENT',
      refId: id,
      label: str(r.appointmentNumber) || `Appointment #${id}`,
      sublabel: [
        'Appointment',
        shortDate(r.appointmentDate ?? r.appointmentDateTime),
        countLabel(items, 'service'),
      ]
        .filter(Boolean)
        .join(' · '),
      amount: num(r.totalAmount),
    });
  }

  for (const raw of arrayOf(item?.bareProducts)) {
    lines.push(bareLine(raw as BareBillLine, 'PRODUCT'));
  }
  for (const raw of arrayOf(item?.bareServices)) {
    lines.push(bareLine(raw as BareBillLine, 'SERVICE'));
  }

  return lines;
}

function bareLine(raw: BareBillLine, kind: 'PRODUCT' | 'SERVICE'): BillLine {
  const qty = num(raw.quantity, 1);
  const name = str(raw.name) || `${kind === 'PRODUCT' ? 'Product' : 'Service'} #${str(raw.refId)}`;
  return {
    kind,
    refId: toId(raw.refId) ?? 0,
    // "Face Serum ×2" — the quantity rides the label, as the mockup draws it.
    label: qty > 1 ? `${name}  ×${qty}` : name,
    sublabel: `Billed directly · ${kind === 'PRODUCT' ? 'Product' : 'Service'}`,
    amount: num(raw.totalPrice),
    bare: raw,
  };
}

function arrayOf(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

// ─── Write shapes ────────────────────────────────────────────────────────────

/** `CreateBillRequest.customProducts[]`. No price — the server re-resolves it. */
export interface CustomProductItem {
  productId: number;
  salesPersonId?: number | null;
  quantity: number;
  discount?: number;
  sellingUnit?: string | null;
  unitMultiplier?: number | null;
  unitLines?: unknown;
}

/** `CreateBillRequest.customServices[]`. */
export interface CustomServiceItem {
  serviceId: number;
  servicePersonId?: number | null;
  quantity: number;
  discount?: number;
}

/**
 * Rebuild `customProducts` from the bare product lines a GET returned.
 *
 * Field by field, because the two shapes disagree on two names and the price is absent from one of
 * them entirely:
 *
 *  - `refId` → `productId`. The read side calls it a ref because a bare line is not a product row.
 *  - `personId` → `salesPersonId`. Same person, different name on each side.
 *  - `sellingUnit`, `unitMultiplier`, `unitLines` carry across unchanged — dropping them re-prices
 *    the line in base units.
 *  - There is NO price field on the write side. `BillProductLinePricer` re-resolves it server-side,
 *    so sending one would be ignored at best.
 *
 * A line with no usable `refId` is dropped rather than sent as `productId: 0`, which would fail a
 * catalog lookup and take the whole save with it.
 */
export function toCustomProducts(bareProducts: unknown): CustomProductItem[] {
  return arrayOf(bareProducts)
    .map((raw): CustomProductItem | null => {
      const line = raw as BareBillLine;
      const productId = toId(line.refId);
      if (productId === null) return null;
      return {
        productId,
        salesPersonId: toId(line.personId),
        quantity: num(line.quantity, 1),
        discount: num(line.discount),
        sellingUnit: line.sellingUnit == null ? null : str(line.sellingUnit),
        unitMultiplier: toId(line.unitMultiplier),
        unitLines: line.unitLines ?? null,
      };
    })
    .filter((x): x is CustomProductItem => x !== null);
}

/** Rebuild `customServices`. Same rename pair, minus the sale-unit fields services do not have. */
export function toCustomServices(bareServices: unknown): CustomServiceItem[] {
  return arrayOf(bareServices)
    .map((raw): CustomServiceItem | null => {
      const line = raw as BareBillLine;
      const serviceId = toId(line.refId);
      if (serviceId === null) return null;
      return {
        serviceId,
        servicePersonId: toId(line.personId),
        quantity: num(line.quantity, 1),
        discount: num(line.discount),
      };
    })
    .filter((x): x is CustomServiceItem => x !== null);
}

/**
 * The ids of the attached orders / appointments, for `billedOrders` and `billedAppointments`.
 *
 * ⚠️ This includes AUTO-GENERATED orders — the ones the server spawned itself from a quick-add of
 * an order-required product. They come back in `billedOrderDetails` like any other, and they MUST
 * be echoed: leaving one out releases it, and the bill then shows an item it no longer owns while
 * an orphan unbilled order sits in the picker.
 */
export function attachedIds(lines: BillLine[], kind: 'ORDER' | 'APPOINTMENT'): number[] {
  return lines.filter((l) => l.kind === kind).map((l) => l.refId);
}

/** The bare lines still on the bill, as the two write arrays. */
export function bareToWrite(lines: BillLine[]): {
  customProducts: CustomProductItem[];
  customServices: CustomServiceItem[];
} {
  return {
    customProducts: toCustomProducts(
      lines.filter((l) => l.kind === 'PRODUCT' && l.bare).map((l) => l.bare),
    ),
    customServices: toCustomServices(
      lines.filter((l) => l.kind === 'SERVICE' && l.bare).map((l) => l.bare),
    ),
  };
}

/** A bare line for a catalog row the user just quick-added. */
export function newBareLine(
  kind: 'PRODUCT' | 'SERVICE',
  refId: number,
  name: string,
  price: number,
  personId: number | null,
): BillLine {
  return {
    kind,
    refId,
    label: name,
    sublabel: `Billed directly · ${kind === 'PRODUCT' ? 'Product' : 'Service'}`,
    amount: price,
    bare: {
      refId,
      name,
      quantity: 1,
      itemPrice: price,
      totalPrice: price,
      discount: 0,
      personId,
    },
  };
}

/** A line for an order or appointment the user just attached from the billable picker. */
export function attachedLine(
  kind: 'ORDER' | 'APPOINTMENT',
  record: Record<string, unknown>,
): BillLine | null {
  const id = toId(record?.id);
  if (id === null) return null;
  const isOrder = kind === 'ORDER';
  const items = arrayOf(
    isOrder
      ? (record.orderedProductItemsWithDetails ?? record.orderItems)
      : (record.appointmentItems ?? record.appointedServiceItems),
  ).length;
  return {
    kind,
    refId: id,
    label: str(isOrder ? record.orderNumber : record.appointmentNumber) || `#${id}`,
    sublabel: [
      isOrder ? 'Order' : 'Appointment',
      shortDate(
        isOrder ? record.orderDate : (record.appointmentDate ?? record.appointmentDateTime),
      ),
      countLabel(items, isOrder ? 'item' : 'service'),
    ]
      .filter(Boolean)
      .join(' · '),
    amount: num(record.totalAmount),
  };
}
