/**
 * Stock-in units: the conversion between what a user counts and what the server stores.
 *
 * A batch is bought in some unit ("50 boxes") but the server stores everything in BASE units
 * ("600 sachets"), because that is what orders deduct. The chosen level is snapshotted onto the
 * batch as `stockInUnit` / `stockInMultiplier` so the list can render it back the way it was
 * entered.
 *
 * The contract, ported from Centrix (`saleUnits.js` + `InventoryPage.jsx:476-519`) and matching the
 * backend's own `effMult`:
 *
 *   quantities  ×  multiplier   on write   (50 boxes → 600 sachets)
 *   prices      ÷  multiplier   on write   (₹420/box → ₹35.0000/sachet)
 *
 * Getting the direction backwards on either is silent and expensive: stock is off by a factor of
 * twelve, or every unit is priced at twelve times its worth. That is why both directions are
 * pinned by tests rather than left to a reviewer to spot.
 */

/** One rung of a product's ladder, as the catalog defines it. */
export interface SaleUnit {
  unit: string;
  /** How many BASE units this rung contains. The base rung is 1. */
  perStock: number;
  price?: number;
}

/** Price precision on the wire. Four decimals, matching Centrix's `perBase`. */
const PRICE_DP = 4;

/**
 * A usable multiplier from whatever the catalog holds.
 *
 * Floors and clamps to at least 1 — mirroring the backend's `effMult`, deliberately, because the
 * two must agree. A zero or fractional multiplier reaching the arithmetic would zero the stock or
 * store a fractional base count the server cannot represent.
 */
export function effMult(perStock: unknown): number {
  const n = Math.floor(Number(perStock));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** A product's ladder, tolerant of the shapes a catalog row arrives in. */
export function saleUnitsOf(product: unknown): SaleUnit[] {
  const raw = (product as { saleUnits?: unknown })?.saleUnits;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((u) => {
      const row = u as { unit?: unknown; perStock?: unknown; price?: unknown };
      return {
        unit: String(row?.unit ?? '').trim(),
        perStock: effMult(row?.perStock),
        price: Number(row?.price ?? 0),
      };
    })
    .filter((u) => Boolean(u.unit));
}

/** The base rung (`perStock === 1`) when there is one, else the first. Null for an empty ladder. */
export function baseSaleUnit(units: SaleUnit[]): SaleUnit | null {
  if (!units.length) return null;
  return units.find((u) => u.perStock === 1) ?? units[0];
}

/** The rung named by `unit`, falling back to the base one. */
export function resolveSaleUnit(
  units: SaleUnit[],
  unit: string | null | undefined,
): SaleUnit | null {
  if (!units.length) return null;
  return units.find((u) => u.unit === unit) ?? baseSaleUnit(units);
}

/**
 * Whether to offer the Stock-in Unit picker at all.
 *
 * A single-rung product has nothing to choose between, and a dropdown with one option is furniture
 * — so the field is not rendered, exactly as Centrix and the mockup's empty add screen do.
 */
export function showsUnitPicker(units: SaleUnit[]): boolean {
  return units.length > 1;
}

// ─── Write: user units → server base units ───────────────────────────────────

/** `50 boxes × 12` → `600`. Rounded, because base quantities are whole counts. */
export function toBaseQty(qty: number | string | null | undefined, mult: number): number {
  const n = Number(qty);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * effMult(mult));
}

/**
 * `₹420 per box ÷ 12` → `35.0000` per sachet.
 *
 * Four decimals rather than two: a price that does not divide evenly (₹100 across 3) would lose
 * enough at 2dp to drift the stock valuation on a large batch. Null passes through as null — the
 * server reads that as "use the product's price", which is not the same as zero.
 */
export function toBasePrice(
  price: number | string | null | undefined,
  mult: number,
): number | null {
  if (price === null || price === undefined || price === '') return null;
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  return Number((n / effMult(mult)).toFixed(PRICE_DP));
}

// ─── Read: server base units → what the user sees ────────────────────────────

/** The level a saved batch was stocked in, or null when it carries none (legacy / system-minted). */
export function displayLevel(batch: {
  stockInUnit?: string | null;
  stockInMultiplier?: number | null;
}): SaleUnit | null {
  const unit = batch?.stockInUnit;
  if (!unit) return null;
  return { unit, perStock: effMult(batch?.stockInMultiplier) };
}

function pluralize(unit: string, n: number): string {
  if (n === 1) return unit;
  return /(s|x|z|ch|sh)$/i.test(unit) ? `${unit}es` : `${unit}s`;
}

/**
 * A base-unit count rendered in the batch's stock-in unit: `50 boxes`, or `49 boxes · 8 sachets`
 * when it does not divide evenly.
 *
 * The remainder is shown rather than rounded away because it is real stock — an order can draw 8
 * sachets out of a box, and reporting "49 boxes" would lose them.
 *
 * With no level (a batch created before the field existed, or minted by a combo break) it falls
 * back to the plain base count, which is the honest thing: we do not know what it was bought in.
 */
export function formatStockedQty(
  baseQty: number | null | undefined,
  level: SaleUnit | null,
  baseUnit = 'unit',
): string {
  const n = Number(baseQty ?? 0);
  if (!Number.isFinite(n)) return '';
  if (!level || level.perStock <= 1) return `${n} ${pluralize(baseUnit, n)}`;

  const whole = Math.floor(n / level.perStock);
  const rest = n % level.perStock;
  const head = `${whole} ${pluralize(level.unit, whole)}`;
  return rest === 0 ? head : `${head} · ${rest} ${pluralize(baseUnit, rest)}`;
}

/**
 * The "= 600 base units" line under Purchased Quantity while adding.
 *
 * Says "base units" rather than naming the unit, which is the design's wording: the point of the
 * line is that the number below is in a DIFFERENT currency from the one being typed, and the
 * generic phrase makes that switch explicit where "= 600 sachets" reads as just another quantity.
 *
 * Null when there is nothing to clarify — a base-unit product, or an empty/non-integer entry — so
 * the caller can simply not render the line rather than show "= 0 base units".
 */
export function baseEquivalenceLabel(
  qty: number | string | null | undefined,
  mult: number,
): string | null {
  const m = effMult(mult);
  if (m <= 1) return null;
  const n = Number(qty);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return `= ${n * m} base units`;
}

/** "12 sachets per box" — the helper under the unit picker. Null for a base-unit product. */
export function perUnitLabel(level: SaleUnit | null, baseUnit = 'unit'): string | null {
  if (!level || level.perStock <= 1) return null;
  return `${level.perStock} ${pluralize(baseUnit, level.perStock)} per ${level.unit}`;
}

// ─── Add-form labels ─────────────────────────────────────────────────────────
//
// Every label below changes shape depending on whether a stock-in unit is in play, because the
// numbers underneath change meaning with it. A quantity typed against a `pack (×12)` is twelve
// times what the same digits mean against the base unit, and a price is a twelfth — so the labels
// carry the unit rather than leaving the user to remember which currency they are in.

/** The unit picker's value: `pack (×12)`, or `Base unit` when the rung IS the base. */
export function unitPickerValue(level: SaleUnit | null): string {
  if (!level) return 'Base unit';
  return level.perStock > 1 ? `${level.unit} (×${level.perStock})` : 'Base unit';
}

/**
 * "1 pack = 12 sachets; quantities and prices below are per pack."
 *
 * The sentence that makes the whole conversion legible. Null for a base-unit product, where there
 * is no conversion to explain.
 */
export function unitHelperLine(level: SaleUnit | null, baseUnit = 'unit'): string | null {
  if (!level || level.perStock <= 1) return null;
  return `1 ${level.unit} = ${level.perStock} ${pluralize(baseUnit, level.perStock)}; quantities and prices below are per ${level.unit}.`;
}

/** "Purchased Quantity (packs)" when a unit is in play, else the bare label. */
export function quantityFieldLabel(base: string, level: SaleUnit | null): string {
  if (!level || level.perStock <= 1) return base;
  return `${base} (${pluralize(level.unit, 2)})`;
}

/** "Cost Price (₹/pack)" when a unit is in play, else "Cost Price (₹)". */
export function priceFieldLabel(base: string, level: SaleUnit | null): string {
  if (!level || level.perStock <= 1) return `${base} (₹)`;
  return `${base} (₹/${level.unit})`;
}

/**
 * Stock value at cost, in rupees. `costPrice` is per BASE unit, so no multiplier is involved.
 *
 * Null in, null out — and the check is explicit rather than `Number.isFinite`, because
 * `Number(null)` is 0, which is finite. Leaning on isFinite alone turns "no cost price recorded"
 * into a confident "₹0.00" on the detail screen.
 */
export function stockValueAtCost(
  remainingBaseQty: number | null | undefined,
  costPricePerBase: number | null | undefined,
): number | null {
  if (remainingBaseQty === null || remainingBaseQty === undefined) return null;
  if (costPricePerBase === null || costPricePerBase === undefined) return null;
  const q = Number(remainingBaseQty);
  const p = Number(costPricePerBase);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return null;
  return q * p;
}
