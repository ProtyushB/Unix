import type { InventoryType } from '../../../backend/modules/shared/inventory.types';
import type { BatchDto } from '../inventory/batch.model';
import { formatStockedQty } from '../inventory/batchUnits';
import { poolLabel } from './stockTransfer.view';

/**
 * How much of each product sits in ONE pool, derived from that pool's batches.
 *
 * Exists because the transfer form has to answer the same question in three places — the picker's
 * per-row stock figure, the "Available: …" helper, and the over-draw check — and the obvious way to
 * answer it (`getTotalStock(itemId, businessId, pool)`) is one request PER PRODUCT. A catalog of
 * 500 would be 500 requests to populate one picker.
 *
 * One `GET /byBusiness?inventoryType=…&status=ACTIVE` returns every batch in the pool, and summing
 * it by `itemId` answers all three at once. It also re-derives instantly when the DIRECTION flips,
 * which it must: flipping swaps which pool is the source, and with it the ceiling on the quantity.
 *
 * RN-free so jest can cover it — the arithmetic here decides whether a row is pickable.
 */

export interface PoolStock {
  itemId: number;
  /** Base units on hand across every counted batch. */
  baseQty: number;
  /** How many batches actually hold stock. An empty batch is not a place stock can be drawn from. */
  batchCount: number;
  /**
   * The batch a transfer of this product would START from, and the field the POST is addressed by.
   *
   * The LOWEST-ID ACTIVE batch that still has stock — the same rule `pickWriteOffBatch` uses for a
   * wastage, and for the same reason: it is what the server itself starts from, so a client that
   * named a different one would show the user one batch and have the stock come out of another.
   * When the quantity is larger than that batch holds the server OVERFLOWS into the ones after it
   * and reports what it actually took in `lines`; the client never splits the quantity, and there is
   * no batch picker anywhere in this feature.
   *
   * Lowest id rather than nearest expiry despite the helper line saying "drawn FEFO": the two agree
   * in the ordinary case (batches are created in receipt order) and the server, not this, decides
   * the real draw order. What the client owns is only the STARTING point.
   *
   * Null when the pool holds nothing for this product — which `validateStockTransfer` turns into a
   * message, because a payload without it is a 400 naming a field the form never showed anyone.
   */
  sourceBatchId: number | null;
}

/** Nothing at all, for a product the pool has never held. Distinct from "not looked up yet". */
export const NO_POOL_STOCK: PoolStock = {
  itemId: 0,
  baseQty: 0,
  batchCount: 0,
  sourceBatchId: null,
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Whether a batch is stock the server will actually draw from.
 *
 * ACTIVE only. An ON_HOLD, QUARANTINED, EXPIRED or DEPLETED batch is not drawable, so counting one
 * would inflate the ceiling and naming one as `sourceBatchId` would produce a refusal the user
 * cannot act on.
 *
 * A MISSING status defaults to ACTIVE, matching `toBatchRow` and the server's own column default —
 * the alternative is that a response which omits the field empties the whole picker. The query
 * already asks for `status: 'ACTIVE'`; this is the second line, for a server that ignores it.
 */
function isDrawable(batch: BatchDto): boolean {
  return (batch?.status ?? 'ACTIVE') === 'ACTIVE' && num(batch?.remainingQuantity) > 0;
}

/**
 * Batches → per-product totals for the pool they came from.
 *
 * Batches with no remaining quantity are counted into neither figure. That is not an optimisation:
 * a product whose only batch is empty must read "0" and be unpickable, and counting the batch would
 * make it read "0 ml across 1 batch", which invites a tap that can only ever be refused.
 *
 * Rows with no `itemId` are dropped rather than bucketed under 0 — a batch that cannot be attributed
 * to a product cannot be offered as that product's stock.
 *
 * ⚠️ The caller is responsible for having fetched ONE pool. Nothing in a `BatchDto` is checked
 * against a pool here, because a mixed list has no correct answer: totalling both pools would offer
 * the user stock the transfer cannot reach — and `sourceBatchId` would name a batch in the wrong
 * pool, which the server would refuse.
 *
 * ⚠️ Response order is NOT relied on for `sourceBatchId`. The list is sorted by expiry server-side
 * by default, so "the first one we saw" is not the lowest id; the minimum is taken explicitly.
 */
export function aggregatePoolStock(batches: BatchDto[] | null | undefined): Map<number, PoolStock> {
  const out = new Map<number, PoolStock>();
  for (const batch of batches ?? []) {
    const itemId = batch?.itemId;
    if (itemId == null) continue;
    if (!isDrawable(batch)) continue;
    const remaining = num(batch?.remainingQuantity);
    const key = Number(itemId);
    // A batch with no id cannot be named in a payload, so it contributes to the totals but can
    // never become the starting point.
    const batchId = batch?.id == null ? null : Number(batch.id);
    const prev = out.get(key);
    if (prev) {
      prev.baseQty += remaining;
      prev.batchCount += 1;
      if (batchId != null && (prev.sourceBatchId == null || batchId < prev.sourceBatchId)) {
        prev.sourceBatchId = batchId;
      }
    } else {
      out.set(key, { itemId: key, baseQty: remaining, batchCount: 1, sourceBatchId: batchId });
    }
  }
  return out;
}

/**
 * One product's pool stock, or null when the pool has not been fetched.
 *
 * ⚠️ Null and zero are different answers and both are rendered differently: null is "we do not know
 * yet", zero is "we asked, and there is none". Collapsing them greys out every row for the moment
 * between opening the picker and the response landing.
 */
export function poolStockFor(
  pool: Map<number, PoolStock> | null | undefined,
  itemId: number | null | undefined,
): PoolStock | null {
  if (!pool || itemId == null) return null;
  return pool.get(Number(itemId)) ?? { ...NO_POOL_STOCK, itemId: Number(itemId) };
}

/**
 * Thousand separators — "6000" → "6,000".
 *
 * Written out rather than `toLocaleString`, which is engine- and locale-dependent: the same number
 * renders "6,000" on one JS engine and "6 000" on another, and an en-IN locale would group a larger
 * figure as "6,00,000". A label a test cannot pin is a label that drifts.
 */
export function groupDigits(n: number): string {
  const sign = n < 0 ? '-' : '';
  const [whole, fraction] = Math.abs(n).toString().split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/**
 * "6,000 ml" — a pool total in base units.
 *
 * Leans on `formatStockedQty` for the unit name so "45 g" and "200 ml" stay un-pluralised exactly as
 * they are everywhere else, then swaps the leading integer for its grouped form. Two functions
 * rather than one because pluralisation lives in `batchUnits.ts` and is not this file's to restate.
 */
export function formatPoolQty(baseQty: number, baseUnit = 'unit'): string {
  const plain = formatStockedQty(baseQty, null, baseUnit);
  return plain.replace(/^-?\d+/, groupDigits(baseQty));
}

/**
 * The helper under the Item picker: what there is to move, and how it will be drawn.
 *
 * "Drawn FEFO" is the part worth stating. There is no batch picker on this form and there is not
 * going to be one — the server chooses source batches soonest-expiry-first — so the sentence is the
 * only place the user is told which stock actually leaves.
 *
 * Null while nothing is known, so an untouched form shows no helper at all rather than "Available:
 * 0 ml", which reads as a refusal before the user has picked anything.
 */
export function availabilityHelper(
  stock: PoolStock | null,
  baseUnit = 'unit',
  sourceType: InventoryType = 'PRODUCT_INVENTORY',
): string | null {
  if (!stock) return null;
  if (!(stock.baseQty > 0)) return `No stock in the ${poolLabel(sourceType)} pool.`;
  const batches = `${stock.batchCount} ${stock.batchCount === 1 ? 'batch' : 'batches'}`;
  return `Available: ${formatPoolQty(stock.baseQty, baseUnit)} across ${batches} · drawn FEFO (soonest expiry first).`;
}

/**
 * The trailing stock slot on a picker row: the total, and the batch count under it.
 *
 * The breakdown line is the BATCH COUNT rather than a stock-in level, unlike the inventory list's
 * "3 tubs · 30 g". Deliberate: a pool's stock can span batches bought at different levels, so there
 * is no single level to express the total in, and picking one batch's level would misreport the
 * rest. How many batches it is spread across is true regardless and is what the FEFO helper below
 * refers back to.
 *
 * Null when the pool has not been fetched — a row with no answer draws no figure, rather than a
 * zero it would then have to be greyed out for.
 */
export function pickerStock(
  stock: PoolStock | null,
  baseUnit = 'unit',
): { total: string; breakdown: string | null } | null {
  if (!stock) return null;
  if (!(stock.baseQty > 0)) return { total: formatPoolQty(0, baseUnit), breakdown: null };
  return {
    total: formatPoolQty(stock.baseQty, baseUnit),
    breakdown: `${stock.batchCount} ${stock.batchCount === 1 ? 'batch' : 'batches'}`,
  };
}

/**
 * Whether the picker row is inert.
 *
 * Only at a KNOWN zero. An unknown pool leaves every row tappable: greying out the whole catalog
 * for the moment between opening the picker and the batches landing would look like a broken screen,
 * and the over-draw check catches the mistake a moment later anyway.
 */
export function rowIsOutOfStock(stock: PoolStock | null): boolean {
  return stock !== null && !(stock.baseQty > 0);
}

/** "no Raw stock" — the note that REPLACES the breakdown on an inert row. Null when there is one. */
export function outOfStockNote(
  stock: PoolStock | null,
  sourceType: InventoryType = 'PRODUCT_INVENTORY',
): string | null {
  if (!rowIsOutOfStock(stock)) return null;
  return `no ${poolLabel(sourceType)} stock`;
}
