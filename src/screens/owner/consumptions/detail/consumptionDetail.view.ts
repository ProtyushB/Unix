import { isConsumptionReason } from '../../../../backend/modules/shared/consumption.types';
import { formatStockedQty, unitLinesBaseQty } from '../../inventory/batchUnits';
import { shouldResumeCatalogPick } from '../../shared/detail/catalogPicker.view';
import type { ConsumptionFormState } from './consumptionDetail.model';

/**
 * The Consumption Detail screen's mode/view machine and its validation.
 *
 * Note what is missing: there is **no `'edit'` mode**. A consumption is immutable after creation and
 * the backend has no PUT, so the screen is only ever reading a saved record or composing a new one.
 * Correcting one means deleting it — which RESTOCKS — and recording it again.
 */

export type DetailMode = 'view' | 'add';
export type DetailView = 'LOADING' | 'ERROR' | 'READY' | 'SAVING';

export interface DetailViewInput {
  mode: DetailMode;
  loading: boolean;
  saving: boolean;
  hasError: boolean;
  hasItem: boolean;
}

/**
 * Precedence: saving, then error, then add-is-always-ready, then loading.
 *
 * Add never loads — there is nothing to fetch — so it must not fall through to LOADING and render a
 * spinner over an empty form the user is trying to fill in.
 */
export function deriveDetailView(i: DetailViewInput): DetailView {
  if (i.saving) return 'SAVING';
  if (i.hasError) return 'ERROR';
  if (i.mode === 'add') return 'READY';
  if (i.loading || !i.hasItem) return 'LOADING';
  return 'READY';
}

/** The one place mode becomes "are these fields inputs". */
export function isEditable(mode: DetailMode): boolean {
  return mode === 'add';
}

/** Delete lives on the read screen only. */
export function showsDelete(mode: DetailMode): boolean {
  return mode === 'view';
}

/**
 * There is no Edit affordance anywhere on this screen.
 *
 * Kept as a named function rather than simply omitted, because every sibling detail screen has one
 * and its absence here is a deliberate decision rather than an oversight.
 */
export function showsEditCta(): boolean {
  return false;
}

/**
 * Whether the picker offers "New Product".
 *
 * Only while composing. In view mode the picker is unreachable anyway, but the rule is stated here
 * beside its siblings rather than left implicit in JSX — that is the whole point of this machine.
 */
export function showsCreateProduct(mode: DetailMode): boolean {
  return mode === 'add';
}

/**
 * Whether to fetch the product catalog.
 *
 * Add mode only, and only when nothing is held and nothing is in flight. Clearing the held rows is
 * therefore how the screen re-arms this after returning from creating a product — without a refetch
 * the user would come back to a picker that does not list the thing they just made.
 */
export function shouldLoadCatalog(input: {
  mode: DetailMode;
  hasRows: boolean;
  loading: boolean;
}): boolean {
  return input.mode === 'add' && !input.hasRows && !input.loading;
}

/**
 * On regaining focus: do we reopen the picker because we left it to create a product?
 *
 * Delegates to the shared rule — Inventory, Orders and Appointments all ask the same question, and
 * four copies of it would be four chances to drift.
 */
export function shouldResumeProductPick(input: {
  awaitingProduct: boolean;
  isFirstFocus: boolean;
}): boolean {
  return shouldResumeCatalogPick({
    awaiting: input.awaitingProduct,
    isFirstFocus: input.isFirstFocus,
  });
}

// ─── App-bar copy ────────────────────────────────────────────────────────────

/** "Record Consumption" while composing; the product's name once saved. */
export function appBarTitle(mode: DetailMode, itemName: string | null | undefined): string {
  return mode === 'add' ? 'Record Consumption' : (itemName || '').trim() || 'Consumption';
}

/**
 * "Deduct raw stock" under the form's title, and nothing at all on the read screen.
 *
 * The verb is the point: this screen is the only place in the app that removes stock without an
 * order behind it, and a subtitle reading "New consumption" would not say so.
 */
export function appBarSubtitle(mode: DetailMode): string {
  return mode === 'add' ? 'Deduct raw stock' : '';
}

// ─── Stock helpers ───────────────────────────────────────────────────────────

/**
 * The RAW total under the product field — "180 g". An em dash while it is genuinely unknown.
 *
 * ⚠️ `null` is not zero, and the difference is the whole reason this is a function. "0 g" says the
 * shelf is empty; the dash says the answer has not come back yet. Rendering the first while waiting
 * tells a user with 180 g on hand that they cannot record anything.
 */
export function rawStockValue(
  availableBaseQty: number | null | undefined,
  baseUnit: string,
): string {
  if (availableBaseQty === null || availableBaseQty === undefined) return '—';
  const n = Number(availableBaseQty);
  if (!Number.isFinite(n)) return '—';
  return formatStockedQty(n, null, baseUnit);
}

/**
 * "Across 3 active RAW batches · deducted FEFO (soonest expiry first)."
 *
 * The batch count is dropped rather than guessed when it is unknown — the FEFO half is true
 * regardless and is the half the user needs, so the sentence degrades instead of disappearing.
 * A "0 batches" here would contradict the stock total sitting directly above it.
 */
export function fefoHelperLine(activeBatchCount: number | null | undefined): string {
  const tail = 'deducted FEFO (soonest expiry first).';
  if (activeBatchCount === null || activeBatchCount === undefined) return `Stock is ${tail}`;
  const n = Number(activeBatchCount);
  if (!Number.isFinite(n) || n < 0) return `Stock is ${tail}`;
  return `Across ${n} active RAW ${n === 1 ? 'batch' : 'batches'} · ${tail}`;
}

/**
 * The read screen's one-line ledger: "Entered as 1 scoop · 15 g — deducted FEFO from BATCH-…".
 *
 * ⚠️ A SENTENCE, not a table. A consumption's ledger is `deductions: {batchId, qty}[]`; a stock
 * transfer's is `lines: {sourceBatchId, destBatchId, quantity}[]`. The two render blocks look
 * copy-pasteable and are not — a copy draws an EMPTY table with no error at all, because
 * `record.lines` is undefined here and `ln.quantity` is undefined there. One line of prose cannot
 * be silently empty in that way.
 *
 * The "Entered as" half is dropped when the quantity was a single level: "Entered as 45 g — …" only
 * restates the figure printed above it.
 */
export function enteredAsLine(input: {
  /** `recordQtyLabel`'s output — "1 scoop · 15 g" or "2 bottles". */
  qtyText: string;
  /** True when the record carries a 2+ row breakdown worth restating. */
  mixed: boolean;
  /** `batchText`'s output. Empty when the record carries no ledger. */
  batchText: string;
}): string {
  const source = input.batchText || 'the soonest-expiring batches';
  const drawn = `deducted FEFO from ${source}.`;
  if (!input.mixed || !input.qtyText) {
    return `${drawn.charAt(0).toUpperCase()}${drawn.slice(1)}`;
  }
  return `Entered as ${input.qtyText} — ${drawn}`;
}

/**
 * The warning under Delete: "Deleting restocks 45 g to BATCH-260722-03. This can't be undone."
 *
 * Names the AMOUNT and the destination because a delete here is a stock movement in the opposite
 * direction, not a tidy-up — and it is the only stock movement in this app that a user can trigger
 * without a screen telling them a number first. Degrades to "to its source batches" when the
 * reference is unknown rather than dropping the sentence.
 */
export function deleteWarning(input: {
  baseQty: number | null | undefined;
  baseUnit: string;
  batchText: string;
}): string {
  const amount = rawStockValue(input.baseQty, input.baseUnit);
  const what = amount === '—' ? 'the deducted quantity' : amount;
  const where = input.batchText || 'its source batch(es)';
  return `Deleting restocks ${what} to ${where}. This can’t be undone.`;
}

// ─── "Now", in IST ───────────────────────────────────────────────────────────

/**
 * The current IST wall clock as `YYYY-MM-DDTHH:mm:ss` — the same shape `consumedAt` travels in.
 *
 * Deliberately the device's day only by coincidence. Every boundary the server evaluates is in
 * Asia/Kolkata, so a client comparing against its own timezone disagrees with the backend for
 * anyone travelling and for everyone during the hours the two days differ. `todayIst` in
 * `utils/dateRange` records the same rule for dates; this is the same rule with a clock on it, and
 * it lives here rather than there because that file is not this feature's to edit.
 *
 * `hourCycle: 'h23'` rather than `hour12: false`, which renders midnight as "24" on some ICU
 * builds; the guard below covers the rest.
 */
export function nowIst(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const at = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = at('hour') === '24' ? '00' : at('hour');
  return `${at('year')}-${at('month')}-${at('day')}T${hour}:${at('minute')}:${at('second')}`;
}

/**
 * A zone-less wall clock as comparable milliseconds.
 *
 * Both sides of every comparison go through here, so pinning the parts to UTC is a shared fiction
 * that cancels out — and it cancels a DST or offset shift that subtracting two local `Date`s
 * would not. NaN for anything unparseable, which the caller reads as "do not judge this".
 */
function wallClockMs(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(
    String(value).trim(),
  );
  if (!m) return NaN;
  return Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] ?? 0),
    Number(m[5] ?? 0),
    Number(m[6] ?? 0),
  );
}

/**
 * How far ahead of now a `consumedAt` may sit before the server refuses it: two minutes.
 *
 * Not zero, and the slack is not politeness. The value is composed on the device and evaluated on
 * the server, so a clock that is a few seconds fast would make "now" itself illegal — the single
 * commonest thing anyone records. Two minutes is the window the backend allows; matching it exactly
 * means the client refuses precisely what the server would and nothing more.
 */
export const CONSUMED_AT_FUTURE_GRACE_MS = 2 * 60 * 1000;

/** Whether a composed `consumedAt` is far enough ahead of IST now to be refused. */
export function isConsumedAtInFuture(consumedAt: string, now: Date = new Date()): boolean {
  const entered = wallClockMs(consumedAt);
  if (Number.isNaN(entered)) return false;
  return entered > wallClockMs(nowIst(now)) + CONSUMED_AT_FUTURE_GRACE_MS;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationErrors = Record<string, string>;

export interface ValidateOptions {
  /**
   * RAW stock on hand in base units, for the over-draw check. Null means "not known yet", which
   * SKIPS the check — refusing a quantity because a fetch has not landed would block a user whose
   * stock is fine.
   */
  availableBaseQty?: number | null;
  /** Injectable so the future check is deterministic under test. */
  now?: Date;
  /** The product's base unit, for a shortfall message that names a real quantity. */
  baseUnit?: string;
}

/**
 * The create rules, mirroring `validateBatch`'s habit of naming the field rather than the form.
 *
 * Every one of these is ALSO enforced somewhere else, and that is the point — each is caught here
 * because the version the user would otherwise meet is worse:
 *
 *   • `itemId` — nothing else on the form means anything without it.
 *   • quantity — `deriveUnitLinesPayload` answers null for an empty entry, and that null is the
 *     signal. Posting a zero is accepted by nobody and means nothing.
 *   • the over-draw — the server refuses it with a message naming the shortfall, but the user has
 *     the number on screen already and should not have to round-trip to be told.
 *   • `reason` — the service guards this too, and that guard is the last line rather than the
 *     first: a bad enum is an HTTP **500** with nothing readable in it, not a 400.
 *   • `consumedAt` — required by the board, and refused by the server more than two minutes ahead.
 *
 * Insertion order is the form's reading order, because `errorSummary` toasts the FIRST one and the
 * user should be sent to the top of the form rather than to the bottom of it.
 */
export function validateConsumption(
  form: ConsumptionFormState,
  opts: ValidateOptions = {},
): ValidationErrors {
  const errors: ValidationErrors = {};
  const baseUnit = opts.baseUnit || 'unit';

  if (form.itemId == null) errors.itemId = 'Pick a product';

  const entered = unitLinesBaseQty(form.unitRows);
  if (!(entered > 0)) {
    errors.quantity = 'Enter a quantity';
  } else if (opts.availableBaseQty !== null && opts.availableBaseQty !== undefined) {
    const available = Number(opts.availableBaseQty);
    if (Number.isFinite(available) && entered > available) {
      errors.quantity = `Only ${formatStockedQty(available, null, baseUnit)} in RAW stock`;
    }
  }

  if (!isConsumptionReason(form.reason)) errors.reason = 'Pick a consumption reason';

  if (!form.consumedAt.trim()) {
    errors.consumedAt = 'Pick when this was used';
  } else if (isConsumedAtInFuture(form.consumedAt, opts.now)) {
    errors.consumedAt = 'Consumed at cannot be in the future';
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The first error, for a toast when the offending field is scrolled out of sight. */
export function errorSummary(errors: ValidationErrors): string | null {
  const keys = Object.keys(errors);
  return keys.length ? errors[keys[0]] : null;
}
