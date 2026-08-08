import type { InventoryType } from '../../../backend/modules/shared/inventory.types';
import type { WastageDto, WastageReason } from '../../../backend/modules/shared/wastage.types';
import { formatStamp } from '../inventory/batch.model';
import { recordQtyLabel } from '../inventory/batchUnits';

/**
 * A wastage DTO reduced to what one list row draws.
 *
 * RN-free so the mapping is testable. `WastageDto` itself lives in
 * `backend/modules/shared/wastage.types.ts` — this file is only the row, the same split
 * `batch.model.ts` uses.
 */

export interface WastageRow {
  id: number | null;
  name: string;
  /** "1 bottle · 100 ml" — the written-off quantity in unit names, mixed or scalar. */
  qtyText: string;
  /** Raw enum, not a label: the card tints from it, and the label is the view layer's job. */
  reason: WastageReason | null;
  /**
   * Which pool this came out of.
   *
   * Carried on the row because wastage is the ONLY one of the three features that spans both pools
   * — a consumption is always RAW and a transfer has two ends — so "which stock did this destroy?"
   * is a question only this row can answer, and the answer is not derivable from anything else on
   * it.
   */
  inventoryType: InventoryType | null;
  /** "22 Jul 2026, 10:15 AM". Empty when the record carries no timestamp. */
  whenText: string;
  /**
   * How many batches the write-off came out of. Null when the row does not carry a ledger.
   *
   * Null ≠ 0. A list row has no `deductions` at all (the server only enriches the detail read), and
   * rendering that as "0 batches" would claim the write-off took stock from nothing.
   */
  batchCount: number | null;
}

/**
 * The product's name.
 *
 * `itemName` is denormalised onto the record precisely because a wastage outlives the product it
 * was recorded against — which is exactly when a name matters most. Falls back to the id so a row
 * is never nameless.
 */
export function wastageName(record: WastageDto): string {
  return (
    record?.itemName?.trim() ||
    (record?.itemId != null ? `Product #${record.itemId}` : 'Unknown product')
  );
}

export function toWastageRow(record: WastageDto, baseUnit = 'unit'): WastageRow {
  return {
    id: record?.id ?? null,
    name: wastageName(record),
    qtyText: recordQtyLabel(
      {
        quantity: record?.quantity,
        unitName: record?.unitName,
        unitLines: record?.unitLines,
      },
      baseUnit,
    ),
    reason: record?.reason ?? null,
    // Never defaulted to a pool. Guessing PRODUCT for a record that came out of RAW would put the
    // loss against the wrong stock in every read of the row.
    inventoryType: record?.inventoryType ?? null,
    whenText: formatStamp(record?.reportedAt),
    // Explicitly `null` when the key is absent, so "not enriched" and "took from nothing" stay
    // different facts.
    batchCount: Array.isArray(record?.deductions) ? record.deductions.length : null,
  };
}

/**
 * The subtitle under the screen title.
 *
 * ⚠️ It does NOT claim a record count, and that is not an oversight. `/byBusiness` returns
 * `totalPages` and nothing else — `totalElements` is never set on these endpoints — so there is no
 * row count to show, and no total value either: the endpoint reports no money figure.
 */
export function listSubtitle(filtered: boolean): string {
  // FEATURE: the exact wording. The rule — no count, no total — is the part that must survive an
  // FEATURE: edit.
  return filtered ? 'Filtered · newest first' : 'Stock written off · newest first';
}
