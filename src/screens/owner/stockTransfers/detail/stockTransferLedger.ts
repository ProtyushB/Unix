import type { InventoryType } from '../../../../backend/modules/shared/inventory.types';
import type {
  StockTransferDto,
  StockTransferLine,
} from '../../../../backend/modules/shared/stockTransfer.types';
import { formatStockedQty } from '../../inventory/batchUnits';
import { poolLabel } from '../stockTransfer.view';

/**
 * The Batch breakdown on the detail screen: which source batch each hop drew from, and which
 * destination batch it landed in.
 *
 * ⚠️ THE LEDGER IS `record.lines`, NOT `record.deductions`, and a hop is
 * `{sourceBatchId, destBatchId, quantity}` — NOT `{batchId, qty}`. Consumption and wastage use the
 * other name and the other amount key. Both features name their local variable `lines` and map it
 * the same way, so the two blocks look copy-pasteable; a copy renders an EMPTY table with no error
 * at all, or fills every amount cell with `undefined`. Reading through this file is what makes that
 * a compile error.
 *
 * RN-free so jest covers it — everything here is a label, and labels are what drift.
 */

/**
 * The batch-number fields the server MAY enrich a hop with.
 *
 * Read through a cast rather than declared on `StockTransferLine`, which lives in
 * `backend/modules/shared` and states only the three keys the endpoint is documented to return.
 * Widening a shared type on the strength of a field one screen hopes for is how a type stops being
 * a contract; reading defensively here costs one cast and lies to nobody.
 */
interface EnrichedLine {
  sourceBatchNumber?: string | null;
  destBatchNumber?: string | null;
}

function batchNumberOf(line: StockTransferLine, key: keyof EnrichedLine): string {
  const value = (line as unknown as EnrichedLine)[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * A transfer-minted batch number: the source's, suffixed `-T1`, `-T2`, …
 *
 * The server mints the destination batch (`source: 'STOCK_TRANSFER'`, which is why such a batch can
 * never be deleted) and names it after the batch it came from, so the pair reads as one movement on
 * the inventory list. Derived here only when the response did not carry the real number — an
 * explicit `destBatchNumber` always wins.
 */
export function mintedBatchNumber(sourceBatchNumber: string, hopIndex: number): string {
  return `${sourceBatchNumber}-T${hopIndex + 1}`;
}

/** Whether a batch number was minted by a transfer, which is what earns the row its `New` badge. */
export function isMintedBatchNumber(batchNumber: string): boolean {
  return /-T\d+$/.test(batchNumber);
}

export interface TransferHop {
  /** Stable across renders — the two ids identify the hop even when a batch has no number. */
  key: string;
  /** "700 ml" — base units moved on this hop. From `quantity`, NOT `qty`. */
  qtyText: string;
  /** "BATCH-260710-02", or "Batch #41" when the response carried no number. */
  sourceBatch: string;
  destBatch: string;
  /** True when the destination batch is one this transfer created. Draws the `New` badge. */
  destIsNew: boolean;
}

/** "BATCH-260710-02" when the server sent one, else an id the user can still quote at support. */
function labelFor(batchNumber: string, id: number | null | undefined): string {
  if (batchNumber) return batchNumber;
  return id == null ? '—' : `Batch #${id}`;
}

/**
 * The ledger rows, in the order the server drew them (soonest expiry first).
 *
 * Not sorted here. FEFO order IS the information — re-ordering by id or by quantity would throw
 * away the only record of which stock actually left.
 */
export function toTransferHops(
  lines: StockTransferLine[] | null | undefined,
  baseUnit = 'unit',
): TransferHop[] {
  return (lines ?? []).map((line, index) => {
    const sourceNumber = batchNumberOf(line, 'sourceBatchNumber');
    const explicitDest = batchNumberOf(line, 'destBatchNumber');
    const destNumber =
      explicitDest || (sourceNumber ? mintedBatchNumber(sourceNumber, index) : '');
    return {
      key: `${line?.sourceBatchId}-${line?.destBatchId}-${index}`,
      // ⚠️ `quantity`, not `qty`. A consumption hop's amount key is the other one, and reading it
      // here fills every amount cell with `undefined`.
      qtyText: formatStockedQty(Number(line?.quantity ?? 0), null, baseUnit),
      sourceBatch: labelFor(sourceNumber, line?.sourceBatchId),
      destBatch: labelFor(destNumber, line?.destBatchId),
      // A destination batch the server minted carries the `-T` suffix. When the response gave us no
      // number at all we derived nothing, so we claim nothing — an unbadged row is honest, an
      // unearned "New" badge is not.
      destIsNew: isMintedBatchNumber(destNumber),
    };
  });
}

/** Whether the detail screen has a ledger to draw. A list row never does — see `hopCount`. */
export function hasLedger(record: StockTransferDto | null | undefined): boolean {
  return Array.isArray(record?.lines) && record.lines.length > 0;
}

/** The two fixed labels on a hop, kept here so the pair cannot drift apart in the JSX. */
export const HOP_SOURCE_LABEL = 'Drawn from source batch';
export const HOP_DEST_LABEL = 'into new destination batch';

/**
 * The sentence under Delete & reverse: exactly what deleting this record would undo.
 *
 * Names the quantity and where it goes back to, because "Delete" alone does not describe a
 * reversal — and this is the one action on the screen that moves stock.
 *
 * Null when there is no ledger to describe. The confirm dialog still warns generically; a specific
 * promise we cannot back with numbers would be worse than the general one.
 */
export function reversalNote(
  record: StockTransferDto | null | undefined,
  baseUnit = 'unit',
): string | null {
  const lines = record?.lines;
  if (!Array.isArray(lines) || lines.length === 0) return null;

  const total = lines.reduce((sum, line) => sum + (Number(line?.quantity) || 0), 0);
  const hops = toTransferHops(lines, baseUnit);
  const destination =
    hops.length === 1 ? hops[0].sourceBatch : `${hops.length} batches`;
  const createdPool = poolLabel((record?.destType ?? null) as InventoryType | null);

  return `Returns ${formatStockedQty(total, null, baseUnit)} to ${destination} and removes the created ${createdPool} batch.`;
}
