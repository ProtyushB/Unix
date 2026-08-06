/**
 * A single order line can be sold in several sale units at once.
 *
 * The mockup draws Paracetamol as `strip · ₹28 ×1` AND `tablet · ₹6 ×4` on one row — one product,
 * two units, one line. That is the "mixed line" this module exists for, and it is the only genuinely
 * new maths in the Order Detail screen.
 *
 * The shape is dictated by the server, not chosen here. `OrderedProductItem` carries a single
 * `quantity`, a single `sellingUnit` and a single `unitMultiplier`, PLUS an optional `unitLines[]`
 * breakdown. So a mixed line has to be flattened into base units before it is sent, with the
 * per-unit detail preserved alongside — and reconstructed on the way back in.
 *
 * Ported from Centrix's `orderLineUnits.js`, which is what the web portal already sends. The two
 * clients must agree byte for byte or a line edited on one and saved on the other changes value.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** One rung of a product's sale-unit ladder, as the catalog defines it. */
export interface SaleUnit {
  unit: string;
  /** How many BASE units this rung contains. The base rung is 1. */
  perStock: number;
  price: number;
}

/** One unit's worth of an order line: "4 tablets at ₹6". */
export interface UnitLine {
  unit: string;
  perStock: number;
  qty: number;
  price: number;
}

/**
 * An order line as the form holds it. Loose beyond these keys — the DTO carries `productSnapshot`,
 * `inventoryLine`, `returnReason` and more, all of which must survive a round trip untouched.
 */
export interface OrderLine {
  productId: number;
  quantity: number;
  itemPrice: number;
  totalPrice: number;
  discount: number;
  sellingUnit?: string | null;
  unitMultiplier?: number | null;
  unitLines?: UnitLine[] | null;
  [k: string]: unknown;
}

// ─── Reading ─────────────────────────────────────────────────────────────────

/**
 * Is this line carrying more than one unit?
 *
 * A line with exactly one `unitLines` entry is NOT mixed — it is a plain single-unit line that
 * happens to have its breakdown spelled out. Treating it as mixed would blank its `sellingUnit`
 * on the next save.
 */
export function isMixedLine(line: Pick<OrderLine, 'unitLines'>): boolean {
  return Array.isArray(line.unitLines) && line.unitLines.length > 1;
}

/** Every unit on the line, whether it is stored as a breakdown or as a single unit. */
export function displayUnitLines(line: OrderLine): UnitLine[] {
  if (Array.isArray(line.unitLines) && line.unitLines.length) return line.unitLines;
  if (!line.sellingUnit) return [];
  return [
    {
      unit: line.sellingUnit,
      perStock: line.unitMultiplier ?? 1,
      qty: line.quantity,
      price: line.itemPrice,
    },
  ];
}

/** Total in BASE units — what stock is actually deducted in. */
export function lineBaseQty(line: OrderLine): number {
  if (isMixedLine(line)) {
    return (line.unitLines ?? []).reduce((sum, u) => sum + u.qty * u.perStock, 0);
  }
  return line.quantity * (line.unitMultiplier ?? 1);
}

/** What the line costs. Summed per unit when mixed, because each rung has its own price. */
export function lineTotal(line: OrderLine): number {
  if (isMixedLine(line)) {
    return (line.unitLines ?? []).reduce((sum, u) => sum + u.qty * u.price, 0);
  }
  return line.quantity * line.itemPrice;
}

/**
 * The blended price of one BASE unit.
 *
 * A mixed line has no single unit price — "₹28 a strip and ₹6 a tablet" is two prices — so the
 * server is sent the average, which is the only number that makes `quantity × itemPrice` come out
 * to the right total.
 */
export function lineEffUnitPrice(line: OrderLine): number {
  const base = lineBaseQty(line);
  if (base <= 0) return 0;
  return lineTotal(line) / base;
}

/** "1 strip · 4 tablet" — the summary under a mixed line's name. */
export function mixedLabel(line: OrderLine): string {
  return displayUnitLines(line)
    .filter((u) => u.qty > 0)
    .map((u) => `${u.qty} ${u.unit}`)
    .join(' · ');
}

/** "2 strip · ₹28 each" — the meta line under a single-unit row, as the view mockup draws it. */
export function unitSummary(line: OrderLine, formatMoney: (n: number) => string): string {
  const units = displayUnitLines(line).filter((u) => u.qty > 0);
  if (!units.length) return '';
  if (units.length === 1) {
    const [u] = units;
    return u.qty === 1
      ? `${u.qty} ${u.unit} · ${formatMoney(u.price)}`
      : `${u.qty} ${u.unit} · ${formatMoney(u.price)} each`;
  }
  return units.map((u) => `${u.qty} ${u.unit} · ${formatMoney(u.price)}`).join('  ·  ');
}

// ─── Writing ─────────────────────────────────────────────────────────────────

/**
 * Collapse a set of unit rows into the single-quantity shape the server stores.
 *
 * The three assignments here are the contract, and each is load-bearing:
 *
 *  - `quantity` becomes the BASE-unit total, because that is the number inventory is deducted in.
 *  - `unitMultiplier` becomes 1, because `quantity` is already in base units — leaving the old
 *    multiplier would multiply the deduction a second time.
 *  - `sellingUnit` becomes null, because there is no longer one unit to name.
 *
 * `unitLines` carries the detail that would otherwise be lost, and is what lets the line be read
 * back as mixed. Dropping it turns "1 strip + 4 tablets" into "14 of something" on the next open.
 */
export function rollUpMixed(line: OrderLine, units: UnitLine[]): OrderLine {
  const kept = units.filter((u) => u.qty > 0);
  const baseQty = kept.reduce((sum, u) => sum + u.qty * u.perStock, 0);
  const total = kept.reduce((sum, u) => sum + u.qty * u.price, 0);

  // One unit left is a plain line again, not a mixed line of size one — otherwise removing a rung
  // would leave a line the server stores with a null sellingUnit for no reason.
  if (kept.length === 1) {
    const [u] = kept;
    return {
      ...line,
      quantity: u.qty,
      sellingUnit: u.unit,
      unitMultiplier: u.perStock,
      itemPrice: u.price,
      totalPrice: u.qty * u.price,
      unitLines: kept,
    };
  }

  return {
    ...line,
    quantity: baseQty,
    sellingUnit: null,
    unitMultiplier: 1,
    itemPrice: baseQty > 0 ? total / baseQty : 0,
    totalPrice: total,
    unitLines: kept,
  };
}

/** Set one unit's quantity. Removing the last one is `removeUnit`'s job, not this. */
export function updateUnitQty(line: OrderLine, index: number, qty: number): OrderLine {
  const units = displayUnitLines(line).map((u, i) => (i === index ? { ...u, qty } : u));
  return rollUpMixed(line, units);
}

export function removeUnit(line: OrderLine, index: number): OrderLine {
  const units = displayUnitLines(line).filter((_, i) => i !== index);
  return rollUpMixed(line, units);
}

/**
 * Add a rung, or fold into the existing one when that unit is already on the line.
 *
 * Folding rather than appending: two rows both saying "strip" would render as a duplicate and roll
 * up to the same number anyway, so the addition is a quantity change in disguise.
 */
export function addUnit(line: OrderLine, unit: SaleUnit, qty = 1): OrderLine {
  const units = displayUnitLines(line);
  const existing = units.findIndex((u) => u.unit === unit.unit);
  if (existing >= 0) {
    return updateUnitQty(line, existing, units[existing].qty + qty);
  }
  return rollUpMixed(line, [
    ...units,
    { unit: unit.unit, perStock: unit.perStock, qty, price: unit.price },
  ]);
}

/** Swap which unit a single-unit line is sold in, keeping the quantity. */
export function selectUnit(line: OrderLine, index: number, unit: SaleUnit): OrderLine {
  const units = displayUnitLines(line).map((u, i) =>
    i === index ? { unit: unit.unit, perStock: unit.perStock, qty: u.qty, price: unit.price } : u,
  );
  return rollUpMixed(line, units);
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

/** A product's ladder, tolerant of the several shapes a catalog row can arrive in. */
export function saleUnitsOf(product: unknown): SaleUnit[] {
  const raw = (product as { saleUnits?: unknown })?.saleUnits;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((u) => {
      const row = u as { unit?: unknown; perStock?: unknown; price?: unknown };
      return {
        unit: String(row?.unit ?? '').trim(),
        perStock: Number(row?.perStock ?? 1) || 1,
        price: Number(row?.price ?? 0),
      };
    })
    .filter((u) => Boolean(u.unit));
}

/**
 * The rung a freshly picked product starts on.
 *
 * The base rung (`perStock === 1`) when there is one, else the first. Seeding from the base means
 * a line is immediately valid at quantity 1 — picking a product should never produce a row the
 * user has to fix before it can be saved.
 */
export function baseSaleUnit(units: SaleUnit[]): SaleUnit | null {
  if (!units.length) return null;
  return units.find((u) => u.perStock === 1) ?? units[0];
}

// ─── Per-item delivery ───────────────────────────────────────────────────────

/**
 * Statuses a line can never move on from. Mirrors Centrix's `TERMINAL_ITEM_STATUSES`.
 *
 * DELIVERED is terminal because it is the destination; CANCELLED and RETURNED because delivering
 * either would contradict a decision already recorded against the line.
 */
export const TERMINAL_ITEM_STATUSES = ['DELIVERED', 'CANCELLED', 'RETURNED'];

export function isItemStatusTerminal(status: unknown): boolean {
  return TERMINAL_ITEM_STATUSES.includes(String(status ?? 'PENDING').toUpperCase());
}

/**
 * Whether a line can be marked delivered.
 *
 * ⚠️ Unlike the appointment's per-item completion, there is NO endpoint behind this. Modulex has
 * only `POST /{orderId}/fulfillment/{id}/deliver`, which addresses a PRODUCT component inside a
 * PACKAGE row — not a top-level product line. Centrix does not use it for these rows either: it
 * flips `status` on the item and re-saves the whole order through the ordinary PUT
 * (`GenericOrderDetailsBase.jsx:339`). This mirrors that, which is why the action lives on the save
 * path rather than in the api layer.
 *
 * `productId` is the identity used throughout — the order form dedupes by it, so it is unique per
 * order, and unlike an array index it cannot be invalidated by a row being removed elsewhere.
 */
export function canMarkDelivered(line: OrderLine): boolean {
  return line?.productId != null && !isItemStatusTerminal(line.status);
}

/**
 * Return the lines with one product's line flipped to DELIVERED.
 *
 * A new array with a new object for the touched row only — the untouched lines keep their identity,
 * so the PUT that follows sends back exactly what the server gave us for them. That matters more
 * here than usual: `orderItems` is replaced wholesale on save, and a line reconstructed rather than
 * echoed risks losing `productSnapshot`, `unitLines` or `inventoryLine`.
 */
export function markLineDelivered(lines: OrderLine[], productId: number): OrderLine[] {
  return lines.map((line) =>
    line.productId === productId && canMarkDelivered(line)
      ? { ...line, status: 'DELIVERED' }
      : line,
  );
}
