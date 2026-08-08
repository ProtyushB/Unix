import type { InventoryType } from '../../../backend/modules/shared/inventory.types';
import type {
  StockTransferDto,
  StockTransferReason,
} from '../../../backend/modules/shared/stockTransfer.types';
import { formatStamp } from '../inventory/batch.model';
import { recordQtyLabel } from '../inventory/batchUnits';

/**
 * A stock-transfer DTO reduced to what one list row draws.
 *
 * RN-free so the mapping is testable. `StockTransferDto` itself lives in
 * `backend/modules/shared/stockTransfer.types.ts` — this file is only the row, the same split
 * `batch.model.ts` uses.
 */

export interface StockTransferRow {
  id: number | null;
  name: string;
  /** "1 bottle · 200 ml" — the moved quantity in unit names. */
  qtyText: string;
  /**
   * The two ends of the move, as the RECORD states them.
   *
   * Kept as the raw pools rather than a rendered arrow because these — not `reason` — are the truth
   * about which way the stock went. A record can carry `reason: 'PRODUCT_TO_RAW'` with
   * `sourceType: 'RAW_INVENTORY'`; the server accepts it, and a row that drew its arrow from the
   * reason would show the move backwards.
   */
  sourceType: InventoryType | null;
  destType: InventoryType | null;
  /** Raw enum, not a label: the label is the view layer's job. */
  reason: StockTransferReason | null;
  /** "22 Jul 2026, 10:15 AM". Empty when the record carries no timestamp. */
  whenText: string;
  /**
   * How many source→destination hops the move took. Null when the row does not carry a ledger.
   *
   * Null ≠ 0. A list row has no `lines` at all (the server only enriches the detail read), and
   * rendering that as "0 batches" would claim the transfer moved nothing.
   */
  hopCount: number | null;
}

/**
 * The product's name.
 *
 * `itemName` is denormalised onto the record precisely because a transfer outlives the product it
 * was recorded against. Falls back to the id so a row is never nameless.
 */
export function stockTransferName(record: StockTransferDto): string {
  return (
    record?.itemName?.trim() ||
    (record?.itemId != null ? `Product #${record.itemId}` : 'Unknown product')
  );
}

export function toStockTransferRow(record: StockTransferDto, baseUnit = 'unit'): StockTransferRow {
  return {
    id: record?.id ?? null,
    name: stockTransferName(record),
    qtyText: recordQtyLabel(
      {
        quantity: record?.quantity,
        unitName: record?.unitName,
        // Almost always null on the way back: the server discards what it was sent.
        unitLines: record?.unitLines,
      },
      baseUnit,
    ),
    sourceType: record?.sourceType ?? null,
    destType: record?.destType ?? null,
    reason: record?.reason ?? null,
    whenText: formatStamp(record?.transferredAt),
    // ⚠️ `lines`, NOT `deductions`. Consumption and wastage use the other name and the other amount
    // key; reading the wrong one here yields undefined and a silent null.
    hopCount: Array.isArray(record?.lines) ? record.lines.length : null,
  };
}

/**
 * The subtitle under the screen title.
 *
 * ⚠️ It does NOT claim a record count, and that is not an oversight. `/byBusiness` returns
 * `totalPages` and nothing else — `totalElements` is never set on these endpoints — so there is no
 * row count to show.
 */
export function listSubtitle(filtered: boolean): string {
  // FEATURE: the exact wording. The rule — no count — is the part that must survive an edit.
  return filtered ? 'Filtered · newest first' : 'Stock moved between pools · newest first';
}
