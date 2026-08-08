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
  /**
   * IST wall clock, zone-less. READ-ONLY in practice: the payload has no `transferredAt` key — the
   * controller ignores it and stamps the row itself — so nothing on the form writes this. It is
   * populated by `toFormState` only, so a saved record round-trips through the same shape.
   */
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
 * The POST body — exactly the nine keys the controller reads, and no others.
 *
 * ⚠️ This is BATCH-addressed on the source side. `sourceBatchId` is what the transfer is addressed
 * by; the server derives the product AND the source pool from it. So `itemId`, `itemName` and
 * `sourceType` are deliberately absent even though the form holds all three — it needs `sourceType`
 * for its own direction logic and to decide WHICH batch this is, it just does not send it. See
 * `StockTransferPayload` for the full list of what was dropped and why.
 *
 * The quantity half is the part worth reading: `deriveUnitLinesPayload` owns the choice between the
 * scalar and the mixed shape. On this form the rows are clamped to one, so it always takes the
 * scalar branch — but it is still called rather than inlined, because the clamp lives in the hook
 * and a future change there must not silently produce a payload this file built by hand. Its
 * `unitLines` result is DROPPED on the floor here: the payload has no such key, so a mixed entry
 * would post its base total with `unitMultiplier: 1` and be correct about the amount, which is the
 * safe way for an unreachable branch to fail.
 *
 * Returns null when nothing has been entered OR when no source batch could be resolved. Both are
 * validation failures rather than things to post: a zero means nothing, and a body without
 * `sourceBatchId` fails bean validation with a 400 naming a field the form never showed anyone.
 */
export function buildCreatePayload(
  form: StockTransferFormState,
  businessId: number,
  sourceBatchId: number | null,
): StockTransferPayload | null {
  const quantity = deriveUnitLinesPayload(form.unitRows);
  if (!quantity) return null;
  if (sourceBatchId == null) return null;

  return {
    businessId,
    // The addressing field. See above for why the product and the source pool are absent.
    sourceBatchId,
    destType: form.destType,
    reason: form.reason,
    // Three of the four from one call — `unitLines` has no key on this payload.
    quantity: quantity.quantity,
    unitName: quantity.unitName,
    unitMultiplier: quantity.unitMultiplier,
    // `|| null`, never the trimmed empty string: a whitespace-only note is not a note, and the
    // server stores `''` as one.
    notes: form.notes.trim() || null,
  };
}
