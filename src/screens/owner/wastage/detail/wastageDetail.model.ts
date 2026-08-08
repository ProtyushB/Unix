import type {
  InventoryType,
  StockUnitLine,
} from '../../../../backend/modules/shared/inventory.types';
import type {
  WastageDto,
  WastagePayload,
  WastageReason,
} from '../../../../backend/modules/shared/wastage.types';
import { deriveUnitLinesPayload } from '../../inventory/batchUnits';

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
 * `reason` starts at EXPIRED: it is the commonest write-off, and an empty enum has no legal
 * representation on the wire.
 *
 * `reportedAt` starts EMPTY rather than at "now". The server stamps it when the field is absent, and
 * a form pre-filled with a timestamp that keeps ticking would be stale by the time it is submitted.
 */
export function emptyForm(): WastageFormState {
  return {
    itemId: null,
    itemName: '',
    inventoryType: 'PRODUCT_INVENTORY',
    reason: 'EXPIRED',
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
    // Falls back to EXPIRED for a record with no reason, but note it must ACCEPT `CORRECTION`: no
    // chip offers that value, yet a system-written record can carry it and still has to render.
    reason: (record.reason ?? 'EXPIRED') as WastageReason,
    unitRows: Array.isArray(record.unitLines) ? record.unitLines : [],
    reportedAt: record.reportedAt ?? '',
    notes: (record.notes as string) ?? '',
  };
}

/**
 * The POST body.
 *
 * The quantity half is DONE and is the part worth reading: `deriveUnitLinesPayload` owns the choice
 * between the scalar and the mixed shape, and getting that choice wrong is silent — a mixed record
 * sent with the level's multiplier still attached writes off `perStock` times too much stock. Never
 * assemble `quantity` / `unitName` / `unitMultiplier` / `unitLines` by hand; take all four from that
 * one call.
 *
 * `inventoryType` rides along and is REQUIRED, unlike consumption's (which the server fixes to RAW).
 *
 * Returns null when nothing has been entered, which the caller must treat as a validation failure
 * rather than posting a zero.
 *
 * FEATURE: the two fields left off the body. Decide and wire:
 *   • `itemName` — send it or leave the server to fill it from `itemId`.
 *   • `reportedAt` — ⚠️ the empty string must become `null`, not `''`. Spring reads `''` as a
 *     malformed date and answers 400, whereas `null` means "stamp it now". `notes` below shows the
 *     shape: `trim() || null`.
 */
export function buildCreatePayload(
  form: WastageFormState,
  businessId: number,
): WastagePayload | null {
  const quantity = deriveUnitLinesPayload(form.unitRows);
  if (!quantity) return null;

  return {
    businessId,
    itemId: form.itemId as number,
    inventoryType: form.inventoryType,
    reason: form.reason,
    // All four from one call — see above.
    quantity: quantity.quantity,
    unitName: quantity.unitName,
    unitMultiplier: quantity.unitMultiplier,
    unitLines: quantity.unitLines,
    // `|| null`, never the trimmed empty string: a whitespace-only note is not a note, and the
    // server stores `''` as one.
    notes: form.notes.trim() || null,
    // FEATURE: itemName / reportedAt — see the note above for the null-vs-empty trap.
  };
}
