import type {
  InventoryType,
  StockUnitLine,
} from '../../../../backend/modules/shared/inventory.types';
import type {
  WastageDeduction,
  WastageDto,
  WastagePayload,
  WastageReason,
} from '../../../../backend/modules/shared/wastage.types';
import {
  deriveUnitLinesPayload,
  effMult,
  isMixedUnitLines,
  recordQtyLabel,
} from '../../inventory/batchUnits';

/**
 * Form state and the create payload for the Wastage Detail screen.
 *
 * There is no update payload. A wastage is immutable — the backend has no PUT — so this file only
 * ever builds a POST body.
 */

export interface WastageFormState {
  itemId: number | null;
  /** Kept alongside the id purely so the picker's chosen row can be displayed without a refetch. */
  itemName: string;
  /**
   * Which pool to write off from.
   *
   * The field that has no safe default and no way to infer one — the same product can hold stock in
   * both pools, and the two are different stock. Wastage is the only one of the three features that
   * asks.
   */
  inventoryType: InventoryType;
  reason: WastageReason;
  /**
   * The quantity, as ROWS rather than a number.
   *
   * "1 bottle and 100 ml" is one quantity a person states in one breath and cannot state in one
   * number. `deriveUnitLinesPayload` collapses these back into the four wire fields.
   */
  unitRows: StockUnitLine[];
  /** IST wall clock, zone-less. Empty means "let the server stamp it". */
  reportedAt: string;
  notes: string;
}

/**
 * A blank form.
 *
 * `inventoryType` starts on PRODUCT because that is the pool the Wastage tab is reached from most
 * often, and because a segmented control has to start somewhere — but the validator still requires
 * the user to have looked at it, and `poolDescription` spells out what each one means.
 *
 * `reason` starts at DAMAGED, which is what the Record Wastage board draws pre-selected, and an
 * empty enum has no legal representation on the wire anyway.
 *
 * `reportedAt` starts EMPTY rather than at "now". The server stamps it when the field is absent, and
 * a form pre-filled with a timestamp that keeps ticking would be stale by the time it is submitted.
 */
export function emptyForm(): WastageFormState {
  return {
    itemId: null,
    itemName: '',
    inventoryType: 'PRODUCT_INVENTORY',
    reason: 'DAMAGED',
    unitRows: [],
    reportedAt: '',
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
export function toFormState(record: WastageDto | null): WastageFormState {
  if (!record) return emptyForm();
  return {
    itemId: record.itemId ?? null,
    itemName: record.itemName ?? '',
    inventoryType: (record.inventoryType ?? 'PRODUCT_INVENTORY') as InventoryType,
    // Falls back to the blank form's reason for a record with no reason, but note it must ACCEPT
    // `CORRECTION`: no chip offers that value, yet a system-written record can carry it and still
    // has to render.
    reason: (record.reason ?? emptyForm().reason) as WastageReason,
    unitRows: Array.isArray(record.unitLines) ? record.unitLines : [],
    reportedAt: record.reportedAt ?? '',
    notes: (record.notes as string) ?? '',
  };
}

// ─── Which batch ─────────────────────────────────────────────────────────────
//
// A wastage is addressed by a BATCH, not by a product — the server reads the product, its name and
// the pool off the batch and overwrites those keys if a client sends them. So the form's product +
// pool have to be resolved into one batch id before the payload can be built, and this is where
// that happens rather than in the screen, so it can be tested.

/** A batch, as loosely as this file needs to read one. Matches `BatchDto`'s relevant keys. */
export interface WriteOffBatch {
  id?: number | null;
  status?: string | null;
  remainingQuantity?: number | null;
  batchNumber?: string | null;
  inventoryType?: InventoryType | null;
}

/**
 * The batch a write-off starts from: the LOWEST-ID ACTIVE batch that still has stock.
 *
 * Lowest id rather than nearest expiry, deliberately — it is what the server itself starts from,
 * and a client that picked a different one would show the user one batch and have the write-off
 * come out of another. If the quantity is larger than that batch holds the server OVERFLOWS into
 * the ones after it by itself and reports what it actually took in `deductions`; the client never
 * splits the quantity and there is no batch picker anywhere in this feature.
 *
 * Only ACTIVE counts. An ON_HOLD, QUARANTINED, EXPIRED or DEPLETED batch is not stock the server
 * will draw from, so offering one produces a refusal the user cannot act on. (Writing off an
 * EXPIRED batch has its own affordance — inventory's Dispose — which is a different endpoint.)
 *
 * Null when there is nothing to write off, which is the signal the validator turns into a message.
 */
export function pickWriteOffBatch(batches: WriteOffBatch[] | null | undefined): number | null {
  const usable = (batches ?? []).filter(
    (b) => b?.id != null && b?.status === 'ACTIVE' && Number(b?.remainingQuantity ?? 0) > 0,
  );
  if (!usable.length) return null;
  return usable.reduce((lowest, b) => (Number(b.id) < lowest ? Number(b.id) : lowest), Infinity);
}

/** Base units on hand across the batches a write-off could draw from. Never negative. */
export function availableBaseQty(batches: WriteOffBatch[] | null | undefined): number {
  return (batches ?? [])
    .filter((b) => b?.status === 'ACTIVE')
    .reduce((sum, b) => sum + Math.max(0, Number(b?.remainingQuantity ?? 0)), 0);
}

/** How many batches hold that stock — the "across 3 batches" half of the helper line. */
export function writeOffBatchCount(batches: WriteOffBatch[] | null | undefined): number {
  return (batches ?? []).filter(
    (b) => b?.status === 'ACTIVE' && Number(b?.remainingQuantity ?? 0) > 0,
  ).length;
}

/**
 * "Available: 6,000 ml across 3 batches · written off oldest-first."
 *
 * The tail is not decoration: it is the only place the screen tells the user that one entry can
 * span several batches, which is why there is no batch picker to look for. Dropped when there is
 * exactly one batch, where "oldest-first" describes nothing.
 *
 * Null before a product is picked — null is NOT zero, and "Available: 0" would read as an empty
 * shelf rather than as an unanswered question.
 */
export function availabilityHelper(
  batches: WriteOffBatch[] | null | undefined,
  baseUnit = 'unit',
): string | null {
  if (!batches) return null;
  const total = availableBaseQty(batches);
  const count = writeOffBatchCount(batches);
  if (count === 0) return `No stock available in this pool.`;
  const head = `Available: ${total.toLocaleString('en-IN')} ${baseUnit} across ${count} ${
    count === 1 ? 'batch' : 'batches'
  }`;
  return count === 1 ? `${head}.` : `${head} · written off oldest-first.`;
}

/** The entered rows as BASE units, for comparing against what the pool actually holds. */
export function enteredBaseQty(form: WastageFormState): number {
  const quantity = deriveUnitLinesPayload(form.unitRows);
  if (!quantity) return 0;
  return quantity.unitLines
    ? quantity.quantity
    : quantity.quantity * effMult(quantity.unitMultiplier);
}

/**
 * The POST body.
 *
 * The quantity half is the part worth reading: `deriveUnitLinesPayload` owns the choice between the
 * scalar and the mixed shape, and getting that choice wrong is silent — a mixed record sent with
 * the level's multiplier still attached writes off `perStock` times too much stock. Never assemble
 * `quantity` / `unitName` / `unitMultiplier` / `unitLines` by hand; take all four from that call.
 *
 * ⚠️ `itemId`, `itemName` and `inventoryType` are deliberately NOT here. The server derives all
 * three from `batchId` and overwrites whatever a client puts in them, so sending them would be
 * three fields that look authoritative and are not. The POOL is still asked for on the form — it is
 * what decides which batch `pickWriteOffBatch` returns — it just does not travel as its own key.
 *
 * `reportedAt` is not sent either: the form collects no date, and the server stamps it. (Unlike
 * consumption's `consumedAt` the server runs no date validation on it, so a future value would be
 * accepted rather than refused — a second reason not to offer the field.)
 *
 * Returns null when nothing has been entered OR when no batch could be resolved. Both are
 * validation failures rather than things to post: a zero means nothing, and a payload with no
 * `batchId` is a 400 naming a field the form never showed anyone.
 */
export function buildCreatePayload(
  form: WastageFormState,
  businessId: number,
  batchId: number | null,
): WastagePayload | null {
  const quantity = deriveUnitLinesPayload(form.unitRows);
  if (!quantity) return null;
  if (batchId == null) return null;

  return {
    businessId,
    // The addressing field. See above for why the product and the pool are absent.
    batchId,
    reason: form.reason,
    // All four from one call — see above.
    quantity: quantity.quantity,
    unitName: quantity.unitName,
    unitMultiplier: quantity.unitMultiplier,
    unitLines: quantity.unitLines,
    // `|| null`, never the trimmed empty string: a whitespace-only note is not a note, and the
    // server stores `''` as one.
    notes: form.notes.trim() || null,
  };
}

// ─── Reading a saved record ──────────────────────────────────────────────────

/**
 * The write-off in BASE units — the big number at the top of the read screen.
 *
 * The two payload shapes have to be un-picked here, and it is the same trap in reverse:
 *
 *   • mixed (`unitLines`, 2+) — `quantity` is ALREADY the base total, so multiplying by
 *     `unitMultiplier` (which is 1 on that branch anyway) is a no-op, but reading `unitLines`
 *     instead would be a second source of truth.
 *   • scalar — `quantity` is in LEVEL units, so the base figure is `quantity × unitMultiplier`.
 *     Rendering the raw `quantity` here would report "2" for two 500 ml bottles.
 *
 * Null quantity stays null rather than becoming 0 — a record with nothing recorded is not a record
 * of zero.
 */
export function wastageBaseQty(record: WastageDto | null | undefined): number | null {
  const qty = record?.quantity;
  if (qty === null || qty === undefined) return null;
  const n = Number(qty);
  if (!Number.isFinite(n)) return null;
  if (isMixedUnitLines(record?.unitLines)) return n;
  return n * effMult(record?.unitMultiplier ?? 1);
}

/**
 * "Entered as 1 bottle · 100 ml" — how the quantity was typed, under the base-unit figure.
 *
 * Null when it would only restate the line above it: a record entered straight in base units has
 * nothing to translate, and "600 ml / Entered as 600 ml" is noise that makes the reader look for a
 * difference that is not there.
 */
export function enteredAsLine(
  record: WastageDto | null | undefined,
  baseUnit = 'unit',
): string | null {
  if (!record) return null;
  const label = recordQtyLabel(
    { quantity: record.quantity, unitName: record.unitName, unitLines: record.unitLines },
    baseUnit,
  );
  if (!label || label === '—') return null;
  const base = wastageBaseQty(record);
  if (base === null) return null;
  if (label === `${base} ${baseUnit}`) return null;
  return `Entered as ${label}`;
}

// ─── The batch ledger ────────────────────────────────────────────────────────

/** One row of the Batch breakdown table: which batch, and how much came out of it. */
export interface BatchBreakdownRow {
  batchId: number;
  /** "BATCH-260620-04", or "Batch #88" when the number could not be resolved. */
  batchLabel: string;
  /** "400 ml" — base units, which is what a deduction is always measured in. */
  qtyText: string;
}

/**
 * The FEFO ledger, ready to draw.
 *
 * ⚠️ Reads `deductions` with a `qty` per row. A stock transfer's ledger is `lines` with a
 * `quantity`, and the two blocks look copy-pasteable — a copy renders an EMPTY table with no error
 * at all, because `record.lines` is undefined here and `row.quantity` is undefined there.
 *
 * `batchNumbers` maps id → printed batch number. It is optional because the ledger the server sends
 * carries ids only: the screen hydrates the map from the product's batches when it can, and a row
 * whose id is not in the map falls back to `Batch #<id>` rather than rendering a hole.
 */
export function toBatchBreakdown(
  deductions: WastageDeduction[] | null | undefined,
  baseUnit = 'unit',
  batchNumbers: Record<number, string> = {},
): BatchBreakdownRow[] {
  return (deductions ?? [])
    .filter((d) => d?.batchId != null)
    .map((d) => {
      const id = Number(d.batchId);
      const qty = Number(d.qty ?? 0);
      return {
        batchId: id,
        batchLabel: batchNumbers[id]?.trim() || `Batch #${id}`,
        qtyText: `${Number.isFinite(qty) ? qty.toLocaleString('en-IN') : 0} ${baseUnit}`,
      };
    });
}

// `recordBaseUnit` lives in `../wastage.model` — the LIST needs it too, for exactly the same
// reason, and one copy per screen would be two chances to disagree about the same record.
export { recordBaseUnit } from '../wastage.model';
