import type {
  ConsumptionDto,
  ConsumptionPayload,
  ConsumptionReason,
} from '../../../../backend/modules/shared/consumption.types';
import type { StockUnitLine } from '../../../../backend/modules/shared/inventory.types';
import type { BatchDto } from '../../inventory/batch.model';
import {
  baseSaleUnit,
  deriveUnitLinesPayload,
  displayLevel,
  formatStockedQty,
  saleUnitsOf,
  sortUnitLinesDesc,
  type SaleUnit,
} from '../../inventory/batchUnits';
import type { CatalogStock } from '../../shared/detail/catalogPicker.view';

/**
 * Form state and the create payload for the Consumption Detail screen.
 *
 * There is no update payload. A consumption is immutable — the backend has no PUT — so this file
 * only ever builds a POST body.
 */

export interface ConsumptionFormState {
  itemId: number | null;
  /** Kept alongside the id purely so the picker's chosen row can be displayed without a refetch. */
  itemName: string;
  reason: ConsumptionReason;
  /**
   * The quantity, as ROWS rather than a number.
   *
   * "1 scoop and 15 g" is one quantity a person states in one breath and cannot state in one
   * number. `deriveUnitLinesPayload` collapses these back into the four wire fields.
   */
  unitRows: StockUnitLine[];
  /** IST wall clock, zone-less. Empty means "let the server stamp it". */
  consumedAt: string;
  notes: string;
}

/**
 * A blank form.
 *
 * `reason` starts at SERVICE_USE rather than empty: it is the reason behind almost every record, an
 * empty enum has no legal representation on the wire, and a required picker that starts unset makes
 * the commonest case the slowest one.
 *
 * `consumedAt` starts EMPTY rather than at "now". The server stamps it when the field is absent,
 * and a form pre-filled with a timestamp that keeps ticking would be stale by the time it is
 * submitted — worse, it would look like the user chose it.
 */
export function emptyForm(): ConsumptionFormState {
  return {
    itemId: null,
    itemName: '',
    reason: 'SERVICE_USE',
    unitRows: [],
    consumedAt: '',
    notes: '',
  };
}

/**
 * A saved record as form state.
 *
 * Only used to seed the READ view — there is no edit mode — so the quantity is left exactly as the
 * server sent it and rendered through `recordQtyLabel`, rather than being split back into rows.
 * Splitting would have to guess a ladder the record does not carry.
 */
export function toFormState(record: ConsumptionDto | null): ConsumptionFormState {
  if (!record) return emptyForm();
  return {
    itemId: record.itemId ?? null,
    itemName: record.itemName ?? '',
    reason: (record.reason ?? 'SERVICE_USE') as ConsumptionReason,
    unitRows: Array.isArray(record.unitLines) ? record.unitLines : [],
    consumedAt: record.consumedAt ?? '',
    notes: (record.notes as string) ?? '',
  };
}

/**
 * The POST body.
 *
 * The quantity half is DONE and is the part worth reading: `deriveUnitLinesPayload` owns the choice
 * between the scalar and the mixed shape, and getting that choice wrong is silent — a mixed record
 * sent with the level's multiplier still attached deducts `perStock` times too much stock. Never
 * assemble `quantity` / `unitName` / `unitMultiplier` / `unitLines` by hand; take all four from
 * that one call.
 *
 * Returns null when nothing has been entered, which the caller must treat as a validation failure
 * rather than posting a zero.
 *
 * ⚠️ `itemName` IS sent, even though the type marks it optional and the server will fill it in.
 * Two reasons, and the second one is the expensive one:
 *
 *   • the row must survive the product being deleted, which is the whole point of denormalising it;
 *   • `/byBusiness`'s `search` matches `itemName` and NOTHING ELSE. A record that reaches the
 *     database without one is not merely missing a label — it can never be found by search again,
 *     and there is no PUT to repair it with.
 *
 * ⚠️ `consumedAt` maps the empty string to `null`, never to `''`. Spring reads `''` as a malformed
 * date and answers 400, whereas `null` means "stamp it now" — the same `trim() || null` shape
 * `notes` uses, and for the same reason.
 *
 * ⚠️ There is deliberately no `batchId` and no `appointmentId`. The server picks the batches itself,
 * FEFO, and a consumption is not tied to an appointment. There is also no `inventoryType`: a
 * consumption always draws from RAW and the server fixes it. Wastage, which can write off either
 * pool, does send one.
 */
export function buildCreatePayload(
  form: ConsumptionFormState,
  businessId: number,
): ConsumptionPayload | null {
  const quantity = deriveUnitLinesPayload(form.unitRows);
  if (!quantity) return null;

  return {
    businessId,
    itemId: form.itemId as number,
    // Never `''`: an empty name would overwrite the server's own derivation with nothing and leave
    // the row unsearchable, which is the one failure this field exists to prevent.
    itemName: form.itemName.trim() || null,
    reason: form.reason,
    // All four from one call — see above.
    quantity: quantity.quantity,
    unitName: quantity.unitName,
    unitMultiplier: quantity.unitMultiplier,
    unitLines: quantity.unitLines,
    consumedAt: form.consumedAt.trim() || null,
    // `|| null`, never the trimmed empty string: a whitespace-only note is not a note, and the
    // server stores `''` as one.
    notes: form.notes.trim() || null,
  };
}

// ─── RAW stock, per product ──────────────────────────────────────────────────
//
// The picker's mockup puts a stock figure and its breakdown on EVERY row, and the form's helper
// needs the same numbers for the one chosen product. Both are served from ONE page of the
// business's active RAW batches, folded into a lookup here.
//
// One request rather than one per row, and that is not just a performance note: `loadProductOptions`
// fetches up to 500 products, so `getTotalStock` per row would be up to 500 requests fired the
// moment a user taps "Select product". The exact per-product figure is still fetched separately for
// the one product they actually pick, which is the number validation refuses an over-draw against.

/** What one product has on the RAW shelf, folded out of its batches. */
export interface RawStockEntry {
  /** Base units remaining across every active batch. */
  baseQty: number;
  /** How many of those batches still hold stock — the "Across N active RAW batches" figure. */
  activeBatches: number;
  /** The level those batches were stocked in, for the breakdown. Null when they carry none. */
  level: SaleUnit | null;
}

/**
 * Fold a page of RAW batches into a per-product lookup.
 *
 * Batches at zero are skipped entirely rather than counted with a zero: FEFO cannot draw from them,
 * so including them in `activeBatches` would put a number in the helper line that does not match
 * what the deduction will actually do.
 *
 * The first level seen wins. A product stocked in two different levels has no single right answer,
 * and picking one is better than dropping the breakdown for everyone — the total above it is exact
 * either way.
 */
export function aggregateRawStock(
  batches: BatchDto[] | null | undefined,
): Record<number, RawStockEntry> {
  const out: Record<number, RawStockEntry> = {};
  for (const batch of batches ?? []) {
    const itemId = Number(batch?.itemId);
    if (!Number.isFinite(itemId)) continue;
    const remaining = Number(batch?.remainingQuantity ?? 0);
    if (!Number.isFinite(remaining) || remaining <= 0) continue;

    const entry = out[itemId] ?? { baseQty: 0, activeBatches: 0, level: null };
    entry.baseQty += remaining;
    entry.activeBatches += 1;
    entry.level = entry.level ?? displayLevel(batch);
    out[itemId] = entry;
  }
  return out;
}

/**
 * A product's base unit name, from its ladder and then from its bare `stockUnit`.
 *
 * 'unit' last rather than '' — every quantity label in this feature reads "45 <baseUnit>", and an
 * empty string renders "45 " with a hole where the unit should be.
 */
export function productBaseUnit(product: unknown): string {
  const fromLadder = baseSaleUnit(saleUnitsOf(product))?.unit;
  if (fromLadder) return fromLadder;
  const stockUnit = String((product as { stockUnit?: unknown })?.stockUnit ?? '').trim();
  return stockUnit || 'unit';
}

/**
 * The picker row's trailing stock slot: a total, and the level it breaks into.
 *
 * The breakdown is dropped when it would only repeat the total — a base-unit product's "180 g"
 * under "180 g" is noise, and the slot is two lines tall either way.
 *
 * A product with no batches at all still renders "0 <unit>" rather than nothing, because the row is
 * about to be drawn inert and a blank slot would look like missing data instead of an empty shelf.
 */
export function pickerStock(
  entry: RawStockEntry | null | undefined,
  baseUnit: string,
): CatalogStock {
  const baseQty = entry?.baseQty ?? 0;
  const total = formatStockedQty(baseQty, null, baseUnit);
  const breakdown = formatStockedQty(baseQty, entry?.level ?? null, baseUnit);
  return { total, breakdown: breakdown === total ? null : breakdown };
}

/**
 * The row "Add unit" should create: the largest rung the editor is not already showing.
 *
 * Largest-first because `setProduct` seeds row one from the BASE rung, so the rung still worth
 * adding is always a bigger one — and `mixedUnitLabel` sorts descending anyway, so seeding in that
 * order means the rows read in the order they will be rendered.
 *
 * Falls back to a nameless base rung when the ladder offers nothing new. `showsAddUnitRow` should
 * have hidden the button by then; this is what stops a stale render from producing a row whose
 * `perStock` is undefined and whose quantity therefore multiplies by NaN.
 */
export function nextUnitRow(
  ladder: SaleUnit[] | null | undefined,
  rows: StockUnitLine[] | null | undefined,
): StockUnitLine {
  const used = new Set((rows ?? []).map((r) => r?.unit));
  const free = sortUnitLinesDesc(
    (ladder ?? []).map((u) => ({ unit: u.unit, perStock: u.perStock, qty: 0 })),
  ).find((u) => !used.has(u.unit));
  return free ? { ...free, qty: 0 } : { unit: '', perStock: 1, qty: 0 };
}

// ─── Consumed-at: a date field plus a clock ──────────────────────────────────
//
// The arithmetic moved to `shared/detail/wallClock.ts` when Expenses needed the same date+time
// pairing — a second copy of a timezone rule is how two screens come to disagree about what "now"
// is. Re-exported under this feature's own names so the contract reads locally and the existing
// tests keep pinning it.
//
// ⚠️ `consumedAt` is a ZONE-LESS `LocalDateTime` on the wire (`2026-08-08T14:30:00`) — an offset
// here THROWS server-side. That is why this re-exports `joinWallClock` and NOT the instant variant
// beside it, which exists for expense's `expenseDate`.

export {
  TIME_SLOTS as CONSUMED_TIME_SLOTS,
  formatClock,
  splitWallClock as splitConsumedAt,
  joinWallClock as joinConsumedAt,
  snapToSlot,
} from '../../shared/detail/wallClock';
