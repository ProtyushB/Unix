/**
 * Shapes shared by the parlour and pharmacy WASTAGE APIs.
 *
 * Sibling of `inventory.types.ts` / `consumption.types.ts`; `compactParams` and `InventoryType` come
 * from the first of those rather than being copied.
 *
 * A wastage writes stock OFF. Unlike consumption it can come out of either pool, which is why
 * `inventoryType` is on the payload here and absent there. Immutable in the same way: POST, GET,
 * DELETE, no PUT. Deleting one restocks what it wrote off.
 */

import type { InventoryType, StockUnitLine } from './inventory.types';

// ─── Reason ──────────────────────────────────────────────────────────────────

/**
 * Server enum — the FULL set, including the one the UI never offers.
 *
 * ⚠️ A value outside this union is an HTTP **500**, not a 400 (Spring cannot bind the body's enum,
 * so the handler never runs and there is no validation error to show). The service guards with
 * `isWastageReason` before the axios call.
 */
export type WastageReason =
  | 'EXPIRED'
  | 'DAMAGED'
  | 'SPILLED'
  | 'CONTAMINATED'
  | 'THEFT'
  | 'LOST'
  | 'CORRECTION'
  | 'OTHER';

/**
 * Every value the server accepts — all EIGHT.
 *
 * Use this to VALIDATE and to LABEL. A record that already carries `CORRECTION` must still render
 * its reason, so a screen that read only the chip list below would draw a blank where the reason
 * goes.
 */
export const WASTAGE_REASONS: readonly WastageReason[] = [
  'EXPIRED',
  'DAMAGED',
  'SPILLED',
  'CONTAMINATED',
  'THEFT',
  'LOST',
  'CORRECTION',
  'OTHER',
];

/**
 * The SEVEN reasons the UI offers — `CORRECTION` is deliberately not among them.
 *
 * Two arrays rather than one because the two questions are genuinely different:
 *
 *   • "is this a legal value?"  → `WASTAGE_REASONS` (all eight; the server accepts all eight)
 *   • "may a person pick it?"   → this one
 *
 * `CORRECTION` is how a stock-count adjustment is written to the ledger, and offering it on the
 * Record Wastage form would invite exactly the wrong thing: someone reconciling a miscount would
 * file it as wastage, and the write-off value would absorb an error that was never a loss. It stays
 * a value the system can write and a value a record can carry, without being a button.
 *
 * Chips render from THIS array. Labels resolve from the union.
 */
export const WASTAGE_REASON_CHOICES: readonly WastageReason[] = [
  'EXPIRED',
  'DAMAGED',
  'SPILLED',
  'CONTAMINATED',
  'THEFT',
  'LOST',
  'OTHER',
];

/**
 * Narrows an unknown to a `WastageReason`.
 *
 * Accepts all EIGHT, `CORRECTION` included: this guards what the wire may carry, not what the form
 * may offer. A guard that rejected `CORRECTION` would make an existing record unreadable.
 */
export function isWastageReason(value: unknown): value is WastageReason {
  return typeof value === 'string' && (WASTAGE_REASONS as readonly string[]).includes(value);
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

/**
 * The server's whitelist, spelled exactly as the server spells it. An unrecognised key silently
 * falls back to the default rather than erroring, so a typo produces a list that looks sorted.
 *
 * Note `inventoryType` is sortable here and has no counterpart on consumption — wastage is the only
 * one of the three that spans both pools, so grouping by pool is a sort a user can actually want.
 */
export const WASTAGE_SORT_KEYS = [
  'id',
  'reportedAt',
  'itemName',
  'quantity',
  'reason',
  'inventoryType',
] as const;

export type WastageSortKey = (typeof WASTAGE_SORT_KEYS)[number];

/** What the server sorts by when `sortBy` is absent. Newest first, paired with `sortDir: 'desc'`. */
export const DEFAULT_WASTAGE_SORT: WastageSortKey = 'reportedAt';

// ─── Query ───────────────────────────────────────────────────────────────────

/**
 * Everything `GET /byBusiness` accepts beyond `businessId`, `page` and `limit`.
 *
 * No `inventoryType`: it is SORTABLE but not FILTERABLE — the backend reads no such query param, so
 * a pool filter has to be built out of the sort or not at all. `sortBy: 'inventoryType'` is the
 * whole of what the server offers on that axis.
 */
export interface WastageQuery {
  reason?: WastageReason | null;
  search?: string | null;
  sortBy?: WastageSortKey | null;
  sortDir?: 'asc' | 'desc' | null;
}

// ─── Create payload ──────────────────────────────────────────────────────────

/**
 * The POST body.
 *
 * `quantity` means one of two things depending on `unitLines` — level units on a single-level
 * record, BASE units on a mixed one — and `deriveUnitLinesPayload` in `batchUnits.ts` is the one
 * place that decides. See `ConsumptionPayload` for the full note; the contract is identical.
 *
 * `inventoryType` is REQUIRED and has no default worth guessing: the same product can hold stock in
 * both pools, and writing off the sellable one when the user meant the consumable one is a silent
 * loss of real stock.
 */
export interface WastagePayload {
  businessId: number;
  itemId: number;
  /** Denormalised so the row survives the product being deleted. Server fills it when omitted. */
  itemName?: string | null;
  /** Which pool to write off from. No default — see above. */
  inventoryType: InventoryType;
  reason: WastageReason;
  quantity: number;
  /** The level's unit name, or null on a mixed record. Null is NOT the same as `''`. */
  unitName?: string | null;
  unitMultiplier?: number | null;
  /** Null (not `[]`) on a single-level record — see `deriveUnitLinesPayload`. */
  unitLines?: StockUnitLine[] | null;
  /** IST wall clock, zone-less (`2026-08-08T14:30:00`). Server defaults to now when omitted. */
  reportedAt?: string | null;
  notes?: string | null;
}

// ─── Response ────────────────────────────────────────────────────────────────

/**
 * ONE batch the write-off came out of, and how much it took.
 *
 * ⚠️ Same trap as consumption, and the same shape: `deductions: {batchId, qty}[]`. A stock transfer
 * uses `lines: {sourceBatchId, destBatchId, quantity}[]` — different array name, different amount
 * key. Centrix names both locals `lines` and maps both the same way, so the blocks read as
 * interchangeable and a copy renders an empty table with no error to notice. Declared precisely
 * here so a copy is a compile error instead.
 */
export interface WastageDeduction {
  batchId: number;
  /** NOT `quantity`. Base units taken out of that one batch. */
  qty: number;
}

/** A wastage as the server returns it. Loose beyond the keys a screen reads, matching `BatchDto`. */
export interface WastageDto {
  id?: number | null;
  businessId?: number | null;
  itemId?: number | null;
  itemName?: string | null;
  /** Which pool this was written off from. Both are possible — never assume. */
  inventoryType?: InventoryType | null;
  reason?: WastageReason | null;
  /** Base units when `unitLines` is set, level units otherwise — see `WastagePayload`. */
  quantity?: number | null;
  unitName?: string | null;
  unitMultiplier?: number | null;
  unitLines?: StockUnitLine[] | null;
  reportedAt?: string | null;
  notes?: string | null;
  /** ⚠️ `deductions`, not `lines`. See `WastageDeduction`. */
  deductions?: WastageDeduction[] | null;
  createdAt?: string | null;
  [k: string]: unknown;
}
