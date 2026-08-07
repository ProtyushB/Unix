import type {
  InventoryStatus,
  InventoryType,
} from '../../../backend/modules/shared/inventory.types';
import {
  expiryCountdownLabel,
  expiryState,
  remainingRatio,
  remainingState,
  type ExpiryState,
  type RemainingState,
} from './batchHealth';
import { displayLevel, formatStockedQty } from './batchUnits';

/**
 * A batch DTO reduced to what one list row draws.
 *
 * RN-free so the mapping is testable — the row is where three independent signals (status, stock
 * left, expiry) have to coexist without contradicting one another, and that is worth pinning.
 */

/** The batch as the server sends it. Loose beyond the keys the row reads. */
export interface BatchDto {
  id?: number | null;
  itemId?: number | null;
  itemName?: string | null;
  batchNumber?: string | null;
  supplierName?: string | null;
  inventoryType?: InventoryType | null;
  status?: InventoryStatus | null;
  purchasedQuantity?: number | null;
  remainingQuantity?: number | null;
  costPrice?: number | null;
  sellingPrice?: number | null;
  manufactureDate?: string | null;
  expiryDate?: string | null;
  receivedDate?: string | null;
  stockInUnit?: string | null;
  stockInMultiplier?: number | null;
  /** Write-once server stamp. Non-null means stock has been drawn — see `canDeleteBatch`. */
  firstUsedAt?: string | null;
  /** "COMBO_BREAK" / "STOCK_TRANSFER", or null for a manual entry. */
  source?: string | null;
  productSnapshot?: { name?: string; brand?: string } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [k: string]: unknown;
}

export interface BatchRow {
  id: number | null;
  name: string;
  batchNumber: string;
  supplier: string;
  status: InventoryStatus;
  /**
   * The remaining figure ALONE — "12".
   *
   * Split from the rest deliberately. The mockup renders it larger and tinted by the health state,
   * because it is one of the three independent cues a row carries (status pill, remaining, expiry).
   * Merged into one string it can only be one size and one colour, and that cue is lost.
   */
  remainingText: string;
  /** The rest — "/ 50 boxes". Muted and smaller, so the figure above it reads as the signal. */
  ofText: string;
  /** "≈ 600 sachets" when the batch was stocked in a multi-unit level, else null. */
  baseEquivalence: string | null;
  remaining: RemainingState;
  /** 0–1 for the progress track. */
  fill: number;
  expiry: ExpiryState;
  /** "Expires 20 Nov 2026" / "Expired 15 Jul 2026". Empty when the batch has no expiry. */
  expiryLabel: string;
  /** "55d left", only inside the 30-day window. */
  expiryCountdown: string | null;
}

/**
 * The product's name, preferring the SNAPSHOT over the live join.
 *
 * A batch outlives the product it was bought for. `itemName` is denormalised onto the row and the
 * snapshot is a second copy — either survives a deleted product, which is exactly when a name
 * matters most. Falls back to the id so a row is never nameless.
 */
export function batchName(batch: BatchDto): string {
  return (
    batch?.productSnapshot?.name?.trim() ||
    batch?.itemName?.trim() ||
    (batch?.itemId != null ? `Product #${batch.itemId}` : 'Unknown product')
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-20" → "20 Nov 2026". Parsed by parts — `new Date(ymd)` would shift a day west. */
export function formatBatchDate(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * "22 Jul 2026, 10:15 AM" — a real instant, for System Information.
 *
 * The meridiem is built here rather than left to `toLocaleTimeString('en-IN')`, which renders it
 * lowercase ("10:15 am") on Chrome and uppercase on other engines. The mockup is uppercase, and a
 * label that changes case with the JS engine is not something a test can pin.
 */
export function formatStamp(instant: string | null | undefined): string {
  if (!instant) return '';
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return '';
  const h24 = d.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const meridiem = h24 < 12 ? 'AM' : 'PM';
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  return `${formatBatchDate(ymd)}, ${h12}:${String(d.getMinutes()).padStart(2, '0')} ${meridiem}`;
}

/** "Expires 20 Nov 2026", or "Expired 15 Jul 2026" once past. */
export function expiryLabel(expiryDate: string | null | undefined, today?: string): string {
  const formatted = formatBatchDate(expiryDate);
  if (!formatted) return '';
  return `${expiryState(expiryDate, today) === 'expired' ? 'Expired' : 'Expires'} ${formatted}`;
}

/**
 * The row's quantity, as the two parts it is drawn in: `{ remaining: "12", of: "/ 50 boxes" }`.
 *
 * Both figures are converted through the SAME level, so the pair is comparable. Rendering the
 * remainder in boxes and the purchase in sachets would read as a catastrophic loss of stock.
 *
 * The unit is stated once, on the purchased side — "12 / 50 boxes", not "12 boxes / 50 boxes".
 */
export function quantityParts(
  batch: BatchDto,
  baseUnit = 'unit',
): { remaining: string; of: string } {
  const level = displayLevel(batch);
  const purchased = formatStockedQty(batch?.purchasedQuantity, level, baseUnit);
  const remaining = formatStockedQty(batch?.remainingQuantity, level, baseUnit);
  return { remaining: remaining.split(' ')[0], of: `/ ${purchased}` };
}

/** "≈ 600 sachets" — only when the stock-in unit differs from the base one. */
export function baseEquivalence(batch: BatchDto, baseUnit = 'unit'): string | null {
  const level = displayLevel(batch);
  if (!level || level.perStock <= 1) return null;
  const remaining = Number(batch?.remainingQuantity ?? 0);
  if (!Number.isFinite(remaining)) return null;
  return `≈ ${remaining} ${remaining === 1 ? baseUnit : `${baseUnit}s`}`;
}

export function toBatchRow(batch: BatchDto, baseUnit = 'unit', today?: string): BatchRow {
  const qty = quantityParts(batch, baseUnit);
  return {
    id: batch?.id ?? null,
    name: batchName(batch),
    batchNumber: batch?.batchNumber ?? '',
    supplier: batch?.supplierName ?? '',
    // A row without a status would render an unstyled pill; ACTIVE is the server's own default.
    status: (batch?.status ?? 'ACTIVE') as InventoryStatus,
    remainingText: qty.remaining,
    ofText: qty.of,
    baseEquivalence: baseEquivalence(batch, baseUnit),
    remaining: remainingState(batch?.purchasedQuantity, batch?.remainingQuantity),
    fill: remainingRatio(batch?.purchasedQuantity, batch?.remainingQuantity),
    expiry: expiryState(batch?.expiryDate, today),
    expiryLabel: expiryLabel(batch?.expiryDate, today),
    expiryCountdown: expiryCountdownLabel(batch?.expiryDate, today),
  };
}

/** "128 batches · sorted by expiry" — the subtitle. Null total reads as unknown, not zero. */
export function listSubtitle(total: number | null, filtered: boolean): string {
  const tail = filtered ? 'filtered' : 'sorted by expiry';
  if (total === null) return tail;
  return `${total} ${total === 1 ? 'batch' : 'batches'} · ${tail}`;
}
