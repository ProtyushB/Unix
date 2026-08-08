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
 * ⚠️ This is BATCH-addressed on the SOURCE side, the same shape `WastagePayload` uses. A transfer
 * names the batch stock leaves, not the product: `sourceBatchId` is `@NotNull @Positive`, the
 * controller forwards it positionally as the first argument to `transfer(...)`, and the server
 * derives `itemId` AND `sourceType` from the batch it names. Only `destType` travels as its own key.
 *
 * (An earlier draft of this interface required `itemId` and `sourceType` and had no `sourceBatchId`
 * at all. That was wrong about the controller in the one way that cannot be worked around: with no
 * `sourceBatchId` the body fails BEAN VALIDATION, so every create was a 400 before the handler ran.
 * The direction is still asked for on the form — the SOURCE pool is what decides which batch this
 * is — it just does not travel as its own key.)
 *
 * Which batch: the lowest-id ACTIVE batch with remaining stock for the chosen product in the SOURCE
 * pool. The server overflows into later batches by itself and reports what it actually took in
 * `lines`, so the client never splits the quantity and there is no batch picker anywhere here.
 *
 * `quantity` is in LEVEL units and `unitMultiplier` is that level's `perStock`; the server deducts
 * `quantity × unitMultiplier` base units. There is no mixed-unit branch on this endpoint — see
 * `unitLines` below.
 */
export interface StockTransferPayload {
  /**
   * `@NotNull @Positive`.
   *
   * Only the tab-gate aspect ever reads it — the transfer itself is scoped by the batch — but it is
   * validated all the same, so a null or a zero is a 400 before anything else is looked at.
   */
  businessId: number;
  /**
   * `@NotNull @Positive`. THE addressing field.
   *
   * ⚠️ There is deliberately no `itemId`, no `itemName` and no `sourceType` on this interface, and
   * their absence is a decision rather than an oversight. The controller derives the product and the
   * source pool FROM this batch; a client that sends them is stating facts the server never reads,
   * which looks authoritative and is not. Do not add them back.
   *
   * The direction is still asked for on the form: the source pool is what decides WHICH batch this
   * is, and flipping it has to re-resolve the id — the other pool holds different batches.
   */
  sourceBatchId: number;
  /** `@NotNull`. The pool stock arrives in. The server refuses it when it equals the source's. */
  destType: InventoryType;
  /** `@NotNull @Positive`. Zero moves nothing; a negative one would move stock the other way. */
  quantity: number;
  /** The level's unit name. Null is NOT the same as `''` — the server reads `''` as a real unit. */
  unitName?: string | null;
  unitMultiplier?: number | null;
  /** `@NotNull`. Guarded locally by `isStockTransferReason` — a bad enum is a 500, not a 400. */
  reason: StockTransferReason;
  notes?: string | null;
  /**
   * The user who moved it. Declared because the DTO carries it; never sent, because this app has no
   * user id to put in it — `session.storage` holds a profile and a business, not an account id.
   * `WastagePayload.reportedBy` is unsent for exactly the same reason.
   */
  transferredBy?: number | null;
}

/*
 * ⚠️ FIVE fields that used to be on the interface above and are NOT coming back:
 *
 *   `itemId`, `itemName`, `sourceType` — derived server-side from `sourceBatchId`. See the note on
 *       that field. Sending them changes nothing and reads as though it does.
 *
 *   `transferredAt` — the controller ignores it and stamps the row itself. The Transfer Stock form
 *       collects no date, so there was never a value to send; declaring the key invited someone to
 *       add the field and then wonder why the timestamp never matched.
 *
 *   `unitLines` — ignored, not merely discarded. The server rebuilds the destination batch from the
 *       scalar total, so a breakdown never survives the round trip and the detail screen would have
 *       nothing to render. This is why the transfer form passes `allowMultiple={false}` to
 *       `UnitRowsEditor` — the editor is clamped to one row, so the mixed branch of
 *       `deriveUnitLinesPayload` is unreachable here by construction rather than by discipline.
 *       `StockTransferDto.unitLines` still exists for reading a response through; the PAYLOAD has
 *       no such key, so sending one is now a compile error rather than a silent no-op.
 */

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
