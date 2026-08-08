import type {
  ConsumptionDeduction,
  ConsumptionDto,
  ConsumptionReason,
} from '../../../backend/modules/shared/consumption.types';
import {
  effMult,
  isMixedUnitLines,
  recordQtyLabel,
  unitLinesBaseQty,
} from '../inventory/batchUnits';

/**
 * A consumption DTO reduced to what one list row draws.
 *
 * RN-free so the mapping is testable. `ConsumptionDto` itself lives in
 * `backend/modules/shared/consumption.types.ts` — this file is only the row, the same split
 * `batch.model.ts` uses.
 */

export interface ConsumptionRow {
  id: number | null;
  name: string;
  /** "1 strip · 8 tablets" — the recorded quantity in unit names, mixed or scalar. */
  qtyText: string;
  /** Raw enum, not a label: the card tints from it, and the label is the view layer's job. */
  reason: ConsumptionReason | null;
  /** "05 Aug, 5:10 PM". Empty when the record carries no timestamp. */
  whenText: string;
  /**
   * The batch this came out of — "BATCH-260722-03". Empty when the row does not carry one.
   *
   * Empty is the COMMON case on a list row, not an error: `/byBusiness` does not enrich
   * `deductions`, so the card's meta line degrades to the timestamp alone rather than inventing a
   * reference. See `batchText`.
   */
  batchText: string;
  /**
   * How many batches the quantity came out of. Null when the row does not carry a ledger.
   *
   * Null ≠ 0. A list row has no `deductions` at all (the server only enriches the detail read), and
   * rendering that as "0 batches" would claim the consumption drew from nothing.
   */
  batchCount: number | null;
}

/**
 * The product's name.
 *
 * `itemName` is denormalised onto the record precisely because a consumption outlives the product
 * it was recorded against — which is exactly when a name matters most. Falls back to the id so a
 * row is never nameless.
 */
export function consumptionName(record: ConsumptionDto): string {
  return (
    record?.itemName?.trim() ||
    (record?.itemId != null ? `Product #${record.itemId}` : 'Unknown product')
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "05 Aug, 5:10 PM" — the card's timestamp, as the board writes it.
 *
 * ⚠️ Deliberately NOT `formatStamp` from `batch.model.ts`, which renders "22 Jul 2026, 10:15 AM".
 * The year is dropped because this list is a usage log read newest-first: every row a salon looks
 * at is from the last few days, so four characters of year on every card is noise where the batch
 * reference beside it is not. The day IS zero-padded, which `formatBatchDate` does not do — the
 * mockup writes "05 Aug", and a column of "5 Aug" / "12 Aug" reads ragged at this size.
 *
 * The meridiem is built by hand rather than left to `toLocaleTimeString`, for the reason
 * `formatStamp` states: that call renders lowercase on Chrome and uppercase elsewhere, and a label
 * that changes case with the JS engine is not something a test can pin.
 *
 * Empty — never "Invalid Date" — for a missing or unparseable instant.
 */
export function formatShortStamp(instant: string | null | undefined): string {
  if (!instant) return '';
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return '';
  const h24 = d.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const meridiem = h24 < 12 ? 'AM' : 'PM';
  const day = String(d.getDate()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${MONTHS[d.getMonth()]}, ${h12}:${minutes} ${meridiem}`;
}

/**
 * One deduction's batch reference: "BATCH-260722-03", falling back to "Batch #14".
 *
 * ⚠️ `ConsumptionDeduction` declares `{batchId, qty}` and nothing else, so the printed batch NUMBER
 * is read off the record defensively rather than assumed: the detail read is enriched server-side
 * and may carry it, a list row does not. Reading a key the type does not promise is the honest way
 * to render a label we would otherwise have to invent — and the id fallback means a row is never
 * left pointing at nothing.
 */
function deductionRef(deduction: ConsumptionDeduction | null | undefined): string {
  if (!deduction) return '';
  const number = (deduction as { batchNumber?: unknown }).batchNumber;
  const named = typeof number === 'string' ? number.trim() : '';
  if (named) return named;
  return deduction.batchId != null ? `Batch #${deduction.batchId}` : '';
}

/**
 * The batch reference the card and the detail sentence both draw.
 *
 * Four cases, and the empty one is the common one:
 *
 *   • the record carries its own `batchNumber`  → that
 *   • exactly one deduction                     → its reference
 *   • several                                   → "3 batches", because naming one would be a lie
 *   • no ledger at all (every list row)         → '', and the caller simply omits the segment
 *
 * FEFO can split a consumption across batches, so the single-batch sentence the mockup shows is the
 * common shape rather than the only one. Claiming "BATCH-260722-03" for a quantity that actually
 * came out of three is worse than saying how many.
 */
export function batchText(record: ConsumptionDto | null | undefined): string {
  const own = typeof record?.batchNumber === 'string' ? record.batchNumber.trim() : '';
  if (own) return own;

  const deductions = Array.isArray(record?.deductions) ? record.deductions : [];
  if (deductions.length === 1) return deductionRef(deductions[0]);
  if (deductions.length > 1) return `${deductions.length} batches`;
  return '';
}

export function toConsumptionRow(record: ConsumptionDto, baseUnit = 'unit'): ConsumptionRow {
  return {
    id: record?.id ?? null,
    name: consumptionName(record),
    qtyText: recordQtyLabel(
      {
        quantity: record?.quantity,
        unitName: record?.unitName,
        unitLines: record?.unitLines,
      },
      baseUnit,
    ),
    reason: record?.reason ?? null,
    whenText: formatShortStamp(record?.consumedAt),
    batchText: batchText(record),
    // Explicitly `null` when the key is absent, so "not enriched" and "drew from nothing" stay
    // different facts.
    batchCount: Array.isArray(record?.deductions) ? record.deductions.length : null,
  };
}

/**
 * The record's quantity as the two pieces the detail screen draws it in: `{ value: 45, unit: 'g' }`.
 *
 * Two pieces rather than one string because the mockup sets them at different sizes, which one
 * string cannot be. It is also the pair the delete warning names.
 *
 * ⚠️ `quantity` means one of two different things and this is the one place that knows which:
 *
 *   • mixed (2+ rows) — `quantity` is ALREADY the base total, and the unit is the ladder's base
 *     rung, which the rows carry.
 *   • single level    — `quantity` is in LEVEL units and `unitName` is that level's name. It is NOT
 *     multiplied out: "2 scoops" is what the user entered and what the screen should say back,
 *     where "60 g" would be a number they never typed.
 *
 * Multiplying the mixed branch by `unitMultiplier` is the silent overcount `deriveUnitLinesPayload`
 * exists to prevent on the way out — thirty times too much, with nothing on screen to say so.
 *
 * `value` is null — never 0 — when the record carries no quantity at all. "restocks 0 g" is a
 * sentence that should never print.
 */
export function recordQtyParts(
  record: ConsumptionDto | null | undefined,
  fallbackUnit = 'unit',
): { value: number | null; unit: string } {
  if (isMixedUnitLines(record?.unitLines)) {
    const lines = record?.unitLines ?? [];
    // The base rung, or the smallest one when nothing sits at ×1 — the same rule `baseSaleUnit`
    // applies to a catalog ladder.
    const base = [...lines].sort((a, b) => effMult(a?.perStock) - effMult(b?.perStock))[0];
    return { value: unitLinesBaseQty(lines), unit: base?.unit || fallbackUnit };
  }

  const unit = (record?.unitName || '').trim() || fallbackUnit;
  const qty = record?.quantity;
  if (qty === null || qty === undefined) return { value: null, unit };
  const n = Number(qty);
  return { value: Number.isFinite(n) ? n : null, unit };
}

/**
 * The card's second line: "05 Aug, 5:10 PM · BATCH-260722-03".
 *
 * Joined here rather than in the `.tsx` so the degraded shapes are testable — a list row has no
 * batch reference and must read as a bare timestamp, not as "05 Aug, 5:10 PM · ".
 */
export function cardMetaLine(row: Pick<ConsumptionRow, 'whenText' | 'batchText'>): string {
  return [row.whenText, row.batchText].filter(Boolean).join(' · ');
}

/**
 * The subtitle under the screen title.
 *
 * ⚠️ It does NOT claim a record count, and that is not an oversight. `/byBusiness` returns
 * `totalPages` and nothing else — `totalElements` is never set on these endpoints — so there is no
 * row count to show. Inventory's "128 batches · sorted by expiry" has a counts endpoint behind it;
 * this feature has none, and a number here could only ever be the page size or a guess.
 */
export function listSubtitle(filtered: boolean): string {
  // "Raw stock usage" verbatim from the board, with a tail only when there is something to say.
  // Inventory's subtitle carries "sorted by expiry"; this one deliberately does NOT carry "newest
  // first", because `hasActiveFilters` counts an ascending sort as narrowing — so the unfiltered
  // branch is the ONLY one where that claim would be true, and a sort tail that appears in one
  // branch and not the other reads as a glitch rather than as information.
  return filtered ? 'Raw stock usage · filtered' : 'Raw stock usage';
}
