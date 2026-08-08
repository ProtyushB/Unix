/**
 * Shapes shared by the parlour and pharmacy CONSUMPTION APIs.
 *
 * Sibling of `inventory.types.ts`, and for the same reason: the two controllers are byte-identical
 * apart from their base path, so the vocabulary is defined once rather than per module.
 * `compactParams` and `InventoryType` are imported from that file rather than copied — a second
 * `compactParams` would be a second chance to get the `status=` empty-string bug wrong.
 *
 * A consumption records RAW stock used up during a service. It is IMMUTABLE: there is a POST, a GET
 * and a DELETE, and no PUT anywhere in the controller. Correcting one means deleting it (which
 * restocks) and recording it again.
 */

import type { InventoryType, StockUnitLine } from './inventory.types';

// ─── Reason ──────────────────────────────────────────────────────────────────

/**
 * Server enum. Sent as the constant name, never a label — the column carries a CHECK constraint.
 *
 * ⚠️ A value outside this union comes back as an HTTP **500**, not a 400: Spring fails to bind the
 * request body's enum and the handler never runs, so there is no validation error to report. That
 * is why the service layer guards with `isConsumptionReason` BEFORE the axios call — see
 * `parlour.service.ts`.
 */
export type ConsumptionReason =
  | 'SERVICE_USE'
  | 'INTERNAL_USE'
  | 'TRAINING'
  | 'SAMPLING'
  | 'TESTING'
  | 'OTHER';

/**
 * Every reason, in the order the chips are drawn.
 *
 * Ordered by how often a salon actually picks them, not alphabetically: SERVICE_USE is the reason
 * behind almost every record, so it is the first chip rather than the fourth.
 *
 * Unlike wastage, EVERY consumption reason is offered in the UI — there is no hidden system-only
 * member here, which is exactly why this file has one array and `wastage.types.ts` has two.
 */
export const CONSUMPTION_REASONS: readonly ConsumptionReason[] = [
  'SERVICE_USE',
  'INTERNAL_USE',
  'TRAINING',
  'SAMPLING',
  'TESTING',
  'OTHER',
];

/**
 * Narrows an unknown to a `ConsumptionReason`.
 *
 * Takes `unknown` rather than `string` on purpose: the values it guards arrive from route params,
 * AsyncStorage and server responses, none of which are typed, and a `string` parameter would push
 * the cast to every call site instead of holding it here.
 */
export function isConsumptionReason(value: unknown): value is ConsumptionReason {
  return typeof value === 'string' && (CONSUMPTION_REASONS as readonly string[]).includes(value);
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

/**
 * The sort keys the server whitelists, spelled EXACTLY as it spells them.
 *
 * Case matters and there is no error for getting it wrong: an unrecognised key silently falls back
 * to the default, so `consumedat` produces a list that looks sorted and is not. A tuple rather than
 * a plain array so the union below is derived from it and the two cannot drift.
 */
export const CONSUMPTION_SORT_KEYS = [
  'id',
  'consumedAt',
  'itemName',
  'quantity',
  'reason',
] as const;

export type ConsumptionSortKey = (typeof CONSUMPTION_SORT_KEYS)[number];

/** What the server sorts by when `sortBy` is absent. Newest first, paired with `sortDir: 'desc'`. */
export const DEFAULT_CONSUMPTION_SORT: ConsumptionSortKey = 'consumedAt';

// ─── Query ───────────────────────────────────────────────────────────────────

/**
 * Everything `GET /byBusiness` accepts beyond `businessId`, `page` and `limit`.
 *
 * `search` matches the item name server-side. Null means "no filter" — pass it through
 * `compactParams` so the key is genuinely absent from the query string rather than sent empty.
 */
export interface ConsumptionQuery {
  reason?: ConsumptionReason | null;
  search?: string | null;
  sortBy?: ConsumptionSortKey | null;
  sortDir?: 'asc' | 'desc' | null;
}

// ─── Create payload ──────────────────────────────────────────────────────────

/**
 * The POST body.
 *
 * `quantity` means one of two different things depending on `unitLines`, and getting that wrong is
 * silent overcounting:
 *
 *   • single level  — `quantity` is in LEVEL units, `unitMultiplier` is the level's `perStock`, and
 *     the server deducts `quantity × unitMultiplier` base units.
 *   • mixed (2+)    — `quantity` is already the BASE-unit total, `unitMultiplier` is 1, and
 *     `unitLines` carries the breakdown for display.
 *
 * `deriveUnitLinesPayload` in `batchUnits.ts` is the one place that decides between them; build the
 * payload from its result rather than assembling these four fields by hand.
 *
 * Consumption always draws from the RAW pool, so there is no `inventoryType` here — the server
 * fixes it. Wastage, which can write off either pool, does carry one.
 */
export interface ConsumptionPayload {
  businessId: number;
  itemId: number;
  /** Denormalised so the row survives the product being deleted. Server fills it when omitted. */
  itemName?: string | null;
  reason: ConsumptionReason;
  quantity: number;
  /** The level's unit name, or null on a mixed record. Null is NOT the same as `''`. */
  unitName?: string | null;
  unitMultiplier?: number | null;
  /** Null (not `[]`) on a single-level record — see `deriveUnitLinesPayload`. */
  unitLines?: StockUnitLine[] | null;
  /** IST wall clock, zone-less (`2026-08-08T14:30:00`). Server defaults to now when omitted. */
  consumedAt?: string | null;
  notes?: string | null;
}

// ─── Response ────────────────────────────────────────────────────────────────

/**
 * ONE batch the server drew from, and how much it took.
 *
 * ⚠️ Read the field names off the type, never off the neighbouring feature. A consumption's ledger
 * is `deductions: {batchId, qty}[]`; a stock transfer's is `lines: {sourceBatchId, destBatchId,
 * quantity}[]` — a DIFFERENT array name AND a different amount key. In Centrix both files name the
 * local `lines` and both call `lines.map((ln, i) => …)`, so the two blocks look copy-pasteable and
 * a copy renders an EMPTY table with no error at all: `record.lines` is undefined on a consumption,
 * `ln.quantity` is undefined on a deduction. Declaring both precisely is the only thing that turns
 * that into a compile error.
 */
export interface ConsumptionDeduction {
  batchId: number;
  /** NOT `quantity`. Base units taken out of that one batch. */
  qty: number;
}

/**
 * A consumption as the server returns it. Loose beyond the keys a screen reads, matching `BatchDto`.
 *
 * `deductions` is the FEFO ledger: which batches the quantity actually came out of, oldest expiry
 * first. Absent on a list row and present on the detail read.
 */
export interface ConsumptionDto {
  id?: number | null;
  businessId?: number | null;
  itemId?: number | null;
  itemName?: string | null;
  reason?: ConsumptionReason | null;
  /** Base units when `unitLines` is set, level units otherwise — see `ConsumptionPayload`. */
  quantity?: number | null;
  unitName?: string | null;
  unitMultiplier?: number | null;
  unitLines?: StockUnitLine[] | null;
  /** Always `RAW_INVENTORY` today. Present so a row can be read without assuming it. */
  inventoryType?: InventoryType | null;
  consumedAt?: string | null;
  notes?: string | null;
  /** ⚠️ `deductions`, not `lines`. See `ConsumptionDeduction`. */
  deductions?: ConsumptionDeduction[] | null;
  createdAt?: string | null;
  [k: string]: unknown;
}
