import type { InventoryType } from '../../../../backend/modules/shared/inventory.types';
import { todayIst } from '../../../../utils/dateRange';
import type { BatchDto } from '../batch.model';
import { effMult, toBasePrice, toBaseQty } from '../batchUnits';

/**
 * Form state and the create payload for the Batch Detail screen.
 *
 * There is no update payload. Batches are immutable — the backend has no PUT — so this file only
 * ever builds a POST body. Stock is corrected through wastage/transfer/consumption, lifecycle moves
 * go through the status endpoint, and an untouched batch can be deleted.
 */

export interface BatchFormState {
  inventoryType: InventoryType;
  itemId: number | null;
  /** Kept alongside the id purely so the picker's chosen row can be displayed without a refetch. */
  itemName: string;
  supplierName: string;
  manufactureDate: string;
  expiryDate: string;
  receivedDate: string;
  /** The chosen ladder rung's unit name. Empty for a base-unit product. */
  stockInUnit: string;
  /** Quantities and prices below are expressed PER THIS UNIT, not in base units. */
  stockInMultiplier: number;
  purchasedQuantity: string;
  remainingQuantity: string;
  costPrice: string;
  sellingPrice: string;
}

/**
 * A blank form.
 *
 * Received date defaults to today because that is nearly always right for a batch being entered as
 * it arrives, and the server defaults to the same value when the field is omitted — so the form
 * shows what would happen anyway rather than leaving a required-looking blank.
 *
 * There is deliberately no `status` field: a batch is always born ACTIVE and the server overwrites
 * anything sent, so offering the choice would be a lie.
 */
export function emptyForm(now: Date = new Date()): BatchFormState {
  return {
    inventoryType: 'PRODUCT_INVENTORY',
    itemId: null,
    itemName: '',
    supplierName: '',
    manufactureDate: '',
    expiryDate: '',
    receivedDate: todayIst(now),
    stockInUnit: '',
    stockInMultiplier: 1,
    purchasedQuantity: '',
    remainingQuantity: '',
    costPrice: '',
    sellingPrice: '',
  };
}

/** Numbers → the strings a TextInput holds. Null becomes '' so the field renders as empty. */
function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/**
 * A saved batch as form state.
 *
 * Only used to seed the read view — there is no edit mode — so the quantities are left in BASE
 * units here and rendered through `formatStockedQty`, rather than being divided back into the
 * stock-in unit. Dividing would introduce a rounding error on a batch that has been partially
 * drawn (144 sachets is 12 boxes exactly, but 137 is not).
 */
export function toFormState(batch: BatchDto | null, now: Date = new Date()): BatchFormState {
  if (!batch) return emptyForm(now);
  return {
    inventoryType: (batch.inventoryType ?? 'PRODUCT_INVENTORY') as InventoryType,
    itemId: batch.itemId ?? null,
    itemName: batch.itemName ?? '',
    supplierName: batch.supplierName ?? '',
    manufactureDate: str(batch.manufactureDate).slice(0, 10),
    expiryDate: str(batch.expiryDate).slice(0, 10),
    receivedDate: str(batch.receivedDate).slice(0, 10),
    stockInUnit: batch.stockInUnit ?? '',
    stockInMultiplier: effMult(batch.stockInMultiplier),
    purchasedQuantity: str(batch.purchasedQuantity),
    remainingQuantity: str(batch.remainingQuantity),
    costPrice: str(batch.costPrice),
    sellingPrice: str(batch.sellingPrice),
  };
}

/**
 * The POST body.
 *
 * The conversion is the whole point of this function, and it goes in opposite directions for the
 * two kinds of number:
 *
 *   quantities  × multiplier  — the server stores and deducts in base units
 *   prices      ÷ multiplier  — the server stores a per-base-unit price
 *
 * The chosen level rides along as `stockInUnit` / `stockInMultiplier` so the list can render the
 * quantity back the way it was entered.
 *
 * Omitted deliberately: `status` (always ACTIVE on create, server-forced), `batchNumber`
 * (server-generated), and `id`.
 */
export function buildCreatePayload(
  form: BatchFormState,
  businessId: number,
): Record<string, unknown> {
  const mult = effMult(form.stockInMultiplier);
  // Remaining defaults to purchased — a batch is normally entered whole, and the server applies
  // the same default when the field is absent.
  const remainingInput =
    form.remainingQuantity.trim() === '' ? form.purchasedQuantity : form.remainingQuantity;

  return {
    businessId,
    itemId: form.itemId,
    itemName: form.itemName || null,
    inventoryType: form.inventoryType,
    supplierName: form.supplierName.trim() || null,
    manufactureDate: form.manufactureDate || null,
    expiryDate: form.expiryDate || null,
    receivedDate: form.receivedDate || null,
    purchasedQuantity: toBaseQty(form.purchasedQuantity, mult),
    remainingQuantity: toBaseQty(remainingInput, mult),
    costPrice: toBasePrice(form.costPrice, mult),
    sellingPrice: toBasePrice(form.sellingPrice, mult),
    stockInUnit: form.stockInUnit || null,
    stockInMultiplier: mult,
  };
}

/** "Manual entry" for a hand-added batch; the system source otherwise. */
export function sourceLabel(source: string | null | undefined): string {
  if (!source) return 'Manual entry';
  if (source === 'COMBO_BREAK') return 'Combo break';
  if (source === 'STOCK_TRANSFER') return 'Stock transfer';
  return source;
}

/**
 * The chip on a Select Product row: "Normal", or "Combo · Custom".
 *
 * Not decoration. A combo has no sale-unit ladder of its own (the server's `ensureBaseSaleUnit`
 * skips them) and its stock arrives by COMBO_BREAK rather than by purchase — so a batch stocked
 * against one behaves differently from one stocked against a plain product, and the difference is
 * invisible from the name alone. The chip is the only place in this flow that says so.
 *
 * The combo TYPE is appended when the server records one, because "Combo" alone does not say
 * whether the contents are fixed or assembled per sale.
 */
export function catalogBadge(product: unknown): { label: string; tone: 'muted' } {
  const p = product as { productType?: unknown; comboType?: unknown };
  if (String(p?.productType ?? '').toUpperCase() !== 'COMBO') return { label: 'Normal', tone: 'muted' };
  const combo = String(p?.comboType ?? '').trim();
  if (!combo) return { label: 'Combo', tone: 'muted' };
  return { label: `Combo · ${combo.charAt(0) + combo.slice(1).toLowerCase()}`, tone: 'muted' };
}
