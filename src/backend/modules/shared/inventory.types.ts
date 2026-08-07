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
