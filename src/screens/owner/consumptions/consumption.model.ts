import type {
  ConsumptionDto,
  ConsumptionReason,
} from '../../../backend/modules/shared/consumption.types';
import { formatStamp } from '../inventory/batch.model';
import { recordQtyLabel } from '../inventory/batchUnits';

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
  /** "22 Jul 2026, 10:15 AM". Empty when the record carries no timestamp. */
  whenText: string;
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
    whenText: formatStamp(record?.consumedAt),
    // Explicitly `null` when the key is absent, so "not enriched" and "drew from nothing" stay
    // different facts.
    batchCount: Array.isArray(record?.deductions) ? record.deductions.length : null,
  };
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
  // FEATURE: the exact wording. The rule — no count — is the part that must survive an edit.
  return filtered ? 'Filtered · newest first' : 'Raw stock used during services · newest first';
}
