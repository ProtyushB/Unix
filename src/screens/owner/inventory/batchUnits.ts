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

import type { StockUnitLine } from '../../../backend/modules/shared/inventory.types';

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

/**
 * Unit names that are the SAME in the plural — measure symbols, not countable nouns.
 *
 * "45 gs" and "200 mls" are what a naive pluralizer produces, and they are wrong everywhere they
 * appear: every mockup writes "1,530 g", "4,200 ml", "3 tubs · 30 g". Raw stock is measured far more
 * often than it is counted, so this is the common case rather than an edge one.
 *
 * Deliberately a short, literal list of symbols rather than a rule. There is no reliable way to tell
 * "g" from "bag" by shape, and a rule that guessed would eventually un-pluralise a real noun.
 * Compared lowercase so a catalog entered as "ML" is covered too.
 */
const UNCOUNTABLE_UNITS = new Set([
  'g',
  'gm',
  'kg',
  'mg',
  'mcg',
  'ml',
  'l',
  'ltr',
  'cc',
  'oz',
  'cm',
  'mm',
]);

function pluralize(unit: string, n: number): string {
  if (n === 1) return unit;
  if (UNCOUNTABLE_UNITS.has(unit.trim().toLowerCase())) return unit;
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

// ─── Mixed units: several levels on ONE record ───────────────────────────────
//
// Everything above this line is the SINGLE-level half: stock comes in at one rung of the ladder
// ("50 boxes") and the batch snapshots that rung. Consumption, wastage and stock transfer need the
// other half — one record can be "1 strip AND 8 tablets" — so a `unitLines` array rides alongside
// the scalar quantity.
//
// Both halves live in this one file on purpose: Centrix keeps them together in `saleUnits.js`, and
// they are the same arithmetic read in two directions. Splitting them would put `effMult` in one
// file and its only other caller in another.
//
// The contract, which the payload builder below is the sole authority on:
//
//   1 row   → scalar record:  quantity is in LEVEL units, unitMultiplier is that level's perStock
//   2+ rows → mixed record:   quantity is the BASE total, unitMultiplier is 1, unitLines carries
//                             the breakdown
//
// Either way the server deducts `quantity × unitMultiplier` base units, so the two branches produce
// the same deduction from the same entry. Getting the branch wrong is silent: send a mixed record's
// base total with the level's multiplier still attached and the deduction is multiplied twice.

/** True when a record carries a mixed (2+) unit-row breakdown. One row is not "mixed". */
export function isMixedUnitLines(lines: StockUnitLine[] | null | undefined): boolean {
  return Array.isArray(lines) && lines.length >= 2;
}

/** Total BASE units across the rows: Σ(qty × perStock). `effMult` guards a corrupt rung. */
export function unitLinesBaseQty(lines: StockUnitLine[] | null | undefined): number {
  return (lines ?? []).reduce((sum, l) => sum + (Number(l?.qty) || 0) * effMult(l?.perStock), 0);
}

/**
 * Rows ordered for display: highest level first, so "1 strip · 8 tablets" never reads backwards.
 *
 * Returns a COPY. `Array.prototype.sort` mutates, and these arrays are React state — sorting one in
 * place would edit the state object the caller is still holding and skip the re-render.
 */
export function sortUnitLinesDesc(lines: StockUnitLine[] | null | undefined): StockUnitLine[] {
  return [...(lines ?? [])].sort((a, b) => effMult(b?.perStock) - effMult(a?.perStock));
}

/**
 * "1 strip · 8 tablets" — higher level first, zero-qty rows dropped, unit names pluralised.
 *
 * ⚠️ The separator is `·`, where Centrix's `mixedUnitLabel` uses ` + `. Deliberate divergence: in
 * this app `formatStockedQty` already renders "49 boxes · 8 sachets" for exactly the same idea —
 * one quantity expressed across two rungs — and a screen that showed a batch with `·` and the
 * consumption drawn from it with `+` would read as two different kinds of number. One separator
 * for one concept. (The mockups were updated to match; see the Stock & Ops boards.)
 */
export function mixedUnitLabel(
  lines: StockUnitLine[] | null | undefined,
  baseUnit = 'unit',
): string {
  return sortUnitLinesDesc(lines)
    .filter((l) => (Number(l?.qty) || 0) > 0)
    .map((l) => {
      const qty = Number(l.qty) || 0;
      // A rung with no name of its own is the base rung — naming it after `baseUnit` beats
      // rendering "8 " with a hole where the unit should be.
      return `${qty} ${pluralize(l.unit || baseUnit, qty)}`;
    })
    .join(' · ');
}

/**
 * A saved record's quantity, in unit names: "1 strip · 8 tablets" or "2 bottles".
 *
 * The mixed branch reads `unitLines`; the scalar branch reads `quantity` + `unitName`, falling back
 * to the base unit and then to the bare number. Which branch applies is decided by the ROW COUNT,
 * not by whether `unitLines` is present — a single-row array would otherwise render its breakdown
 * and its scalar differently for the same record.
 *
 * Null quantity renders as an em dash rather than "0": a record with no quantity recorded is not a
 * record of zero.
 */
export function recordQtyLabel(
  record: {
    quantity?: number | null;
    unitName?: string | null;
    unitLines?: StockUnitLine[] | null;
  },
  baseUnit = 'unit',
): string {
  if (isMixedUnitLines(record?.unitLines)) return mixedUnitLabel(record.unitLines, baseUnit);
  const qty = record?.quantity;
  if (qty === null || qty === undefined) return '—';
  const n = Number(qty);
  if (!Number.isFinite(n)) return '—';
  const unit = record?.unitName || baseUnit;
  return unit ? `${n} ${pluralize(unit, n)}` : String(n);
}

/** What `deriveUnitLinesPayload` hands the payload builder. The four fields always travel together. */
export interface UnitLinesPayload {
  /** LEVEL units on the scalar branch, BASE units on the mixed one. */
  quantity: number;
  /** The level's name, or null when mixed. Null is NOT `''` — the server reads them differently. */
  unitName: string | null;
  unitMultiplier: number;
  /** Null (not `[]`) on the scalar branch, so "one level" and "no breakdown" are one answer. */
  unitLines: StockUnitLine[] | null;
}

/**
 * Turn the editor's rows into a stock-movement record's four quantity fields.
 *
 * THE load-bearing function of this half. Zero-qty rows are dropped first — a user who added a row
 * and left it blank meant to add nothing — and then the row count picks the branch:
 *
 *   1 row  → `{quantity: <level units>, unitName, unitMultiplier: perStock, unitLines: null}`
 *   2+     → `{quantity: <BASE total>,  unitName: null, unitMultiplier: 1, unitLines: [...]}`
 *
 * The second branch is the one that is easy to get wrong, and wrong is silent: leave
 * `unitMultiplier` on the level's value while `quantity` already holds the base total and the server
 * deducts `perStock` times too much. Both branches are pinned by test for that reason.
 *
 * Returns null when nothing is filled in. The caller treats that as a validation failure rather than
 * posting a zero — a zero-quantity movement is accepted by nobody and means nothing.
 */
export function deriveUnitLinesPayload(
  lines: StockUnitLine[] | null | undefined,
): UnitLinesPayload | null {
  const rows = (lines ?? []).filter((l) => (Number(l?.qty) || 0) > 0);
  if (rows.length === 0) return null;

  if (rows.length === 1) {
    const row = rows[0];
    return {
      quantity: Number(row.qty),
      // `|| null` rather than `?? null`: an empty-string unit is a base rung with no name, and the
      // server reads `''` as a unit literally called "" rather than as "none".
      unitName: row.unit || null,
      unitMultiplier: effMult(row.perStock),
      unitLines: null,
    };
  }

  return {
    quantity: unitLinesBaseQty(rows),
    unitName: null,
    unitMultiplier: 1,
    unitLines: rows.map((r) => ({
      unit: r.unit,
      perStock: effMult(r.perStock),
      qty: Number(r.qty),
    })),
  };
}

// ─── UnitRowsEditor helpers ──────────────────────────────────────────────────
//
// The editor is a `.tsx` and therefore untestable under this repo's jest config, so every decision
// it makes lives here instead. It holds JSX and `useState` and nothing else.

/**
 * The rows the editor may actually hold.
 *
 * With `allowMultiple: false` it clamps to ONE, and that is not cosmetic: stock transfer passes
 * false because the server DISCARDS `unitLines` on a transfer — it rebuilds the destination batch
 * from the scalar total — so a second row would be typed, sent, dropped, and missing from the
 * detail screen the user lands on. Clamping here means the promise is never made.
 */
export function clampUnitRows(
  rows: StockUnitLine[] | null | undefined,
  allowMultiple: boolean,
): StockUnitLine[] {
  const list = [...(rows ?? [])];
  return allowMultiple ? list : list.slice(0, 1);
}

/**
 * Whether to draw the "Add unit" affordance.
 *
 * Three independent reasons not to: the caller forbade it, the ladder has nothing left to add, or
 * every rung is already on screen. The middle one matters most — a base-unit product has ONE rung,
 * so an Add button could only ever add a duplicate of the row already there.
 */
export function showsAddUnitRow(input: {
  allowMultiple: boolean;
  rowCount: number;
  /** How many rungs the product's ladder offers. */
  ladderSize: number;
}): boolean {
  if (!input.allowMultiple) return false;
  if (input.ladderSize <= 1) return false;
  return input.rowCount < input.ladderSize;
}

/**
 * The roll-up under the rows: "= 45 g of 180 g available".
 *
 * Both figures are in BASE units, which is the whole point of the line — the rows above are counted
 * in mixed levels and cannot be compared against the stock figure by eye. Rendering the entered
 * total in levels here would restate the rows instead of converting them.
 *
 * Null when nothing has been entered, so an untouched editor does not show "= 0 g of 180 g
 * available" and read as an error. The " of N available" tail is dropped when the available stock
 * is genuinely unknown (no product picked yet) rather than shown as zero — `null` ≠ `0`.
 */
export function unitRowsRollup(
  rows: StockUnitLine[] | null | undefined,
  availableBaseQty: number | null | undefined,
  baseUnit = 'unit',
): string | null {
  const total = unitLinesBaseQty(rows);
  if (!(total > 0)) return null;
  const head = `= ${total} ${pluralize(baseUnit, total)}`;
  if (availableBaseQty === null || availableBaseQty === undefined) return head;
  const available = Number(availableBaseQty);
  if (!Number.isFinite(available)) return head;
  return `${head} of ${available} ${pluralize(baseUnit, available)} available`;
}
