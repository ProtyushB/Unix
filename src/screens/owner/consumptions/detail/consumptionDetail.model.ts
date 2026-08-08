import type {
  ConsumptionDto,
  ConsumptionPayload,
  ConsumptionReason,
} from '../../../../backend/modules/shared/consumption.types';
import type { StockUnitLine } from '../../../../backend/modules/shared/inventory.types';
import { deriveUnitLinesPayload } from '../../inventory/batchUnits';

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
 * FEATURE: the two fields left off the body. Decide and wire:
 *   • `itemName` — send it or leave the server to fill it from `itemId`.
 *   • `consumedAt` — ⚠️ the empty string must become `null`, not `''`. Spring reads `''` as a
 *     malformed date and answers 400, whereas `null` means "stamp it now". `notes` below shows the
 *     shape: `trim() || null`.
 *
 * There is deliberately no `inventoryType`: a consumption always draws from RAW and the server
 * fixes it. Wastage, which can write off either pool, does send one.
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
    reason: form.reason,
    // All four from one call — see above.
    quantity: quantity.quantity,
    unitName: quantity.unitName,
    unitMultiplier: quantity.unitMultiplier,
    unitLines: quantity.unitLines,
    // `|| null`, never the trimmed empty string: a whitespace-only note is not a note, and the
    // server stores `''` as one.
    notes: form.notes.trim() || null,
    // FEATURE: itemName / consumedAt — see the note above for the null-vs-empty trap.
  };
}
