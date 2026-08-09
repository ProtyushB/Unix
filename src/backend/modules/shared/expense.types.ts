/**
 * Shapes shared by the parlour and pharmacy EXPENSE APIs.
 *
 * Sibling of `inventory.types.ts` / `consumption.types.ts` / `wastage.types.ts`; `compactParams`
 * comes from the first of those rather than being copied.
 *
 * An expense is a NON-INVENTORY outflow — rent, electricity, a CCTV repair. It touches no batch, no
 * pool and no stock ledger, which is what makes this the odd one out among the Stock & Ops
 * features: there is nothing to deduct and nothing to restock.
 *
 * It is also the only one that is EDITABLE. Consumption, wastage and stock transfers are all
 * POST/GET/DELETE with no PUT, because changing one would mean re-running a stock movement. An
 * expense has no movement to re-run, so it has a real update endpoint and the detail screen has a
 * real edit mode.
 *
 * Three enums travel on this contract and a value outside any of them is an HTTP **500**, not a 400
 * — Spring cannot bind the body's enum, so `@Valid` never runs and there is no field error to
 * render. The service guards all three locally before the axios call.
 */

// ─── Category ────────────────────────────────────────────────────────────────

/**
 * Server enum — 15 members, matching `ExpenseCategory.java` exactly.
 *
 * ⚠️ This list is also gated at runtime. When the platform's `expenseCategory` feature is off the
 * server SILENTLY REWRITES whatever category was sent to `OTHER`, on both create and update — no
 * error, no warning. A client that shows the picker anyway would display a choice the server
 * discards, so the screen reads `expenseCategoryEnabled` from tab-config and hides it instead.
 */
export type ExpenseCategory =
  | 'MAINTENANCE_REPAIR'
  | 'UTILITIES'
  | 'RENT_LEASE'
  | 'OFFICE_SUPPLIES'
  | 'STAFF_WELFARE'
  | 'CLEANING_HYGIENE'
  | 'TRANSPORT_FUEL'
  | 'MARKETING_ADVERTISING'
  | 'LICENSES_FEES'
  | 'INSURANCE'
  | 'TAXES'
  | 'BANK_FEES'
  | 'TRAINING_DEVELOPMENT'
  | 'PROFESSIONAL_SERVICES'
  | 'OTHER';

/**
 * Every category, in the server's declaration order, with the label to render.
 *
 * One array, not two — unlike `WASTAGE_REASONS` / `WASTAGE_REASON_CHOICES`, every category the
 * server accepts is also one a person may pick. There is no hidden member here.
 *
 * The labels are the same strings Centrix hardcodes (`ExpensesPage.jsx`), so the two clients name a
 * category identically. No endpoint serves this list; both clients carry their own copy.
 */
export const EXPENSE_CATEGORIES: readonly { value: ExpenseCategory; label: string }[] = [
  { value: 'MAINTENANCE_REPAIR', label: 'Maintenance & Repair' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'RENT_LEASE', label: 'Rent / Lease' },
  { value: 'OFFICE_SUPPLIES', label: 'Office Supplies' },
  { value: 'STAFF_WELFARE', label: 'Staff Welfare' },
  { value: 'CLEANING_HYGIENE', label: 'Cleaning & Hygiene' },
  { value: 'TRANSPORT_FUEL', label: 'Transport & Fuel' },
  { value: 'MARKETING_ADVERTISING', label: 'Marketing & Advertising' },
  { value: 'LICENSES_FEES', label: 'Licenses & Fees' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'TAXES', label: 'Taxes' },
  { value: 'BANK_FEES', label: 'Bank Fees' },
  { value: 'TRAINING_DEVELOPMENT', label: 'Training & Development' },
  { value: 'PROFESSIONAL_SERVICES', label: 'Professional Services' },
  { value: 'OTHER', label: 'Other' },
];

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return (
    typeof value === 'string' && EXPENSE_CATEGORIES.some((c) => c.value === (value as ExpenseCategory))
  );
}

/** The label for a category, falling back to the raw value so an unknown member still renders. */
export function categoryLabel(value: unknown): string {
  const hit = EXPENSE_CATEGORIES.find((c) => c.value === value);
  return hit ? hit.label : typeof value === 'string' ? value : '';
}

// ─── Payment method ──────────────────────────────────────────────────────────

/** Server enum — 5 members, matching `PaymentMethod.java`. Optional on an expense. */
export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET';

/**
 * The five methods, with labels.
 *
 * ⚠️ No blank/"Not specified" member, deliberately — Centrix carries one as `{ value: '' }` because
 * its `<Listbox>` needs a selectable placeholder, and that empty string then has to be mapped back
 * to `null` before the call. Absence is modelled as `null` here instead, so nothing can serialise
 * `paymentMethod: ''` — which is not a member and would be a 500.
 */
export const PAYMENT_METHODS: readonly { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'UPI', label: 'UPI' },
  { value: 'NET_BANKING', label: 'Net Banking' },
  { value: 'WALLET', label: 'Wallet' },
];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && PAYMENT_METHODS.some((p) => p.value === (value as PaymentMethod));
}

/** "UPI" / "—". Absence renders as a dash rather than a blank, so the row keeps its shape. */
export function paymentMethodLabel(value: unknown): string {
  const hit = PAYMENT_METHODS.find((p) => p.value === value);
  return hit ? hit.label : '—';
}

// ─── Recurrence ──────────────────────────────────────────────────────────────

/**
 * How often the spend repeats. Server enum — 6 members, matching `ExpenseRecurrence.java`.
 *
 * ⚠️ A LABEL, not a schedule. Nothing on the server generates future expenses from it — no
 * scheduler, no parent/child link, no "next due". It exists so a ₹45,000 monthly rent can be told
 * apart from a ₹45,000 one-off purchase.
 *
 * ⚠️ The column is NULLABLE and rows written before it existed were deliberately not backfilled, so
 * a `null` off the wire means `NONE` and must be coalesced rather than rendered as blank.
 */
export type ExpenseRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export const EXPENSE_RECURRENCES: readonly { value: ExpenseRecurrence; label: string }[] = [
  { value: 'NONE', label: "Doesn't repeat" },
  { value: 'DAILY', label: 'Every day' },
  { value: 'WEEKLY', label: 'Every week' },
  { value: 'MONTHLY', label: 'Every month' },
  { value: 'QUARTERLY', label: 'Every quarter' },
  { value: 'YEARLY', label: 'Every year' },
];

export function isExpenseRecurrence(value: unknown): value is ExpenseRecurrence {
  return (
    typeof value === 'string' &&
    EXPENSE_RECURRENCES.some((r) => r.value === (value as ExpenseRecurrence))
  );
}

/** Null coalesces to NONE — see the warning on the type. Never returns blank for a legacy row. */
export function recurrenceLabel(value: unknown): string {
  const key = value == null || value === '' ? 'NONE' : value;
  const hit = EXPENSE_RECURRENCES.find((r) => r.value === key);
  return hit ? hit.label : typeof value === 'string' ? value : "Doesn't repeat";
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

/**
 * The server's whitelist, spelled exactly as the server spells it — `sortableFields()` in
 * `GenericExpenseService`.
 *
 * ⚠️ CASE-SENSITIVE. It is a plain `Set.contains`, so `expensedate` does not match and is silently
 * coerced to `expenseDate` rather than erroring — a typo produces a list that looks sorted by
 * something it is not. (The service's own Javadoc claims case-insensitive; the code disagrees and
 * the code wins.)
 *
 * ⚠️ There is deliberately no `reimbursable`/`reimbursed` key. The reimbursement pill is DERIVED
 * from two booleans rather than stored as a status, and the server states outright that the derived
 * pill is never sortable. A sort by it would silently fall back to `expenseDate`.
 */
export const EXPENSE_SORT_KEYS = [
  'id',
  'expenseDate',
  'title',
  'category',
  'amount',
  'vendorName',
] as const;

export type ExpenseSortKey = (typeof EXPENSE_SORT_KEYS)[number];

export function isExpenseSortKey(value: unknown): value is ExpenseSortKey {
  return typeof value === 'string' && (EXPENSE_SORT_KEYS as readonly string[]).includes(value);
}

/** What the server sorts by when `sortBy` is absent. Newest first, paired with `sortDir: 'desc'`. */
export const DEFAULT_EXPENSE_SORT: ExpenseSortKey = 'expenseDate';

// ─── Query ───────────────────────────────────────────────────────────────────

/**
 * Everything `GET /byBusiness` accepts beyond `businessId`, `page` and `limit`.
 *
 * `search` matches `title` and `vendorName` ONLY — not `notes`, despite the controller's Javadoc
 * saying otherwise. The Specification is authoritative and it names two columns.
 *
 * `pendingReimbursementOnly` applies only when literally `true`; `false` and `null` both mean "no
 * filter". There is no way to ask for "already settled only" — which is why the screen offers two
 * chips (All / Pending) rather than three.
 */
export interface ExpenseQuery {
  category?: ExpenseCategory | null;
  pendingReimbursementOnly?: boolean | null;
  search?: string | null;
  sortBy?: ExpenseSortKey | null;
  sortDir?: 'asc' | 'desc' | null;
}

// ─── Files ───────────────────────────────────────────────────────────────────

/**
 * One receipt, as the server stores it — a metadata record, never bytes.
 *
 * ModuleX never receives a file: the client uploads to the separate DMS service, then sends the
 * resulting metadata here as ordinary JSON. `dmsFileId` is the only field DMS itself needs back.
 */
export interface ExpenseFile {
  dmsFileId: number;
  url?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
}

// ─── Payloads ────────────────────────────────────────────────────────────────

/**
 * The POST body.
 *
 * ⚠️ `reimbursed`, `reimbursedAt` and `reimbursedBy` are deliberately ABSENT, and their absence is
 * load-bearing rather than an oversight. `recordExpense` nulls the id and defaults the booleans but
 * never clears those three, and the mapper copies them straight through — so a POST carrying
 * `reimbursed: true` would persist a fully settled expense, bypassing `markReimbursed` and both its
 * eligibility checks. Only the UPDATE funnel is hardened server-side. Do not add them back; the
 * PATCH endpoint is the only route to a settled expense.
 *
 * ⚠️ `createdAt` is absent too — server-stamped by `@PrePersist`, and anything sent is discarded.
 */
export interface ExpensePayload {
  /** `@NotNull @Positive`. An unknown business is a 500 here, not a 404 — validate before sending. */
  businessId: number;
  /** `@NotBlank`. No `@Size`, but the column is 255 — an over-long title is a 500 at flush. */
  title: string;
  /** `@NotNull`. Guarded locally by `isExpenseCategory` — a bad enum is a 500, not a 400. */
  category: ExpenseCategory;
  /** `@NotNull @Positive`. Zero and negatives are refused. */
  amount: number;
  paymentMethod?: PaymentMethod | null;
  vendorName?: string | null;
  /** Null is legal and reads as `NONE`; the client sends `NONE` explicitly rather than omitting. */
  recurrence?: ExpenseRecurrence | null;
  /**
   * ISO-8601 instant. ⚠️ A non-ISO value is a 500, not a 400 — there is no type-mismatch handler.
   * Build it from the IST wall clock the form collects, never from a device-zone `Date`.
   */
  expenseDate?: string | null;
  /** `employments(id)`, NOT a person id. Setting it triggers the REIMBURSEMENT feature gate. */
  paidByEmployeeId?: number | null;
  reimbursable?: boolean | null;
  notes?: string | null;
  description?: string | null;
  /** Receipts. Uploaded to DMS first; only the metadata travels here. */
  files?: ExpenseFile[] | null;
}

/**
 * The PUT body — the create payload plus the id.
 *
 * ⚠️ `businessId` is IGNORED by the update funnel but is still `@NotNull @Positive`, so it must be
 * sent anyway or the request is a 400 naming a field the user cannot see. Sending it does not let
 * an expense be reassigned to another business; the server drops the value.
 *
 * ⚠️ `files` is REPLACE, not append: the module updater overwrites the collection with whatever
 * arrives, and the `else` branch writes an empty list. A PUT that omits `files` therefore ERASES
 * every receipt on the expense. `buildUpdatePayload` always emits the full list for that reason.
 */
export interface ExpenseUpdatePayload extends ExpensePayload {
  id: number;
}

// ─── Response ────────────────────────────────────────────────────────────────

/** An expense as the server returns it. Loose beyond the keys a screen reads, matching `BatchDto`. */
export interface ExpenseDto {
  id?: number | null;
  businessId?: number | null;
  title?: string | null;
  description?: string | null;
  category?: ExpenseCategory | null;
  amount?: number | null;
  paymentMethod?: PaymentMethod | null;
  vendorName?: string | null;
  /** ⚠️ Null on rows written before the column existed — coalesce to `NONE`. */
  recurrence?: ExpenseRecurrence | null;
  expenseDate?: string | null;
  paidByEmployeeId?: number | null;
  reimbursable?: boolean | null;
  reimbursed?: boolean | null;
  reimbursedAt?: string | null;
  reimbursedBy?: number | null;
  notes?: string | null;
  createdAt?: string | null;
  createdBy?: number | null;
  /**
   * ⚠️ Always `[]` on a DELETE response regardless of what was attached — the lazy collection is
   * uninitialised once the session closes and the mapper emits an empty list rather than loading
   * it. Never render receipts off a delete payload.
   */
  files?: ExpenseFile[] | null;
  [k: string]: unknown;
}

// ─── Derived reimbursement state ─────────────────────────────────────────────

/**
 * The three states the reimbursement pill can be in.
 *
 * There is NO `ExpenseStatus` enum on the server and there is not going to be one — the state is
 * derived from two independent booleans. Deriving it in one tested place stops three screens from
 * each inventing their own truth table, and stops anyone treating "not reimbursable" as "pending".
 */
export type ReimbursementState = 'NOT_REIMBURSABLE' | 'PENDING' | 'SETTLED';

export function reimbursementState(expense: {
  reimbursable?: boolean | null;
  reimbursed?: boolean | null;
}): ReimbursementState {
  if (!expense?.reimbursable) return 'NOT_REIMBURSABLE';
  return expense.reimbursed ? 'SETTLED' : 'PENDING';
}
