/**
 * Shapes shared by the parlour and pharmacy STOCK TRANSFER APIs.
 *
 * Sibling of `inventory.types.ts` / `consumption.types.ts` / `wastage.types.ts`; `compactParams` and
 * `InventoryType` come from the first of those rather than being copied.
 *
 * A stock transfer MOVES stock between the two pools — it destroys nothing and creates nothing. It
 * draws from source batches oldest-expiry-first and mints a destination batch (`source:
 * 'STOCK_TRANSFER'`, which is why such a batch can never be deleted — see `canDeleteBatch`).
 * Immutable like its two siblings: POST, GET, DELETE, no PUT. Deleting one reverses the move.
 */

import type { InventoryType, StockUnitLine } from './inventory.types';

// ─── Reason ──────────────────────────────────────────────────────────────────

/**
 * Server enum. Note the first two name a DIRECTION and the last three do not.
 *
 * That asymmetry is real rather than untidy: `sourceType`/`destType` on the payload are what
 * actually decide which way the stock moves, and the reason is a label on top. `PRODUCT_TO_RAW`
 * with `sourceType: 'RAW_INVENTORY'` is accepted by the server and is a lie in the audit log, so a
 * form that offers both must derive the reason from the direction rather than let them be picked
 * independently.
 *
 * ⚠️ A value outside this union is an HTTP **500**, not a 400 — Spring cannot bind the body's enum,
 * so the handler never runs. The service guards with `isStockTransferReason` before the axios call.
 */
export type StockTransferReason =
  | 'PRODUCT_TO_RAW'
  | 'RAW_TO_PRODUCT'
  | 'REBALANCE'
  | 'CORRECTION'
  | 'OTHER';

/**
 * Every reason, in the order they would be drawn.
 *
 * One array, not two: unlike wastage there is no member the UI must hide. `CORRECTION` is offered
 * here — a transfer corrects which POOL stock sits in and destroys nothing, so it cannot absorb a
 * loss the way a `CORRECTION` write-off would.
 */
export const STOCK_TRANSFER_REASONS: readonly StockTransferReason[] = [
  'PRODUCT_TO_RAW',
  'RAW_TO_PRODUCT',
  'REBALANCE',
  'CORRECTION',
  'OTHER',
];

/** Narrows an unknown to a `StockTransferReason`. Takes `unknown` — see `isConsumptionReason`. */
export function isStockTransferReason(value: unknown): value is StockTransferReason {
  return typeof value === 'string' && (STOCK_TRANSFER_REASONS as readonly string[]).includes(value);
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

/**
 * The server's whitelist, spelled exactly as the server spells it. An unrecognised key silently
 * falls back to the default rather than erroring, so a typo produces a list that looks sorted.
 *
 * `sourceType` and `destType` are the two keys with no counterpart on consumption or wastage — a
 * transfer is the only one of the three that has two ends.
 */
export const STOCK_TRANSFER_SORT_KEYS = [
  'id',
  'transferredAt',
  'itemName',
  'sourceType',
  'destType',
  'quantity',
  'reason',
] as const;

export type StockTransferSortKey = (typeof STOCK_TRANSFER_SORT_KEYS)[number];

/** What the server sorts by when `sortBy` is absent. Newest first, paired with `sortDir: 'desc'`. */
export const DEFAULT_STOCK_TRANSFER_SORT: StockTransferSortKey = 'transferredAt';

// ─── Query ───────────────────────────────────────────────────────────────────

/**
 * Everything `GET /byBusiness` accepts beyond `businessId`, `page` and `limit`.
 *
 * ⚠️ There is deliberately NO `reason` key, and its absence is the whole point of this comment.
 *
 * `reason` is SORTABLE (see the whitelist above) but not FILTERABLE — the transfer controller reads
 * no such query param, so sending one is silently ignored and the list comes back unfiltered. Both
 * siblings DO accept it, which is exactly why someone building the filter sheet here by copying the
 * wastage one would add reason chips that appear to work and quietly do nothing.
 *
 * Leaving the key off makes that a compile error instead of a bug report. If the backend ever grows
 * the param, add it here first.
 */
export interface StockTransferQuery {
  search?: string | null;
  sortBy?: StockTransferSortKey | null;
  sortDir?: 'asc' | 'desc' | null;
}

// ─── Create payload ──────────────────────────────────────────────────────────

/**
 * The POST body.
 *
 * `sourceType` and `destType` must DIFFER — a transfer is always cross-pool, and same-to-same is
 * rejected. They, not `reason`, are what decide the direction of the move.
 *
 * `quantity` means one of two things depending on `unitLines` — level units on a single-level
 * record, BASE units on a mixed one. See `ConsumptionPayload` for the full note.
 *
 * ⚠️ `unitLines` is accepted on the wire and then DISCARDED: the server rebuilds the destination
 * batch from the scalar total, so a breakdown sent here never comes back and the detail screen has
 * nothing to render. That is why the transfer form passes `allowMultiple={false}` to
 * `UnitRowsEditor` — the UI must not promise a breakdown the round trip will lose. The field stays
 * on the type because the endpoint does accept it; it is the UI, not the wire, that says no.
 */
export interface StockTransferPayload {
  businessId: number;
  itemId: number;
  /** Denormalised so the row survives the product being deleted. Server fills it when omitted. */
  itemName?: string | null;
  /** The pool stock leaves. Must differ from `destType`. */
  sourceType: InventoryType;
  /** The pool stock arrives in. Must differ from `sourceType`. */
  destType: InventoryType;
  reason: StockTransferReason;
  quantity: number;
  /** The level's unit name, or null on a mixed record. Null is NOT the same as `''`. */
  unitName?: string | null;
  unitMultiplier?: number | null;
  /** ⚠️ Accepted and discarded server-side — see the note above. */
  unitLines?: StockUnitLine[] | null;
  /** IST wall clock, zone-less (`2026-08-08T14:30:00`). Server defaults to now when omitted. */
  transferredAt?: string | null;
  notes?: string | null;
}

// ─── Response ────────────────────────────────────────────────────────────────

/**
 * ONE hop of the move: out of a source batch, into a destination batch.
 *
 * ⚠️ THIS IS NOT A `deductions` ROW. Consumption and wastage carry
 * `deductions: {batchId, qty}[]`; a transfer carries `lines: {sourceBatchId, destBatchId,
 * quantity}[]` — a different array name AND a different amount key, with `batchId` and `qty`
 * appearing in neither.
 *
 * In Centrix both files name the local `lines` and both call `lines.map((ln, i) => …)`, so the two
 * ledger blocks look copy-pasteable. They are not: paste the transfer block onto a consumption and
 * `record.lines` is undefined, so the table renders EMPTY with no error at all; paste it the other
 * way and every amount cell reads `undefined`. Declaring both shapes precisely is what turns that
 * into a compile error rather than a silent blank.
 */
export interface StockTransferLine {
  sourceBatchId: number;
  /** The batch the server minted (or topped up) on the destination side. */
  destBatchId: number;
  /** NOT `qty`. Base units moved on this hop. */
  quantity: number;
}

/**
 * A stock transfer as the server returns it. Loose beyond the keys a screen reads.
 *
 * `lines` is the FEFO ledger, absent on a list row and present on the detail read.
 */
export interface StockTransferDto {
  id?: number | null;
  businessId?: number | null;
  itemId?: number | null;
  itemName?: string | null;
  sourceType?: InventoryType | null;
  destType?: InventoryType | null;
  reason?: StockTransferReason | null;
  /** Base units when `unitLines` is set, level units otherwise — see `StockTransferPayload`. */
  quantity?: number | null;
  unitName?: string | null;
  unitMultiplier?: number | null;
  /** Almost always null on the way back: the server discards what it was sent. */
  unitLines?: StockUnitLine[] | null;
  transferredAt?: string | null;
  notes?: string | null;
  /** ⚠️ `lines`, not `deductions`. See `StockTransferLine`. */
  lines?: StockTransferLine[] | null;
  createdAt?: string | null;
  [k: string]: unknown;
}
