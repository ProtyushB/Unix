import type {
  InventoryType,
  StockUnitLine,
} from '../../../../backend/modules/shared/inventory.types';
import type {
  StockTransferDto,
  StockTransferPayload,
  StockTransferReason,
} from '../../../../backend/modules/shared/stockTransfer.types';
import { deriveUnitLinesPayload } from '../../inventory/batchUnits';

/**
 * Form state and the create payload for the Stock Transfer Detail screen.
 *
 * There is no update payload. A transfer is immutable — the backend has no PUT — so this file only
 * ever builds a POST body.
 */

export interface StockTransferFormState {
  itemId: number | null;
  /** Kept alongside the id purely so the picker's chosen row can be displayed without a refetch. */
  itemName: string;
  /** The pool stock LEAVES. Must differ from `destType` — a transfer is always cross-pool. */
  sourceType: InventoryType;
  /** The pool stock ARRIVES in. Derived from the source; see `oppositePool`. */
  destType: InventoryType;
  reason: StockTransferReason;
  /**
   * The quantity, as ROWS — clamped to ONE by `clampUnitRows(rows, false)`.
   *
   * ⚠️ Still an array rather than a scalar, so this form shares `UnitRowsEditor` and
   * `deriveUnitLinesPayload` with its two siblings. The clamp, not the type, is what stops a second
   * row: the server DISCARDS `unitLines` on a transfer and rebuilds the destination batch from the
   * scalar total, so a breakdown would be typed, sent, dropped, and missing from the detail screen
   * the user lands on.
   */
  unitRows: StockUnitLine[];
  /** IST wall clock, zone-less. Empty means "let the server stamp it". */
  transferredAt: string;
  notes: string;
}

/**
 * A blank form.
 *
 * Product → Raw is the default direction because it is by far the commoner move — a salon opens a
 * sellable bottle to use it on clients far more often than it bottles raw stock for sale — and the
 * reason starts CONSISTENT with it. Keep the two in step: `directionalReason` exists so a direction
 * control never has to set them independently.
 *
 * `transferredAt` starts EMPTY rather than at "now". The server stamps it when the field is absent,
 * and a form pre-filled with a timestamp that keeps ticking would be stale by the time it is
 * submitted.
 */
export function emptyForm(): StockTransferFormState {
  return {
    itemId: null,
    itemName: '',
    sourceType: 'PRODUCT_INVENTORY',
    destType: 'RAW_INVENTORY',
    reason: 'PRODUCT_TO_RAW',
    unitRows: [],
    transferredAt: '',
    notes: '',
  };
}

/**
 * A saved record as form state.
 *
 * Only used to seed the READ view — there is no edit mode. `unitRows` is nearly always empty here
 * even for a record that was created with a breakdown: the server discards `unitLines` on a
 * transfer, so what comes back is the scalar. That is why the read view renders through
 * `recordQtyLabel` rather than from the rows.
 */
export function toFormState(record: StockTransferDto | null): StockTransferFormState {
  if (!record) return emptyForm();
  return {
    itemId: record.itemId ?? null,
    itemName: record.itemName ?? '',
    sourceType: (record.sourceType ?? 'PRODUCT_INVENTORY') as InventoryType,
    destType: (record.destType ?? 'RAW_INVENTORY') as InventoryType,
    reason: (record.reason ?? 'PRODUCT_TO_RAW') as StockTransferReason,
    unitRows: Array.isArray(record.unitLines) ? record.unitLines : [],
    transferredAt: record.transferredAt ?? '',
    notes: (record.notes as string) ?? '',
  };
}

/**
 * The POST body.
 *
 * The quantity half is DONE and is the part worth reading: `deriveUnitLinesPayload` owns the choice
 * between the scalar and the mixed shape. On this form the rows are clamped to one, so it will
 * always take the scalar branch — but it is still called rather than inlined, because the clamp
 * lives in the hook and a future change there must not silently produce a payload this file built
 * by hand.
 *
 * ⚠️ `unitLines` is sent as whatever that call returns (null on the scalar branch) and the server
 * would DISCARD an array anyway. Do not "fix" the UI to allow a second row on the strength of this
 * field existing on the type: the endpoint accepts it and throws it away.
 *
 * `sourceType` and `destType` must DIFFER — validated in `stockTransferDetail.view.ts`.
 *
 * Returns null when nothing has been entered, which the caller must treat as a validation failure
 * rather than posting a zero.
 *
 * The two fields that were left open, and what they settled on:
 *
 *   • `itemName` is NOT sent. The server fills it from `itemId`, and the only copy of it this form
 *     holds came from the picker — so sending it can only ever make the denormalised name WORSE
 *     (stale if the product was renamed between picking and saving) and never better.
 *   • `transferredAt` is sent as `trim() || null`. ⚠️ The empty string must become `null`, not `''`:
 *     Spring reads `''` as a malformed date and answers 400, whereas `null` means "stamp it now",
 *     which is exactly what an untouched form wants. `notes` below has the same shape.
 */
export function buildCreatePayload(
  form: StockTransferFormState,
  businessId: number,
): StockTransferPayload | null {
  const quantity = deriveUnitLinesPayload(form.unitRows);
  if (!quantity) return null;

  return {
    businessId,
    itemId: form.itemId as number,
    sourceType: form.sourceType,
    destType: form.destType,
    reason: form.reason,
    // All four from one call — see above.
    quantity: quantity.quantity,
    unitName: quantity.unitName,
    unitMultiplier: quantity.unitMultiplier,
    unitLines: quantity.unitLines,
    // `|| null`, never the trimmed empty string: a whitespace-only note is not a note, and the
    // server stores `''` as one.
    notes: form.notes.trim() || null,
    // Same shape, and here it is load-bearing rather than tidy: `''` is a 400, `null` is "stamp it
    // now". No `itemName` — see the note above.
    transferredAt: form.transferredAt.trim() || null,
  };
}
