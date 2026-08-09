/**
 * Shapes shared by the parlour and pharmacy inventory APIs.
 *
 * Defined once rather than per module because the two controllers are byte-identical apart from
 * their base path — `ParlourInventoryDto` and `PharmacyInventoryDto` are empty subclasses of one
 * `InventoryDto`. (`ApiResponse` is duplicated per module for historical reasons; that is not a
 * pattern worth extending to new types.)
 */

/** Server enum. NOT `PRODUCT` / `RAW` — the full constant names are pinned by a DB CHECK. */
export type InventoryType = 'PRODUCT_INVENTORY' | 'RAW_INVENTORY';

/**
 * The two pools as a segmented control renders them, Product first.
 *
 * Only the two REAL values, with no null/"either" member: every form that shows this control is
 * choosing a pool to act on, and "unspecified" is not a pool stock can come out of.
 *
 * Deliberately not a `poolLabel()` — the features disagree about what a MISSING pool should read
 * as (`stockTransfer.view` defaults it to "Product", `wastage.view` returns an empty string because
 * it renders as a card badge where a guess is worse than a blank), and that disagreement is about
 * null, which this array does not contain.
 */
export const POOL_OPTIONS: readonly { value: InventoryType; label: string }[] = [
  { value: 'PRODUCT_INVENTORY', label: 'Product' },
  { value: 'RAW_INVENTORY', label: 'Raw' },
];

/** Server enum. Note the underscore in `ON_HOLD`. */
export type InventoryStatus = 'ACTIVE' | 'EXPIRED' | 'DEPLETED' | 'ON_HOLD' | 'QUARANTINED';

export const INVENTORY_STATUSES: readonly InventoryStatus[] = [
  'ACTIVE',
  'ON_HOLD',
  'QUARANTINED',
  'EXPIRED',
  'DEPLETED',
];

/**
 * Everything `GET /byBusiness` accepts beyond paging.
 *
 * `status` is the only field the counts endpoint ignores — it groups by that instead, which is what
 * lets a chip's number and its list agree.
 */
export interface InventoryQuery {
  inventoryType?: InventoryType | null;
  status?: InventoryStatus | null;
  search?: string | null;
  /** Batches expiring in the next N days. EXCLUDES ones already expired. */
  expiringWithinDays?: number | null;
  /** Batches already past expiry — `expiryDate <= today`, inclusive of the printed date. */
  expiredOnly?: boolean | null;
  /** Whitelisted server-side; anything else silently falls back to `expiryDate`. */
  sortBy?: string | null;
  sortDir?: 'asc' | 'desc' | null;
}

/**
 * One rung of a MIXED-unit stock movement — "2 strips" alongside "8 tablets" on one record.
 *
 * Lives here rather than in any one of consumption/wastage/stockTransfer because all three send the
 * identical array under the identical key, and three structurally-identical copies would drift the
 * first time one of them grew a field. It is deliberately NOT `SaleUnit` (`batchUnits.ts`): that one
 * carries a `price` and describes a product's catalog ladder, whereas this describes a quantity
 * ENTERED against that ladder — same two names, a third number, a different meaning.
 *
 * ⚠️ Stock transfer accepts this on the wire and then DISCARDS it: the server rebuilds the
 * destination batch from the scalar total. See `stockTransfer.types.ts`.
 */
export interface StockUnitLine {
  unit: string;
  /** BASE units per one `unit`. The base rung is 1. */
  perStock: number;
  /** How many of `unit`, in LEVEL units — not multiplied out. */
  qty: number;
}

/** Options for a status change. Both are optional; omitted keys let server defaults apply. */
export interface StatusChangeOptions {
  userId?: number | null;
  reason?: string | null;
}

/** Counts keyed by status, every status present (zeros included). */
export type InventoryStatusCounts = Record<InventoryStatus, number>;

/**
 * Drop null/undefined/blank entries so an absent filter is genuinely absent from the query string.
 *
 * Load-bearing: axios serialises `{status: null}` as `status=` (empty string), which Spring binds
 * to a blank enum value and rejects with a 400 rather than treating it as "no filter".
 */
export function compactParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = v;
  }
  return out;
}
