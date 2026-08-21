/**
 * Shared Module Hook Factory
 *
 * createModuleHook creates a React hook with identical structure for all modules.
 * Each module (Parlour, Pharmacy, Restaurant) uses this with its own service provider.
 *
 * getSelectedBusinessId reads from session storage (AsyncStorage).
 */

import { useState, useCallback, useMemo } from 'react';
import {
  getSelectedBusiness,
  getSelectedBusinessType,
  getBusinessTypeMap,
} from '../../../../storage/session.storage';
import type {
  InventoryQuery,
  InventoryStatus,
  InventoryType,
  StatusChangeOptions,
} from '../inventory.types';
import type { ConsumptionPayload, ConsumptionQuery } from '../consumption.types';
import type { WastagePayload, WastageQuery } from '../wastage.types';
import type { ExpensePayload, ExpenseQuery, ExpenseUpdatePayload } from '../expense.types';
import type { StockTransferPayload, StockTransferQuery } from '../stockTransfer.types';
import { DmsService } from '../../../dms/service/dms.service';
import { createEntityFolder } from '../../../dms/util/EntityFolderUtils';
import { NativeFile, ResourceFileDto } from '../../../dms/api/file.api.interface';
// ModuleX refuses a write with HTTP 200 and `success: false`, so the wrapper arrives as an ordinary
// result rather than as a rejection. The body is the only thing the shared gate can inspect, so a
// site that lifts a field out of that wrapper and drops the envelope hands the user whatever the
// server wrote — an SQL dump, a helpful NPE, an absolute storage path, an internal host — while the
// identical text arriving on a REJECTED request is demoted. One failure, two routes, two answers.
//
// Which is why no site in this file reads those fields itself. All 55 refusal branches go through
// one of two doors: the 16 that turn the refusal back into a throw use `apiError`, which carries the
// wrapper on the thrown error so the catch below gates it, and the 39 that hand the message back
// without throwing use `apiMessage`, which runs the same gate with no throw to hang it on.
// `extractErrorInfo` and `extractErrorMessage` are the other half, for requests that really did
// reject. Nothing enforces this but reading: a new branch that spells the old
// `error || message || 'fallback'` chain out by hand is outside the gate again, silently.
import {
  apiError,
  apiMessage,
  extractErrorInfo,
  extractErrorMessage,
} from '../../../shared/http/axiosError';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceResult<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  error?: string | null;
  totalPages?: number;
  /** Total matching rows across every page. Absent unless the endpoint sends it. */
  totalElements?: number;
}

/** Services list filters. `search` matches the service name only, server-side. */
export interface ServiceListOptions {
  search?: string;
  sortBy?: string;
  sortDir?: string;
}

/** Products list filters. `search` matches product name and brand, server-side. */
export interface ProductListOptions {
  search?: string;
  sortBy?: string;
  sortDir?: string;
}

/**
 * Catalog-wide figures that ride on the product list response — the "142 items · 6 low on stock"
 * header. Business-scoped, so they do not shrink when a search narrows the rows.
 */
export interface ProductListMeta {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  /** Use this for row badges rather than a hardcoded copy, so badges and counts cannot disagree. */
  lowStockThreshold: number;
}

/** Orders V2 list filters (status = comma-separated OrderStatus; dates = YYYY-MM-DD, IST). */
export interface OrderListOptions {
  search?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortDir?: string;
}

/**
 * Filters for the bill's Add-items pickers — one customer's UNBILLED orders / appointments.
 *
 * `billId` is the one that is easy to omit and impossible to notice: while editing a bill, the
 * orders and appointments already on it are `isBilled = true` and would otherwise be filtered out
 * of their own picker, so the user could not see or un-tick the lines in front of them. Pass the
 * bill's own id when editing; omit it when creating.
 */
export interface BillableListOptions {
  businessId: number;
  billId?: number;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: string;
}

/** Orders V2 status-chip summary: total in scope + per-status counts (zero-count statuses omitted). */
export interface OrderSummary {
  total: number;
  byStatus: Record<string, number>;
}

/**
 * Appointments list filters. The day view sends fromDate === toDate plus `sortDir: 'asc'` — the
 * backend's viewAll defaults to desc, so ascending has to be explicit or the day reads bottom-up.
 */
export interface AppointmentListOptions {
  search?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortDir?: string;
}

/**
 * One page of appointments, HANDED BACK rather than stored — see `fetchAppointmentsPage`.
 *
 * `totalPages` is the only paging figure these endpoints report, so it is the only one here; a
 * row count would be a guess. On a failure the rows are empty and `error` is a sentence.
 */
export interface AppointmentPage {
  success: boolean;
  rows: unknown[];
  totalPages: number;
  error: string | null;
}

/**
 * Per-IST-day appointment counts backing the week strip / month grid dots. Keys are YYYY-MM-DD and
 * match a row's own `appointmentDate`, so one indexes the other with no client-side date maths.
 */
export interface AppointmentDayCounts {
  total: number;
  counts: Record<string, number>;
}

/**
 * Bills list filters. No date window — the billing screens have no date filter and the backend
 * accepts none. `billStatus` and `paymentStatus` are comma-separated enum-name lists and are
 * independent axes: a bill can be FINALIZED and UNPAID at once.
 *
 * `search` does NOT match customer name — bill number, phone, email and numeric id only.
 */
export interface BillListOptions {
  search?: string;
  billStatus?: string;
  paymentStatus?: string;
  sortBy?: string;
  sortDir?: string;
}

/**
 * All-time billing rollup behind the header line, the status chips and the wallet card.
 *
 * `countsByPaymentStatus` is sparse — an absent status simply has no chip. The split and the total
 * both come from the server so the header figure and the wallet breakdown cannot drift:
 * outstandingFromPartial + outstandingFromUnpaid === totalOutstanding.
 */
export interface BillSummary {
  totalBills: number;
  countsByPaymentStatus: Record<string, number>;
  countsByBillStatus: Record<string, number>;
  /** Collected across EVERY bill, so a partially-paid bill's paid portion is included. */
  totalPaid: number;
  outstandingFromPartial: number;
  outstandingFromUnpaid: number;
  totalOutstanding: number;
  outstandingBillCount: number;
}

interface ModuleService {
  getAllProducts(
    businessId: number,
    page: number,
    limit: number,
    options?: ProductListOptions,
  ): Promise<ServiceResult & { meta?: ProductListMeta }>;
  updateProductTracking?(id: number, trackInventory: boolean): Promise<ServiceResult>;
  /** One product, fully hydrated. The detail screen's only read — see `loadProduct`. */
  getProductById(id: number): Promise<ServiceResult>;
  createProduct(data: Record<string, unknown>): Promise<ServiceResult>;
  updateProduct(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteProduct(id: number): Promise<ServiceResult>;
  /**
   * Idempotent "give me this entity's DMS folder, creating or renaming it as needed".
   *
   * Optional because it is a common controller rather than a module one, so a module client that
   * has not been given the route yet simply omits it and callers guard with `?.`.
   */
  ensureEntityFolder?(params: {
    businessId: number;
    /** Mirrors the server's `EntityFolderType`; products and services each get their own root. */
    type: 'PRODUCT' | 'SERVICE' | 'EXPENSE';
    entityId: number;
    entityName?: string;
    currentFolderId?: number | null;
  }): Promise<ServiceResult>;
  /**
   * The same idea one level down: the folder for ONE quick-add line on ONE bill.
   *
   * Its own method rather than a fourth `EntityFolderType`, because the KEY differs — a quick-add
   * line has no entity id, only a bill id and a client-minted `lineId` uuid.
   */
  ensureBillItemFolder?(params: {
    businessId: number;
    billId: number;
    lineId: string;
    itemName?: string;
    currentFolderId?: number | null;
  }): Promise<ServiceResult>;
  /** Narrow PATCH that records file ids on a saved bill's quick-add lines. Never the full PUT. */
  attachQuickItemPhotos?(
    billId: number,
    links: Array<{ lineId: string; dmsFolderId: number; photos: unknown[] }>,
  ): Promise<ServiceResult>;

  getAllServices(
    businessId: number,
    page: number,
    limit: number,
    options?: ServiceListOptions,
  ): Promise<ServiceResult>;
  updateServiceAvailability?(id: number, availability: boolean): Promise<ServiceResult>;
  /** One service, fully hydrated. The detail screen's only read — see `loadService`. */
  getServiceById(id: number): Promise<ServiceResult>;
  createService(data: Record<string, unknown>): Promise<ServiceResult>;
  updateService(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteService(id: number): Promise<ServiceResult>;

  getAllOrders(
    businessId: number,
    page: number,
    limit: number,
    options?: OrderListOptions,
  ): Promise<ServiceResult>;
  // Optional: only modules whose backend exposes /{module}Order/summary implement it (Parlour,
  // Pharmacy). Restaurant omits it, so callers must guard with `service.getOrderSummary?.(...)`.
  getOrderSummary?(
    businessId: number,
    options?: { fromDate?: string; toDate?: string },
  ): Promise<ServiceResult<OrderSummary>>;
  // Optional for the same reason as getOrderSummary — only Parlour and Pharmacy expose
  // PATCH /{module}Order/{id}/status. Callers must guard with `service.updateOrderStatus?.(...)`.
  updateOrderStatus?(
    id: number,
    status: string,
    options?: { userId?: number; reason?: string },
  ): Promise<ServiceResult>;
  /** One order, fully hydrated. The detail screen's only read — see `loadOrder`. */
  getOrderById(id: number): Promise<ServiceResult>;
  createOrder(data: Record<string, unknown>): Promise<ServiceResult>;
  updateOrder(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteOrder(id: number): Promise<ServiceResult>;
  getOrdersByCustomer(customerId: number, options: Record<string, unknown>): Promise<ServiceResult>;
  /** One customer's UNBILLED orders, for the bill's Add-items picker. */
  getBillableOrders(customerId: number, options: BillableListOptions): Promise<ServiceResult>;

  getAllAppointments(
    businessId: number,
    page: number,
    limit: number,
    options?: AppointmentListOptions,
  ): Promise<ServiceResult>;
  // Optional for the same reason as getOrderSummary — only Parlour and Pharmacy expose these three.
  // Restaurant omits them, so callers must guard with `service.getAppointmentDayCounts?.(...)`.
  getAppointmentDayCounts?(
    businessId: number,
    options: { fromDate: string; toDate: string },
  ): Promise<ServiceResult<AppointmentDayCounts>>;
  updateAppointmentStatus?(
    id: number,
    status: string,
    options?: { userId?: number; reason?: string },
  ): Promise<ServiceResult>;
  rescheduleAppointment?(
    id: number,
    appointmentDateTime: string,
    options?: { userId?: number; reason?: string },
  ): Promise<ServiceResult>;
  /** One appointment, fully hydrated. The detail screen's only read — see `loadAppointment`. */
  getAppointmentById(id: number): Promise<ServiceResult>;
  /** Completes ONE service on an appointment. `itemId` is a string — see the api impl. */
  completeAppointmentItem(appointmentId: number, itemId: string): Promise<ServiceResult>;
  createAppointment(data: Record<string, unknown>): Promise<ServiceResult>;
  updateAppointment(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteAppointment(id: number): Promise<ServiceResult>;
  getAppointmentsByCustomer(
    customerId: number,
    options: Record<string, unknown>,
  ): Promise<ServiceResult>;
  /** One customer's UNBILLED appointments. Same contract as `getBillableOrders`. */
  getBillableAppointments(customerId: number, options: BillableListOptions): Promise<ServiceResult>;

  /** One bill, fully enriched (billedOrderDetails, bareProducts, …) — see `loadBill`. */
  getBillById(id: number): Promise<ServiceResult>;
  getBillsByBusiness(
    businessId: number,
    page?: number,
    limit?: number,
    options?: BillListOptions,
  ): Promise<ServiceResult>;
  // Optional (`?`) like the appointment additions: Restaurant is a stub with no Modulex
  // counterpart, so callers guard with `?.()`.
  getBillSummary?(businessId: number): Promise<ServiceResult>;
  updateBillStatus?(id: number, billStatus: string): Promise<ServiceResult>;
  updateBillPayment?(
    id: number,
    paymentStatus: string,
    options?: { paidAmount?: number; refundedAmount?: number },
  ): Promise<ServiceResult>;
  createBill(data: Record<string, unknown>): Promise<ServiceResult>;
  /**
   * ⚠️ Two arguments, unlike every other update on this interface: the bill's id travels in the
   * PATH (`PUT /{module}Bill/{billId}`), not the body. Ordering the arguments the other way round
   * would read like the rest of the file and silently post to the wrong URL.
   */
  updateBill(billId: number, data: Record<string, unknown>): Promise<ServiceResult>;
  deleteBill(id: number): Promise<ServiceResult>;
  getBillsByCustomer(customerId: number): Promise<ServiceResult>;

  // ── Inventory ──────────────────────────────────────────────────────────────
  // There is no `updateInventoryBatch`: batches are immutable and the backend has no PUT. Correct
  // stock via wastage/transfer/consumption, move lifecycle via `updateBatchStatus`, or delete an
  // untouched batch.
  getInventoryBatchesByBusiness(
    businessId: number,
    query?: InventoryQuery,
    page?: number,
    limit?: number,
    append?: boolean,
  ): Promise<ServiceResult>;
  getInventoryStatusCounts(businessId: number, query?: InventoryQuery): Promise<ServiceResult>;
  getInventoryBatchesByProduct(
    itemId: number,
    businessId: number,
    inventoryType?: InventoryType | null,
  ): Promise<ServiceResult>;
  getInventoryBatch(id: number): Promise<ServiceResult>;
  addInventoryBatch(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteInventoryBatch(id: number): Promise<ServiceResult>;
  getAllowedTransitions(id: number): Promise<ServiceResult>;
  updateBatchStatus(
    id: number,
    status: InventoryStatus,
    options?: StatusChangeOptions,
  ): Promise<ServiceResult>;
  disposeBatch(batchId: number): Promise<ServiceResult>;
  getExpiringBatches(businessId: number, withinDays: number): Promise<ServiceResult>;
  getTotalStock(
    itemId: number,
    businessId: number,
    inventoryType?: InventoryType | null,
  ): Promise<ServiceResult>;

  // ─── Consumption ───────────────────────────────────────────────────────────
  // The WORKED EXAMPLE for the three stock-movement features. Four methods and no update: a
  // consumption is immutable, so correcting one means deleting it (which restocks) and re-recording.
  createConsumption(data: ConsumptionPayload): Promise<ServiceResult>;
  /** One consumption, fully hydrated (it carries the FEFO `deductions` ledger). See `readOne`. */
  getConsumption(id: number): Promise<ServiceResult>;
  getConsumptionsByBusiness(
    businessId: number,
    query?: ConsumptionQuery,
    page?: number,
    limit?: number,
  ): Promise<ServiceResult>;
  deleteConsumption(id: number): Promise<ServiceResult>;

  // ─── Wastage ───────────────────────────────────────────────────────────────
  // Four methods and no update, same as consumption: a wastage is immutable, so correcting one
  // means deleting it (which RESTOCKS) and re-recording.
  createWastage(data: WastagePayload): Promise<ServiceResult>;
  /** One wastage, fully hydrated (it carries the `deductions` ledger). See `readOne`. */
  getWastage(id: number): Promise<ServiceResult>;
  getWastageByBusiness(
    businessId: number,
    query?: WastageQuery,
    page?: number,
    limit?: number,
  ): Promise<ServiceResult>;
  deleteWastage(id: number): Promise<ServiceResult>;

  // ─── Expense ───────────────────────────────────────────────────────────────
  //
  // Six methods, not four: an expense moves no stock, so unlike consumption / wastage / stock
  // transfer it is genuinely editable and has a real `updateExpense`. `markExpenseReimbursed` is the
  // only route to a settled expense and surfaces 409 STATE_CONFLICT as a `code` for the screen to
  // branch on, the same way `deleteStockTransfer` surfaces STOCK_MOVEMENT_LOCKED.
  createExpense(data: ExpensePayload): Promise<ServiceResult>;
  getExpense(id: number): Promise<ServiceResult>;
  getExpenseByBusiness(
    businessId: number,
    query?: ExpenseQuery,
    page?: number,
    limit?: number,
  ): Promise<ServiceResult>;
  /** ⚠️ `data.files` must be the FULL list — the server replaces the collection, it does not merge. */
  updateExpense(id: number, data: ExpenseUpdatePayload): Promise<ServiceResult>;
  deleteExpense(id: number): Promise<ServiceResult>;
  markExpenseReimbursed(id: number, reimbursedBy?: number | null): Promise<ServiceResult>;
  getExpenseTotalByCategory(businessId: number, from: string, to: string): Promise<ServiceResult>;

  // ─── Stock Transfer ────────────────────────────────────────────────────────
  // The consumption four, with `StockTransferQuery` in place of `ConsumptionQuery` — note it has no
  // `reason` key, deliberately, because the transfer controller reads no such param.
  createStockTransfer(data: StockTransferPayload): Promise<ServiceResult>;
  /** One transfer, fully hydrated (it carries the FEFO `lines` ledger). See `readOne`. */
  getStockTransfer(id: number): Promise<ServiceResult>;
  getStockTransfersByBusiness(
    businessId: number,
    query?: StockTransferQuery,
    page?: number,
    limit?: number,
  ): Promise<ServiceResult>;
  /** Deleting REVERSES the move. 409 `STOCK_MOVEMENT_LOCKED` once the destination batch is used. */
  deleteStockTransfer(id: number): Promise<ServiceResult>;
}

// ─── Detail-screen reads ─────────────────────────────────────────────────────

/**
 * What every `loadX(id)` hands back. `code` carries the backend's ErrorCode when there is one.
 *
 * `error` is required, and on a failure it is always a sentence — `readOne` ends its chain on the
 * caller's `fallbackMessage`, which every call site passes. That is what lets a detail screen hand
 * it straight to `setLoadError`. While it was optional each screen had to add a
 * `?? 'Could not load this X.'` to satisfy the compiler, and because the hook already had a
 * sentence of its own that arm never ran: the copy someone would go and edit was the one the user
 * never saw, and the developer literal was the one on screen.
 */
interface ReadOneResult {
  success: boolean;
  data?: unknown;
  code?: string;
  error: string | null;
}

/**
 * Fetch ONE record for a detail screen.
 *
 * Every `loadProduct` / `loadService` / `loadOrder` / `loadAppointment` / `loadBill` is this
 * function plus a name. It lives at module scope, outside the hook, precisely because it must not
 * be able to touch state: a detail read must NOT write the resource's shared array or the shared
 * `loading` flag. That is not tidiness — within one screen's hook instance those cells are also
 * written by the create/update/delete calls, so a read that toggled them would race the save it
 * was fetching for, and `loading` is what the list screens' `sawLoadingRef` first-load detector
 * watches, so a spurious true→false would end their skeletons early.
 *
 * The error is dug out of the axios body rather than taken from `err.message`, for the same reason
 * the delete paths do it: a bare "Request failed with status code 404" tells the user nothing.
 *
 * `fallbackMessage` is the screen's own sentence, not a developer label, because it is the one the
 * user reads whenever the server sends no reason. It ends up on screen either way; the only choice
 * is whether it was written for a person.
 *
 * (An earlier version of this note claimed the list and detail screens share one hook instance.
 * They do not — `createModuleHook` returns a plain hook with its own `useState` cells and there is
 * no provider anywhere. Only the service singleton behind it is shared.)
 */
async function readOne(
  fetchOne: () => Promise<ServiceResult>,
  fallbackMessage: string,
): Promise<ReadOneResult> {
  try {
    const response = await fetchOne();
    if (response.success) return { success: true, data: response.data, error: null };
    return { success: false, error: apiMessage(response, fallbackMessage) };
  } catch (err) {
    const { message, code } = extractErrorInfo(err, fallbackMessage);
    return { success: false, code, error: message };
  }
}

// ─── Selected Business ID (async) ────────────────────────────────────────────

export const getSelectedBusinessId = async (): Promise<number | null> => {
  try {
    const selectedBusinessType = await getSelectedBusinessType();
    const selectedBusiness = await getSelectedBusiness();

    if (!selectedBusinessType || !selectedBusiness) {
      return null;
    }

    const businessTypeMap = await getBusinessTypeMap();
    if (!businessTypeMap) return null;

    const businesses = businessTypeMap[selectedBusinessType] || [];
    const business = businesses.find(
      (b: Record<string, unknown>) => b.businessName === selectedBusiness,
    );

    return (business?.id as number) || null;
  } catch {
    return null;
  }
};

// ─── Factory ─────────────────────────────────────────────────────────────────

// `_moduleName` is not read. It stays in the signature because it is what makes the two call sites
// self-describing — `createModuleHook(getParlourService, 'Parlour')` says which module a hook is
// for at a glance, and there is no other label on the returned hook.
export function createModuleHook(getServiceFn: () => ModuleService, _moduleName: string) {
  return () => {
    const [products, setProducts] = useState<unknown[]>([]);
    const [productsTotalPages, setProductsTotalPages] = useState(1);
    const [productMeta, setProductMeta] = useState<ProductListMeta | null>(null);
    const [services, setServices] = useState<unknown[]>([]);
    const [servicesTotalPages, setServicesTotalPages] = useState(1);
    /** Null until a server that sends it answers — never 0, which would read as "no services". */
    const [servicesTotalElements, setServicesTotalElements] = useState<number | null>(null);
    const [employees, setEmployees] = useState<unknown[]>([]);
    const [orders, setOrders] = useState<unknown[]>([]);
    const [ordersTotalPages, setOrdersTotalPages] = useState(1);
    const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
    const [appointments, setAppointments] = useState<unknown[]>([]);
    const [appointmentsTotalPages, setAppointmentsTotalPages] = useState(1);
    const [appointmentDayCounts, setAppointmentDayCounts] = useState<Record<string, number>>({});
    const [bills, setBills] = useState<unknown[]>([]);
    const [billsTotalPages, setBillsTotalPages] = useState(1);
    const [billSummary, setBillSummary] = useState<BillSummary | null>(null);
    const [inventory, setInventory] = useState<unknown[]>([]);
    const [inventoryTotalPages, setInventoryTotalPages] = useState(1);
    /** Null when the server did not report it — never conflate "unknown" with zero. */
    const [inventoryTotal, setInventoryTotal] = useState<number | null>(null);

    // ─── Consumption ─────────────────────────────────────────────────────────
    // Two cells, and DELIBERATELY not a third.
    //
    // There is no `consumptionsTotal`: `/byBusiness` returns `totalPages` and nothing else —
    // `totalElements` is never set on these endpoints — so a row count cannot be derived, and a
    // cell holding one could only ever hold a guess. Inventory has an `inventoryTotal` because its
    // counts endpoint genuinely reports one; these three have no such endpoint. The list subtitles
    // therefore do not claim a count.
    const [consumptions, setConsumptions] = useState<unknown[]>([]);
    const [consumptionsTotalPages, setConsumptionsTotalPages] = useState(1);

    // ─── Wastage ─────────────────────────────────────────────────────────────
    // Two cells, and DELIBERATELY not a third — same reason as consumption: `/byBusiness` reports
    // `totalPages` and no `totalElements`, so a `wastageTotal` could only ever hold a guess. The
    // list subtitle therefore does not claim a record count (and there is no money total either —
    // the endpoint reports no value figure).
    const [wastage, setWastage] = useState<unknown[]>([]);
    const [wastageTotalPages, setWastageTotalPages] = useState(1);

    // ─── Stock Transfer ──────────────────────────────────────────────────────
    // Two cells, and DELIBERATELY not a third — `/byBusiness` reports `totalPages` and nothing
    // else, so there is no row count to hold and the list subtitle does not claim one.
    //
    // ⚠️ `stockTransfers` is a `useState` array, so its identity is stable between renders unless
    // a load actually replaces it. The screen feeds it straight into a `useEffect` dependency;
    // anything that rebuilt the array per render (a `.map()`, a `?? []` fallback on a fresh
    // literal) would re-run that effect, re-setState, and spin the screen until React blanks it.
    const [stockTransfers, setStockTransfers] = useState<unknown[]>([]);
    const [stockTransfersTotalPages, setStockTransfersTotalPages] = useState(1);

    // ─── Expense ─────────────────────────────────────────────────────────────
    // Two cells, and DELIBERATELY not a third — same envelope as the three above: `/byBusiness`
    // reports `totalPages` and no `totalElements`, so an `expensesTotal` could only hold a guess.
    //
    // The list header DOES carry a real ₹ figure, but it does not come from here: it is a separate
    // `totalByCategory` call over a date range, kept out of this slice because it answers a
    // different question (what a month cost) than the rows do (which expenses match the filters).
    // Notably it does NOT narrow with the search box — see `expense.view.ts`.
    const [expenses, setExpenses] = useState<unknown[]>([]);
    const [expensesTotalPages, setExpensesTotalPages] = useState(1);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const service = getServiceFn();
    const dmsService = useMemo(() => new DmsService(), []);

    // ═══════════════════════════════════════════════════════════════
    // Product CRUD
    // ═══════════════════════════════════════════════════════════════

    const loadProducts = useCallback(
      async (page = 1, limit = 10, options: ProductListOptions = {}) => {
        setLoading(true);
        setError(null);
        try {
          const businessId = await getSelectedBusinessId();
          if (!businessId) {
            setError('No business selected. Please select a business first.');
            setProducts([]);
            setLoading(false);
            return;
          }
          const response = await service.getAllProducts(businessId, page, limit, options);
          if (response.success) {
            const data = response.data;
            setProducts(Array.isArray(data) ? data : []);
            setProductsTotalPages(response.totalPages ?? 1);
            // The catalog totals ride on the list response. Only refresh them when the server
            // actually sent them — an older backend omits the field, and blanking the header on
            // every page-2 fetch would make it flicker.
            if (response.meta) setProductMeta(response.meta);
          } else {
            // A server that reports its failure in a 2xx body may fill in neither field, and the
            // `|| null` this replaces cleared the banner while the list below it was emptied. A
            // failed query then rendered as a confirmed empty catalog — the user reads "nothing
            // here" and stops looking. The six list loaders below carry the same fallback.
            setError(apiMessage(response, 'Failed to load products'));
            setProducts([]);
            setProductsTotalPages(1);
          }
        } catch (err) {
          setError(extractErrorMessage(err, 'Failed to load products'));
          setProducts([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // Un-annotated on purpose: a `Promise<ServiceResult>` return type erases the `code` this adds
    // on the error path, and the screen branches on it. Same reason as updateBillStatus.
    const updateProductTracking = useCallback(
      async (id: number, trackInventory: boolean) => {
        try {
          if (!service.updateProductTracking) {
            return { success: false, error: 'Not supported for this module' };
          }
          return await service.updateProductTracking(id, trackInventory);
        } catch (err) {
          const { message, code } = extractErrorInfo(err, "Couldn't update tracking");
          return { success: false, code, error: message };
        }
      },
      [service],
    );

    const createProduct = useCallback(
      async (
        productData: Record<string, unknown>,
        files: NativeFile[] = [],
        parentFolderId: number | null = null,
      ) => {
        setLoading(true);
        setError(null);
        let uploadedDmsFiles: ResourceFileDto[] = [];
        try {
          if (files.length > 0 && parentFolderId) {
            uploadedDmsFiles = await dmsService.uploadMultipleFiles(files, parentFolderId);
            productData = { ...productData, dmsFileIds: uploadedDmsFiles.map((f) => f.id) };
          }
          const response = await service.createProduct(productData);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not save this product.');
        } catch (err) {
          for (const f of uploadedDmsFiles) {
            try {
              await dmsService.deleteFile(f.id!);
            } catch (_) {}
          }
          const message = extractErrorMessage(err, 'Could not save this product.');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service, dmsService],
    );

    const updateProduct = useCallback(
      async (productData: Record<string, unknown>) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.updateProduct(productData);
          if (response.success) return { success: true, data: response.data };
          const message = apiMessage(response, 'Could not save this product.');
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          const message = extractErrorMessage(err, 'Could not save this product.');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const deleteProduct = useCallback(
      async (id: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.deleteProduct(id);
          if (response.success) return { success: true, data: response.data };
          const message = apiMessage(response, 'Could not delete this product.');
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          // Same treatment as deleteService: dig the server's reason out of the axios body rather
          // than reporting "Request failed with status code 409". A product delete is refused when
          // orders or inventory still reference it, and that reason is the whole message.
          const { message, code } = extractErrorInfo(err, 'Could not delete this product.');
          setError(message);
          return { success: false, code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /** Fetch ONE product for the detail screen. Contract and reasoning: see `readOne`. */
    const loadProduct = useCallback(
      (id: number) => readOne(() => service.getProductById(id), 'Could not load this product.'),
      [service],
    );

    /**
     * Ensure the DMS folder for one entity, then hand back its id.
     *
     * The backend owns the folder's name (`{name}_{id}`) and the call is idempotent, so this is
     * also the rename path when a product's name changes. NOT the same thing as
     * `dms/util/EntityFolderUtils.createEntityFolder`, which mints a uuid-named folder under a
     * caller-supplied parent — that is the older frontend-owns-the-name design this replaced.
     */
    const ensureFolder = useCallback(
      async (
        type: 'PRODUCT' | 'SERVICE' | 'EXPENSE',
        params: {
          businessId: number;
          entityId: number;
          entityName?: string;
          currentFolderId?: number | null;
        },
      ) => {
        if (!service.ensureEntityFolder) {
          return { success: false, error: 'Entity folders are not supported for this module' };
        }
        try {
          const response = await service.ensureEntityFolder({ ...params, type });
          if (response.success) return { success: true, data: response.data };
          return {
            success: false,
            error: apiMessage(response, 'Failed to prepare the image folder'),
          };
        } catch (err) {
          const message = extractErrorMessage(err, 'Failed to prepare the image folder');
          return { success: false, error: message };
        }
      },
      [service],
    );

    /** Products and services differ by one discriminator, so they share one body. */
    const ensureProductFolder = useCallback(
      (params: Parameters<typeof ensureFolder>[1]) => ensureFolder('PRODUCT', params),
      [ensureFolder],
    );

    const ensureServiceFolder = useCallback(
      (params: Parameters<typeof ensureFolder>[1]) => ensureFolder('SERVICE', params),
      [ensureFolder],
    );

    /**
     * The receipt folder for one expense.
     *
     * ⚠️ Unlike the two above, `entityName` is IGNORED server-side for this type. Product and
     * service folders are named `{name}_{id}` and follow a rename; an expense folder is the stable
     * `Expense_{id}`, because an expense TITLE is freely edited and the id-keyed form is what keeps
     * `/folder/ensure` idempotent across that. Passing a name here is harmless but pointless.
     */
    const ensureExpenseFolder = useCallback(
      (params: Parameters<typeof ensureFolder>[1]) => ensureFolder('EXPENSE', params),
      [ensureFolder],
    );

    /**
     * The business's products as `{id, name}` options, for the service form's Required Products
     * picker.
     *
     * A read for someone else's screen, so like `loadProduct` it writes no shared state — a picker
     * fetch that failed must not leave an `error` the save path would mistake for its own.
     *
     * One page, deliberately: the list endpoint runs the batched stock enrich, which makes it the
     * expensive call in the catalog, and the picker only needs names. The caller reports the cap
     * to the user rather than paging silently.
     *
     * `error` is on the success return too, and is what lets the four pickers assign it straight
     * into their error state instead of each bolting on a `?? 'Could not load products.'` that the
     * hook's own non-empty message already made unreachable.
     */
    const loadProductOptions = useCallback(
      async (limit = 500) => {
        try {
          const businessId = await getSelectedBusinessId();
          if (!businessId) return { success: false, error: 'No business selected.' };
          const response = await service.getAllProducts(businessId, 1, limit, {});
          if (response.success) {
            return {
              success: true,
              data: Array.isArray(response.data) ? response.data : [],
              totalPages: response.totalPages ?? 1,
              error: null,
            };
          }
          return {
            success: false,
            error: apiMessage(response, 'Could not load products.'),
          };
        } catch (err) {
          const message = extractErrorMessage(err, 'Could not load products.');
          return { success: false, error: message };
        }
      },
      [service],
    );

    // ═══════════════════════════════════════════════════════════════
    // Service CRUD
    // ═══════════════════════════════════════════════════════════════

    /**
     * Fetch ONE service for the detail screen. Contract and reasoning: see `readOne`.
     *
     * Services have no `enrich` step, so this returns exactly what `/viewAll` returns for the same
     * row — the detail screen could be seeded from a tapped list row and skip the loading state
     * entirely. Not done, because a stale row raises a refresh-ordering question this does not.
     */
    const loadService = useCallback(
      (id: number) => readOne(() => service.getServiceById(id), 'Could not load this service.'),
      [service],
    );

    const loadServices = useCallback(
      async (page = 1, limit = 10, options: ServiceListOptions = {}) => {
        setLoading(true);
        setError(null);
        try {
          const businessId = await getSelectedBusinessId();
          if (!businessId) {
            setError('No business selected. Please select a business first.');
            setServices([]);
            setLoading(false);
            return;
          }
          const response = await service.getAllServices(businessId, page, limit, options);
          if (response.success) {
            const data = response.data;
            setServices(Array.isArray(data) ? data : []);
            setServicesTotalPages(response.totalPages ?? 1);
            // Only when the server actually sent it. An older backend omits the field, and
            // blanking the count on every page-2 fetch would make the header flicker.
            if (response.totalElements != null) setServicesTotalElements(response.totalElements);
          } else {
            setError(apiMessage(response, 'Failed to load services'));
            setServices([]);
            setServicesTotalPages(1);
          }
        } catch (err) {
          setError(extractErrorMessage(err, 'Failed to load services'));
          setServices([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const createService = useCallback(
      async (
        serviceData: Record<string, unknown>,
        files: NativeFile[] = [],
        parentFolderId: number | null = null,
      ) => {
        setLoading(true);
        setError(null);
        let uploadedDmsFiles: ResourceFileDto[] = [];
        try {
          if (files.length > 0 && parentFolderId) {
            uploadedDmsFiles = await dmsService.uploadMultipleFiles(files, parentFolderId);
            serviceData = { ...serviceData, dmsFileIds: uploadedDmsFiles.map((f) => f.id) };
          }
          const response = await service.createService(serviceData);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not save this service.');
        } catch (err) {
          for (const f of uploadedDmsFiles) {
            try {
              await dmsService.deleteFile(f.id!);
            } catch (_) {}
          }
          const message = extractErrorMessage(err, 'Could not save this service.');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service, dmsService],
    );

    const updateService = useCallback(
      async (serviceData: Record<string, unknown>) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.updateService(serviceData);
          if (response.success) return { success: true, data: response.data };
          const message = apiMessage(response, 'Could not save this service.');
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          const message = extractErrorMessage(err, 'Could not save this service.');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // Un-annotated on purpose: a `Promise<ServiceResult>` return type erases the `code` this adds
    // on the error path, and the screen branches on it. Same reason as updateProductTracking.
    const updateServiceAvailability = useCallback(
      async (id: number, availability: boolean) => {
        try {
          if (!service.updateServiceAvailability) {
            return { success: false, error: 'Not supported for this module' };
          }
          return await service.updateServiceAvailability(id, availability);
        } catch (err) {
          const { message, code } = extractErrorInfo(err, "Couldn't update availability");
          return { success: false, code, error: message };
        }
      },
      [service],
    );

    const deleteService = useCallback(
      async (id: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.deleteService(id);
          if (response.success) return { success: true, data: response.data };
          const message = apiMessage(response, 'Could not delete this service.');
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          // Dig the server's reason out of the axios body rather than reporting "Request failed
          // with status code 409". A service delete is routinely refused because appointments,
          // packages or bills still reference it, and that reason is the whole message.
          const { message, code } = extractErrorInfo(err, 'Could not delete this service.');
          setError(message);
          return { success: false, code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // ═══════════════════════════════════════════════════════════════
    // Customer & Employee
    // ═══════════════════════════════════════════════════════════════

    // `loadCustomers` used to live here. It called `/persons/viewAll` — unscoped, unpaginated,
    // every Person the caller can see — wrote the result into a shared `customers` cell, and was
    // consumed by nothing. The customer picker that finally needed a customer list wants a
    // business-scoped, paged, searchable one, which is a Person concern rather than a module one,
    // so it calls PersonService directly. Removed rather than left as a trap for the next caller.

    const loadEmployees = useCallback(async () => {
      setEmployees([]);
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // Order CRUD
    // ═══════════════════════════════════════════════════════════════

    /** Fetch ONE order for the detail screen. Contract and reasoning: see `readOne`. */
    const loadOrder = useCallback(
      (id: number) => readOne(() => service.getOrderById(id), 'Could not load this order.'),
      [service],
    );

    /**
     * One customer's unbilled orders, for the bill's Add-items picker.
     *
     * Writes no shared state, same rule as the detail reads — the bill screen owns this list and
     * pages it itself. `businessId` is resolved here rather than by the caller, matching
     * `loadProductOptions`.
     *
     * Pass the bill's own `billId` when EDITING: the orders already on that bill are
     * `isBilled = true` and would otherwise be filtered out of their own picker, so the user could
     * not see or un-tick the lines they are looking at.
     */
    const loadBillableOrders = useCallback(
      async (customerId: number, options: Omit<BillableListOptions, 'businessId'> = {}) => {
        const businessId = await getSelectedBusinessId();
        if (businessId == null) return { success: false, error: 'No business is selected.' };
        return readOne(
          () => service.getBillableOrders(customerId, { ...options, businessId }),
          'Could not load orders.',
        );
      },
      [service],
    );

    const loadOrders = useCallback(
      async (page = 1, limit = 10, options: OrderListOptions = {}) => {
        setLoading(true);
        setError(null);
        try {
          const businessId = await getSelectedBusinessId();
          if (!businessId) {
            setError('No business selected. Please select a business first.');
            setOrders([]);
            setLoading(false);
            return;
          }
          const response = await service.getAllOrders(businessId, page, limit, options);
          if (response.success) {
            const data = response.data;
            setOrders(Array.isArray(data) ? data : []);
            setOrdersTotalPages(response.totalPages ?? 1);
          } else {
            setError(apiMessage(response, 'Failed to load orders'));
            setOrders([]);
            setOrdersTotalPages(1);
          }
        } catch (err) {
          setError(extractErrorMessage(err, 'Failed to load orders'));
          setOrders([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /**
     * Orders V2 status-chip counts, optionally scoped to the same date window as the list.
     * Best-effort: it never toggles `loading` or sets `error` (the list is the primary content),
     * and it no-ops to `null` for modules without a summary endpoint (e.g. Restaurant) or on any
     * failure, so a missing/404 summary never blocks the screen.
     */
    const loadOrderSummary = useCallback(
      async (options: { fromDate?: string; toDate?: string } = {}) => {
        try {
          const businessId = await getSelectedBusinessId();
          if (!businessId || !service.getOrderSummary) {
            setOrderSummary(null);
            return;
          }
          const response = await service.getOrderSummary(businessId, options);
          setOrderSummary(response.success && response.data ? response.data : null);
        } catch {
          setOrderSummary(null);
        }
      },
      [service],
    );

    /**
     * Orders V2 Quick Actions: change only an order's status. The backend cascades item statuses,
     * reconciles inventory and writes the audit row, so the caller just refetches.
     *
     * Returns `{success, error, code}`. `code` carries the backend's ErrorCode — notably
     * `ORDER_LOCKED` (HTTP 409) when the order sits on a finalized bill, which the screen shows as
     * the "Couldn't cancel order" dialog rather than a generic failure.
     */
    const updateOrderStatus = useCallback(
      async (orderId: number, status: string, reason?: string) => {
        setLoading(true);
        setError(null);
        try {
          if (!service.updateOrderStatus) {
            const message = 'Changing order status is not supported for this module';
            setError(message);
            return { success: false, error: message };
          }
          const response = await service.updateOrderStatus(orderId, status, { reason });
          if (response.success) return { success: true, data: response.data };
          const message = apiMessage(response, 'Failed to update order status');
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          // Axios error → pull the wrapper out of the 409/400 body so callers can branch on `code`.
          // `data` is still read off the body by hand: it carries the ORDER_LOCKED dialog's payload,
          // which the shared extractor deliberately does not return.
          const body = (err as any)?.response?.data;
          const { message, code } = extractErrorInfo(err, 'Failed to update order status');
          setError(message);
          return { success: false, error: message, code, data: body?.data };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const createOrder = useCallback(
      async (
        orderData: Record<string, unknown>,
        files: NativeFile[] = [],
        parentFolderId: number | null = null,
      ) => {
        setLoading(true);
        setError(null);
        let dmsFolderId: number | null = null;
        let uploadedDmsFiles: ResourceFileDto[] = [];
        try {
          if (parentFolderId) {
            dmsFolderId = await createEntityFolder({ parentFolderId });
            orderData = { ...orderData, dmsFolderId };
          }
          if (files.length > 0) {
            uploadedDmsFiles = await dmsService.uploadMultipleFiles(
              files,
              dmsFolderId || parentFolderId!,
            );
            orderData = { ...orderData, dmsFileIds: uploadedDmsFiles.map((f) => f.id) };
          }
          const response = await service.createOrder(orderData);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not save this order.');
        } catch (err) {
          for (const f of uploadedDmsFiles) {
            try {
              await dmsService.deleteFile(f.id!);
            } catch (_) {}
          }
          const message = extractErrorMessage(err, 'Could not save this order.');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service, dmsService],
    );

    const updateOrder = useCallback(
      async (orderData: Record<string, unknown>) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.updateOrder(orderData);
          if (response.success) return { success: true, data: response.data };
          const message = apiMessage(response, 'Could not save this order.');
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          const message = extractErrorMessage(err, 'Could not save this order.');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const deleteOrder = useCallback(
      async (id: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.deleteOrder(id);
          if (response.success) return { success: true, data: response.data };
          const message = apiMessage(response, 'Could not delete this order.');
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          const message = extractErrorMessage(err, 'Could not delete this order.');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const loadOrdersByCustomer = useCallback(
      async (customerId: number, options: Record<string, unknown> = {}) => {
        setLoading(true);
        setError(null);
        try {
          if (!customerId) {
            setError('Customer ID is required');
            setOrders([]);
            setLoading(false);
            return;
          }
          const response = await service.getOrdersByCustomer(customerId, options);
          if (response.success) {
            const data = response.data;
            setOrders(Array.isArray(data) ? data : []);
          } else {
            setError(apiMessage(response, 'Failed to load orders for customer'));
            setOrders([]);
          }
        } catch (err) {
          setError(extractErrorMessage(err, 'Failed to load orders for customer'));
          setOrders([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // ═══════════════════════════════════════════════════════════════
    // Appointment CRUD
    // ═══════════════════════════════════════════════════════════════

    /** Fetch ONE appointment for the detail screen. Contract and reasoning: see `readOne`. */
    const loadAppointment = useCallback(
      (id: number) =>
        readOne(() => service.getAppointmentById(id), 'Could not load this appointment.'),
      [service],
    );

    /**
     * Complete ONE service on an appointment.
     *
     * Its own endpoint rather than a full PUT, because the server owns the roll-up: completing the
     * last outstanding item may also complete the appointment, and that decision is not the
     * client's to make.
     *
     * ⚠️ The response sometimes comes back with an empty item list — the web portal hit this and
     * falls back to a re-fetch. Callers must handle a bare DTO rather than trusting it.
     */
    const completeAppointmentItem = useCallback(
      (appointmentId: number, itemId: string) =>
        readOne(
          () => service.completeAppointmentItem(appointmentId, itemId),
          'Could not mark that service completed.',
        ),
      [service],
    );

    /** One customer's unbilled appointments. Same contract as `loadBillableOrders`. */
    const loadBillableAppointments = useCallback(
      async (customerId: number, options: Omit<BillableListOptions, 'businessId'> = {}) => {
        const businessId = await getSelectedBusinessId();
        if (businessId == null) return { success: false, error: 'No business is selected.' };
        return readOne(
          () => service.getBillableAppointments(customerId, { ...options, businessId }),
          'Could not load appointments.',
        );
      },
      [service],
    );

    const loadAppointments = useCallback(
      async (page = 1, limit = 10, options: AppointmentListOptions = {}) => {
        setLoading(true);
        setError(null);
        try {
          const businessId = await getSelectedBusinessId();
          if (!businessId) {
            setError('No business selected. Please select a business first.');
            setAppointments([]);
            setLoading(false);
            return;
          }
          const response = await service.getAllAppointments(businessId, page, limit, options);
          if (response.success) {
            const data = response.data;
            setAppointments(Array.isArray(data) ? data : []);
            // Captured so the screen can page — this used to be dropped, which capped the list at
            // whatever the first request returned.
            setAppointmentsTotalPages(response.totalPages ?? 1);
          } else {
            setError(apiMessage(response, 'Failed to load appointments'));
            setAppointments([]);
          }
        } catch (err) {
          setError(extractErrorMessage(err, 'Failed to load appointments'));
          setAppointments([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /**
     * Fetch ONE page of appointments and RETURN it, touching no shared state.
     *
     * `loadAppointments` above writes `appointments`, `appointmentsTotalPages`, `loading` and
     * `error` — one array, one page counter, one flag. That is exactly right for a list showing
     * one query, and unusable for the Appointments screen's all-dates mode, which holds TWO
     * independently-paged buckets (the future, and today-and-the-past) and concatenates them. Run
     * through `loadAppointments` the two would overwrite each other's rows and each other's
     * `totalPages`, and their two `loading` transitions would race the first-load detector that
     * `sawLoadingRef` builds out of them — the same reason `readOne` is kept off these cells.
     *
     * So this returns instead of storing, and the caller owns the bucket. Same envelope handling
     * as `loadAppointments`: refusals arrive as HTTP 200 with `success: false`, so the message has
     * to come through `apiMessage`/`extractErrorMessage` rather than out of the body by hand.
     */
    const fetchAppointmentsPage = useCallback(
      async (
        page: number,
        limit: number,
        options: AppointmentListOptions = {},
      ): Promise<AppointmentPage> => {
        const empty = { success: false, rows: [], totalPages: 1 };
        try {
          const businessId = await getSelectedBusinessId();
          if (!businessId) {
            return { ...empty, error: 'No business selected. Please select a business first.' };
          }
          const response = await service.getAllAppointments(businessId, page, limit, options);
          if (!response.success) {
            return { ...empty, error: apiMessage(response, 'Failed to load appointments') };
          }
          const data = response.data;
          return {
            success: true,
            rows: Array.isArray(data) ? data : [],
            totalPages: response.totalPages ?? 1,
            error: null,
          };
        } catch (err) {
          return { ...empty, error: extractErrorMessage(err, 'Failed to load appointments') };
        }
      },
      [service],
    );

    /**
     * Per-day counts for the week strip / month grid dots.
     *
     * Best-effort, exactly like loadOrderSummary: never toggles `loading`, never sets `error`, and
     * no-ops for modules without the endpoint or on any failure. The dots are decoration — a 500
     * here must not take the screen down.
     *
     * Replaces WITHIN the requested window, keeps everything outside it.
     *
     * Not a plain `{...prev, ...next}` merge, and the difference is a real bug rather than a
     * nicety: the server OMITS zero-count days from `counts` entirely, so a day that emptied out
     * simply stops appearing in the response. A merge only ever adds or overwrites keys, so that
     * day's old count survives in `prev` forever and its dot stays on the strip — after deleting
     * the only appointment on a day, the dot outlived the appointment until a full remount.
     *
     * Not a wholesale replace either: switching Day↔Calendar or paging months fetches a different
     * window, and blanking the map would drop every dot outside it for a frame. Dropping just the
     * requested range and re-filling it from the response gets both. Plain string comparison is
     * safe on YYYY-MM-DD.
     */
    const loadAppointmentDayCounts = useCallback(
      async (options: { fromDate: string; toDate: string }) => {
        try {
          const businessId = await getSelectedBusinessId();
          if (!businessId || !service.getAppointmentDayCounts) return;
          const response = await service.getAppointmentDayCounts(businessId, options);
          if (response.success && response.data?.counts) {
            const next = response.data.counts;
            setAppointmentDayCounts((prev) => {
              const outsideWindow = Object.fromEntries(
                Object.entries(prev).filter(
                  ([day]) => day < options.fromDate || day > options.toDate,
                ),
              );
              return { ...outsideWindow, ...next };
            });
          }
        } catch {
          // Swallowed on purpose — see the note above.
        }
      },
      [service],
    );

    /**
     * Quick Actions: change only an appointment's status. The backend cascades item statuses and,
     * on CANCELLED, releases the package slots redeemed from the linked order.
     *
     * Returns `{success, error, code}`. `code` carries `APPOINTMENT_LOCKED` (HTTP 409) when the
     * appointment sits on a finalized bill, which the screen reports as a specific toast rather
     * than a generic failure.
     */
    const updateAppointmentStatus = useCallback(
      async (appointmentId: number, status: string, reason?: string) => {
        setLoading(true);
        setError(null);
        try {
          if (!service.updateAppointmentStatus) {
            const message = 'Changing appointment status is not supported for this module';
            setError(message);
            return { success: false, error: message };
          }
          const response = await service.updateAppointmentStatus(appointmentId, status, { reason });
          if (response.success) return { success: true, data: response.data };
          const message = apiMessage(response, 'Failed to update appointment status');
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          const body = (err as any)?.response?.data;
          const { message, code } = extractErrorInfo(err, 'Failed to update appointment status');
          setError(message);
          return { success: false, error: message, code, data: body?.data };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /**
     * Move an appointment to a new date/time. `appointmentDateTime` is a zone-less IST wall clock
     * ("2025-04-24T14:30:00") — the same format create/update use. Never pass an ISO instant.
     */
    const rescheduleAppointment = useCallback(
      async (appointmentId: number, appointmentDateTime: string, reason?: string) => {
        setLoading(true);
        setError(null);
        try {
          if (!service.rescheduleAppointment) {
            const message = 'Rescheduling is not supported for this module';
            setError(message);
            return { success: false, error: message };
          }
          const response = await service.rescheduleAppointment(appointmentId, appointmentDateTime, {
            reason,
          });
          if (response.success) return { success: true, data: response.data };
          const message = apiMessage(response, 'Failed to reschedule appointment');
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          const body = (err as any)?.response?.data;
          const { message, code } = extractErrorInfo(err, 'Failed to reschedule appointment');
          setError(message);
          return { success: false, error: message, code, data: body?.data };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const createAppointment = useCallback(
      async (
        appointmentData: Record<string, unknown>,
        files: NativeFile[] = [],
        parentFolderId: number | null = null,
      ) => {
        setLoading(true);
        setError(null);
        let uploadedDmsFiles: ResourceFileDto[] = [];
        try {
          if (files.length > 0 && parentFolderId) {
            uploadedDmsFiles = await dmsService.uploadMultipleFiles(files, parentFolderId);
            appointmentData = { ...appointmentData, dmsFileIds: uploadedDmsFiles.map((f) => f.id) };
          }
          const response = await service.createAppointment(appointmentData);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not save this appointment.');
        } catch (err) {
          for (const f of uploadedDmsFiles) {
            try {
              await dmsService.deleteFile(f.id!);
            } catch (_) {}
          }
          const message = extractErrorMessage(err, 'Could not save this appointment.');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service, dmsService],
    );

    const updateAppointment = useCallback(
      async (appointmentData: Record<string, unknown>) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.updateAppointment(appointmentData);
          if (response.success) return { success: true, data: response.data };
          const message = apiMessage(response, 'Could not save this appointment.');
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          const message = extractErrorMessage(err, 'Could not save this appointment.');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const deleteAppointment = useCallback(
      async (id: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.deleteAppointment(id);
          if (response.success) return { success: true, data: response.data };
          const message = apiMessage(response, 'Could not delete this appointment.');
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          const message = extractErrorMessage(err, 'Could not delete this appointment.');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const loadAppointmentsByCustomer = useCallback(
      async (customerId: number, options: Record<string, unknown> = {}) => {
        setLoading(true);
        setError(null);
        try {
          if (!customerId) {
            setError('Customer ID is required');
            setAppointments([]);
            setLoading(false);
            return;
          }
          const response = await service.getAppointmentsByCustomer(customerId, options);
          if (response.success) {
            const data = response.data;
            setAppointments(Array.isArray(data) ? data : []);
          } else {
            setError(apiMessage(response, 'Failed to load appointments for customer'));
            setAppointments([]);
          }
        } catch (err) {
          setError(extractErrorMessage(err, 'Failed to load appointments for customer'));
          setAppointments([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // ═══════════════════════════════════════════════════════════════
    // Bills
    // ═══════════════════════════════════════════════════════════════

    /**
     * Fetch ONE bill for the detail screen. Contract and reasoning: see `readOne`.
     *
     * Unlike the other four, this response is genuinely richer than its list row: the backend
     * enriches it with `billedOrderDetails`, `billedAppointmentDetails`, `bareProducts` and
     * `bareServices`, none of which `/business/{id}` returns. The detail screen cannot be seeded
     * from a tapped row.
     */
    const loadBill = useCallback(
      (id: number) => readOne(() => service.getBillById(id), 'Could not load this bill.'),
      [service],
    );

    const loadBills = useCallback(
      async (page = 1, limit = 20, options: BillListOptions = {}) => {
        setLoading(true);
        setError(null);
        try {
          const businessId = await getSelectedBusinessId();
          if (!businessId) {
            setError('No business selected. Please select a business first.');
            setBills([]);
            setLoading(false);
            return;
          }
          const response = await service.getBillsByBusiness(businessId, page, limit, options);
          if (response.success) {
            const data = response.data;
            setBills(Array.isArray(data) ? data : []);
            // Captured for infinite scroll — the previous signature dropped it entirely, so the
            // list had no way to know whether another page existed.
            setBillsTotalPages((response as { totalPages?: number }).totalPages || 1);
          } else {
            setError(apiMessage(response, 'Failed to load bills'));
            setBills([]);
          }
        } catch (err) {
          setError(extractErrorMessage(err, 'Failed to load bills'));
          setBills([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /**
     * The header line, the status chips and the wallet card.
     *
     * Same contract as loadOrderSummary: never toggles `loading`, never sets `error`, no-ops on
     * failure. These are decoration on top of the list — a 500 here must not take the screen down
     * or blank a list that loaded perfectly well.
     */
    const loadBillSummary = useCallback(async () => {
      try {
        const businessId = await getSelectedBusinessId();
        if (!businessId || !service.getBillSummary) return;
        const response = await service.getBillSummary(businessId);
        if (response.success && response.data) {
          setBillSummary(response.data as BillSummary);
        }
      } catch {
        // Decoration only — leave the last-good summary in place.
      }
    }, [service]);

    // No explicit return annotation, matching updateOrderStatus: the union has to carry `code`,
    // which the strict ServiceResult shape does not declare.
    const updateBillStatus = useCallback(
      async (id: number, billStatus: string) => {
        try {
          if (!service.updateBillStatus) {
            return { success: false, error: 'Not supported for this module' };
          }
          // A refusal does not always arrive as a rejected request — the server also answers
          // 2xx with a body reporting the failure, and that body often fills `message` and
          // leaves `error` empty. As a bare passthrough this handed BillDetailScreen
          // `error: undefined`, where the `if (!result.success && result.error)` guard says
          // nothing at all: a refused bill save or delete looked exactly like one that worked.
          // The other four bill writes below carry the same fallback for the same reason.
          //
          // Spread rather than rebuilt, so the server's `code` survives — BillingScreen reads
          // STATE_CONFLICT off it to explain why a cancelled bill cannot go back to draft.
          const response = await service.updateBillStatus(id, billStatus);
          if (response.success) return response;
          return {
            ...response,
            error: apiMessage(response, 'Failed to update bill status'),
          };
        } catch (err) {
          // Dig the server's `code` out of the axios error — the screen branches on it to tell a
          // state conflict (409) apart from a generic failure.
          const { message, code } = extractErrorInfo(err, 'Failed to update bill status');
          return { success: false, code, error: message };
        }
      },
      [service],
    );

    const updateBillPayment = useCallback(
      async (
        id: number,
        paymentStatus: string,
        options: { paidAmount?: number; refundedAmount?: number } = {},
      ) => {
        try {
          if (!service.updateBillPayment) {
            return { success: false, error: 'Not supported for this module' };
          }
          const response = await service.updateBillPayment(id, paymentStatus, options);
          if (response.success) return response;
          return {
            ...response,
            error: apiMessage(response, 'Failed to update bill payment'),
          };
        } catch (err) {
          const { message, code } = extractErrorInfo(err, 'Failed to update bill payment');
          return { success: false, code, error: message };
        }
      },
      [service],
    );

    const createBill = useCallback(
      async (data: Record<string, unknown>) => {
        try {
          const response = await service.createBill(data);
          if (response.success) return response;
          return {
            ...response,
            error: apiMessage(response, 'Could not create this bill.'),
          };
        } catch (err) {
          const { message, code } = extractErrorInfo(err, 'Could not create this bill.');
          return { success: false, code, error: message };
        }
      },
      [service],
    );

    /**
     * ⚠️ `billId` first, THEN the body — the bill's id travels in the path
     * (`PUT /{module}Bill/{billId}`), unlike every other update in this hook, which carries it in
     * the body. Getting the argument order wrong here is a silent 404 or a write to the wrong bill.
     *
     * And a warning about what this endpoint does with what you send it: the update is a full
     * destructive replace. Omitting `billedOrders` releases every linked order; omitting
     * `customProducts` deletes the bare lines AND restocks their inventory; omitting `tips`,
     * `discount` or `taxRate` zeroes them. The payload must be rebuilt from the fetched bill, not
     * assembled from whatever the form happens to hold. For a status-only or payment-only change,
     * use `updateBillStatus` / `updateBillPayment` instead — `billStatus: 'CANCELLED'` in a PUT
     * body is a cascade trigger, not a label.
     */
    const updateBill = useCallback(
      async (billId: number, data: Record<string, unknown>) => {
        try {
          const response = await service.updateBill(billId, data);
          if (response.success) return response;
          return {
            ...response,
            error: apiMessage(response, 'Could not save this bill.'),
          };
        } catch (err) {
          const { message, code } = extractErrorInfo(err, 'Could not save this bill.');
          return { success: false, code, error: message };
        }
      },
      [service],
    );

    /**
     * Deleting a bill cascades server-side: auto-generated orders and appointments are deleted,
     * pre-existing ones are un-marked and released back into the billable pickers, and bare lines
     * are restocked. No bill status blocks it.
     */
    const deleteBill = useCallback(
      async (id: number) => {
        try {
          const response = await service.deleteBill(id);
          if (response.success) return response;
          return {
            ...response,
            error: apiMessage(response, 'Could not delete this bill.'),
          };
        } catch (err) {
          const { message, code } = extractErrorInfo(err, 'Could not delete this bill.');
          return { success: false, code, error: message };
        }
      },
      [service],
    );

    /**
     * The DMS folder for one Quick Add line on one bill.
     *
     * Not `ensureFolder` with a fourth discriminator: that one keys on a single entity id, and a
     * quick-add line is keyed by a bill id AND a client-minted `lineId` uuid — it has no entity of
     * its own. The backend names it `{itemName}_{lineId}` and ensures the `Bill_{billId}` parent.
     */
    const ensureBillItemFolder = useCallback(
      async (params: {
        businessId: number;
        billId: number;
        lineId: string;
        itemName?: string;
        currentFolderId?: number | null;
      }) => {
        if (!service.ensureBillItemFolder) {
          return { success: false, error: 'Bill item folders are not supported for this module' };
        }
        try {
          const response = await service.ensureBillItemFolder(params);
          if (response.success) return { success: true, data: response.data };
          return {
            success: false,
            error: apiMessage(response, 'Failed to prepare the photo folder'),
          };
        } catch (err) {
          const message = extractErrorMessage(err, 'Failed to prepare the photo folder');
          return { success: false, error: message };
        }
      },
      [service],
    );

    /**
     * Link uploaded photos to a saved bill's quick-add lines.
     *
     * ⚠️ Never reach for `updateBill` to do this. The PUT rebuilds the bill: it mints a second
     * auto-generated order for any order-required line and orphans the first, and it reprices and
     * restocks every bare line. This endpoint records the file ids and nothing else.
     */
    const attachQuickItemPhotos = useCallback(
      async (
        billId: number,
        links: Array<{ lineId: string; dmsFolderId: number; photos: unknown[] }>,
      ) => {
        if (!service.attachQuickItemPhotos) {
          return { success: false, error: 'Not supported for this module' };
        }
        try {
          return await service.attachQuickItemPhotos(billId, links);
        } catch (err) {
          const { message, code } = extractErrorInfo(err, 'Failed to attach the photos');
          return { success: false, code, error: message };
        }
      },
      [service],
    );

    // ═══════════════════════════════════════════════════════════════
    // Inventory CRUD
    // ═══════════════════════════════════════════════════════════════

    /**
     * One page of batches.
     *
     * `append` grows the list for infinite scroll. A failed append deliberately leaves the existing
     * rows alone — blanking what the user is already reading because page 4 timed out is worse than
     * simply not growing.
     *
     * The caller must pass the SAME `query` on every page or the pages will not line up: the server
     * filters and sorts, so page 2 of a different query is not the continuation of page 1.
     */
    const loadInventoryByBusiness = useCallback(
      async (
        businessId: number,
        query: InventoryQuery = {},
        page = 1,
        limit = 20,
        append = false,
      ) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.getInventoryBatchesByBusiness(
            businessId,
            query,
            page,
            limit,
          );
          if (response.success) {
            const rows = Array.isArray(response.data) ? response.data : [];
            setInventory((prev) => (append ? [...prev, ...rows] : rows));
            setInventoryTotalPages(response.totalPages ?? 1);
            // `totalElements` is what the "N batches" subtitle reads. Null rather than 0 when the
            // server omits it, so the UI can tell "none" from "not reported".
            setInventoryTotal(
              typeof response.totalElements === 'number' ? response.totalElements : null,
            );
            return { success: true, data: rows };
          }
          const message = apiMessage(response, 'Failed to load inventory');
          setError(message);
          if (!append) setInventory([]);
          return { success: false, error: message };
        } catch (err) {
          const message = extractErrorMessage(err, 'Failed to load inventory');
          setError(message);
          if (!append) setInventory([]);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /**
     * Batch counts per status, for the list's filter chips.
     *
     * Deliberately does NOT touch `loading` — it rides alongside the list load, and letting it flip
     * the shared flag makes the whole screen flash a spinner when only the chips changed.
     */
    const getInventoryStatusCounts = useCallback(
      async (businessId: number, query: InventoryQuery = {}) => {
        try {
          const response = await service.getInventoryStatusCounts(businessId, query);
          if (response.success) {
            return { success: true, data: response.data, totalElements: response.totalElements };
          }
          return {
            success: false,
            error: apiMessage(response, 'Failed to load counts'),
          };
        } catch (err) {
          return { success: false, error: extractErrorMessage(err, 'Failed to load counts') };
        }
      },
      [service],
    );

    const loadInventoryByProduct = useCallback(
      async (itemId: number, businessId: number, inventoryType?: InventoryType | null) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.getInventoryBatchesByProduct(
            itemId,
            businessId,
            inventoryType,
          );
          if (response.success) return { success: true, data: response.data };
          const message = apiMessage(response, 'Failed to load inventory by product');
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          const message = extractErrorMessage(err, 'Failed to load inventory by product');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /** Fetch ONE batch for the detail screen. Contract and reasoning: see `readOne`. */
    const loadInventoryBatch = useCallback(
      (id: number) => readOne(() => service.getInventoryBatch(id), 'Could not load this batch.'),
      [service],
    );

    /**
     * The moves THIS batch may make, already narrowed by the server's state guards.
     *
     * Never cached: the answer depends on the batch's live remaining quantity and expiry, not just
     * its status. An ACTIVE batch that is past expiry matches ACTIVE → {ON_HOLD, QUARANTINED} in
     * the raw matrix, yet the server refuses both — which is exactly why the client must ask about
     * the batch rather than derive from a status.
     */
    const getAllowedTransitions = useCallback(
      async (id: number) => {
        try {
          const response = await service.getAllowedTransitions(id);
          if (response.success) {
            return { success: true, data: Array.isArray(response.data) ? response.data : [] };
          }
          return {
            success: false,
            error: apiMessage(response, 'Failed to load transitions'),
          };
        } catch (err) {
          return { success: false, error: extractErrorMessage(err, 'Failed to load transitions') };
        }
      },
      [service],
    );

    const disposeBatch = useCallback(
      async (batchId: number) => {
        try {
          const response = await service.disposeBatch(batchId);
          if (response.success) return { success: true, data: response.data };
          return {
            success: false,
            error: apiMessage(response, 'Could not dispose this batch'),
          };
        } catch (err) {
          return {
            success: false,
            error: extractErrorMessage(err, 'Could not dispose this batch'),
          };
        }
      },
      [service],
    );

    const addInventoryBatch = useCallback(
      async (batchData: Record<string, unknown>) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.addInventoryBatch(batchData);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not save this batch.');
        } catch (err) {
          const message = extractErrorMessage(err, 'Could not save this batch.');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // No `updateInventoryBatch` — batches are immutable and the backend has no PUT. A stray one
    // used to live here and could only ever 404.

    const deleteInventoryBatch = useCallback(
      async (id: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.deleteInventoryBatch(id);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not delete this batch.');
        } catch (err) {
          const message = extractErrorMessage(err, 'Could not delete this batch.');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /**
     * Move a batch's lifecycle status.
     *
     * A refusal comes back as a 400 `INVALID_STATUS_TRANSITION` and is surfaced as-is — it means
     * the batch's live state disallows the move (delivered to zero stock, or already past expiry),
     * not that the request was malformed, and a retry cannot help.
     */
    const updateBatchStatus = useCallback(
      async (id: number, status: InventoryStatus, options: StatusChangeOptions = {}) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.updateBatchStatus(id, status, options);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not change the status');
        } catch (err) {
          const message = extractErrorMessage(err, 'Could not change the status');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const getExpiringBatches = useCallback(
      async (businessId: number, withinDays = 30) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.getExpiringBatches(businessId, withinDays);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Failed to fetch expiring batches');
        } catch (err) {
          const message = extractErrorMessage(err, 'Failed to fetch expiring batches');
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const getTotalStock = useCallback(
      async (itemId: number, businessId: number, inventoryType?: InventoryType | null) => {
        try {
          const response = await service.getTotalStock(itemId, businessId, inventoryType);
          if (response.success) return { success: true, data: response.data };
          return {
            success: false,
            error: apiMessage(response, 'Failed to load stock'),
          };
        } catch (err) {
          // The one catch here that carried no fallback at all: anything thrown with a blank
          // `message` came back as `error: undefined`, and the stock line showed nothing at all.
          return { success: false, error: extractErrorMessage(err, 'Failed to load stock') };
        }
      },
      [service],
    );

    // ═══════════════════════════════════════════════════════════════
    // Stock movements — Consumption · Wastage · Stock Transfer
    // ═══════════════════════════════════════════════════════════════

    // ─── Consumption ─────────────────────────────────────────────────────────
    //
    // The WORKED EXAMPLE the other two regions copy. Four callbacks, matching the shapes already
    // used elsewhere in this file rather than inventing new ones:
    //
    //   • the LIST writes shared state and takes `append`, like `loadInventoryByBusiness`
    //   • the DETAIL read goes through `readOne` and writes NOTHING, like `loadProduct`
    //
    // That second rule is not tidiness — see the note on `readOne`. A detail read that touched the
    // shared array would race the save it was fetching for, and one that touched `loading` would
    // end the list screen's skeleton early, because `sawLoadingRef` watches exactly that flag.

    /**
     * One page of consumptions.
     *
     * `append` grows the list for infinite scroll. A failed append deliberately leaves the existing
     * rows alone — blanking what the user is already reading because page 4 timed out is worse than
     * simply not growing.
     *
     * The caller must pass the SAME `query` on every page: the server filters and sorts, so page 2
     * of a different query is not the continuation of page 1.
     *
     * Only `totalPages` is captured. There is no row count to capture — see the state cells.
     */
    const loadConsumptionsByBusiness = useCallback(
      async (
        businessId: number,
        query: ConsumptionQuery = {},
        page = 1,
        limit = 20,
        append = false,
      ) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.getConsumptionsByBusiness(businessId, query, page, limit);
          if (response.success) {
            const rows = Array.isArray(response.data) ? response.data : [];
            setConsumptions((prev) => (append ? [...prev, ...rows] : rows));
            setConsumptionsTotalPages(response.totalPages ?? 1);
            return { success: true, data: rows };
          }
          const message = apiMessage(response, 'Failed to load consumptions');
          setError(message);
          if (!append) setConsumptions([]);
          return { success: false, error: message };
        } catch (err) {
          const message = extractErrorMessage(err, 'Failed to load consumptions');
          setError(message);
          if (!append) setConsumptions([]);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /** Fetch ONE consumption for the detail screen. Contract and reasoning: see `readOne`. */
    const loadConsumption = useCallback(
      (id: number) => readOne(() => service.getConsumption(id), 'Could not load this consumption.'),
      [service],
    );

    /**
     * Record a consumption.
     *
     * The service layer throws BEFORE the request on a bad reason — a bad enum comes back as an
     * HTTP 500 with nothing readable in it, so the guard is the only thing standing between the
     * user and an opaque failure. That throw lands in this catch and becomes the returned `error`,
     * which is why the message it carries is written to be shown as-is.
     */
    const createConsumption = useCallback(
      async (data: ConsumptionPayload) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.createConsumption(data);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not record this consumption.');
        } catch (err) {
          // Dig the server's reason out of the axios body rather than reporting "Request failed
          // with status code 400": the refusals here name a field (not enough stock in the batch,
          // quantity below zero) and that reason is the whole message.
          const { message, code } = extractErrorInfo(err, 'Could not record this consumption.');
          setError(message);
          return { success: false, code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /** Deleting RESTOCKS what was consumed. It is a reversal, not a tidy-up. */
    const deleteConsumption = useCallback(
      async (id: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.deleteConsumption(id);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not delete this consumption.');
        } catch (err) {
          const { message, code } = extractErrorInfo(err, 'Could not delete this consumption.');
          setError(message);
          return { success: false, code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // ─── Wastage ─────────────────────────────────────────────────────────────
    // The consumption callbacks with wastage's types. Same two rules: the LIST writes shared state
    // and takes `append`; the DETAIL read goes through `readOne` and writes NOTHING.

    /**
     * One page of wastage records.
     *
     * `append` grows the list for infinite scroll. A failed append deliberately leaves the existing
     * rows alone — blanking what the user is already reading because page 4 timed out is worse than
     * simply not growing.
     *
     * The caller must pass the SAME `query` on every page: the server filters and sorts, so page 2
     * of a different query is not the continuation of page 1.
     *
     * Only `totalPages` is captured. There is no row count to capture — see the state cells.
     */
    const loadWastageByBusiness = useCallback(
      async (
        businessId: number,
        query: WastageQuery = {},
        page = 1,
        limit = 20,
        append = false,
      ) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.getWastageByBusiness(businessId, query, page, limit);
          if (response.success) {
            const rows = Array.isArray(response.data) ? response.data : [];
            setWastage((prev) => (append ? [...prev, ...rows] : rows));
            setWastageTotalPages(response.totalPages ?? 1);
            return { success: true, data: rows };
          }
          const message = apiMessage(response, 'Failed to load wastage');
          setError(message);
          if (!append) setWastage([]);
          return { success: false, error: message };
        } catch (err) {
          const message = extractErrorMessage(err, 'Failed to load wastage');
          setError(message);
          if (!append) setWastage([]);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /** Fetch ONE wastage for the detail screen. Contract and reasoning: see `readOne`. */
    const loadWastage = useCallback(
      (id: number) => readOne(() => service.getWastage(id), 'Could not load this wastage.'),
      [service],
    );

    /**
     * Record a wastage.
     *
     * The service layer throws BEFORE the request on a bad reason — a bad enum comes back as an
     * HTTP 500 with nothing readable in it — and that throw lands in this catch and becomes the
     * returned `error`, which is why the message it carries is written to be shown as-is.
     */
    const createWastage = useCallback(
      async (data: WastagePayload) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.createWastage(data);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not record this wastage.');
        } catch (err) {
          // Dig the server's reason out of the axios body rather than reporting "Request failed
          // with status code 400": the refusals here name the shortfall (not enough stock left in
          // the batches) and that reason is the whole message.
          const { message, code } = extractErrorInfo(err, 'Could not record this wastage.');
          setError(message);
          return { success: false, code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /**
     * Deleting RESTOCKS what was written off, back into the batches it came out of.
     *
     * No `STOCK_MOVEMENT_LOCKED` branch here, unlike stock transfer: nothing downstream depends on
     * a wastage the way a transfer's destination batch can be drawn from, so the delete is
     * tab-gated and nothing else.
     */
    const deleteWastage = useCallback(
      async (id: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.deleteWastage(id);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not delete this wastage.');
        } catch (err) {
          const { message, code } = extractErrorInfo(err, 'Could not delete this wastage.');
          setError(message);
          return { success: false, code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // ─── Stock Transfer ──────────────────────────────────────────────────────
    // The consumption callbacks, with ONE addition — see `deleteStockTransfer` at the end.

    /**
     * One page of stock transfers.
     *
     * `append` grows the list for infinite scroll. A failed append deliberately leaves the existing
     * rows alone — blanking what the user is already reading because page 4 timed out is worse than
     * simply not growing.
     *
     * The caller must pass the SAME `query` on every page: the server filters and sorts, so page 2
     * of a different query is not the continuation of page 1.
     *
     * Only `totalPages` is captured. There is no row count to capture — see the state cells.
     */
    const loadStockTransfersByBusiness = useCallback(
      async (
        businessId: number,
        query: StockTransferQuery = {},
        page = 1,
        limit = 20,
        append = false,
      ) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.getStockTransfersByBusiness(
            businessId,
            query,
            page,
            limit,
          );
          if (response.success) {
            const rows = Array.isArray(response.data) ? response.data : [];
            setStockTransfers((prev) => (append ? [...prev, ...rows] : rows));
            setStockTransfersTotalPages(response.totalPages ?? 1);
            return { success: true, data: rows };
          }
          const message = apiMessage(response, 'Failed to load stock transfers');
          setError(message);
          if (!append) setStockTransfers([]);
          return { success: false, error: message };
        } catch (err) {
          const message = extractErrorMessage(err, 'Failed to load stock transfers');
          setError(message);
          if (!append) setStockTransfers([]);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /** Fetch ONE transfer for the detail screen. Contract and reasoning: see `readOne`. */
    const loadStockTransfer = useCallback(
      (id: number) => readOne(() => service.getStockTransfer(id), 'Could not load this transfer.'),
      [service],
    );

    /**
     * Move stock between the two pools.
     *
     * The service layer throws BEFORE the request on a bad reason or a same-pool pair — a bad enum
     * comes back as an HTTP 500 with nothing readable in it, so the guard is the only thing standing
     * between the user and an opaque failure. That throw lands in this catch and becomes the
     * returned `error`, which is why the messages it carries are written to be shown as-is.
     */
    const createStockTransfer = useCallback(
      async (data: StockTransferPayload) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.createStockTransfer(data);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not record this transfer.');
        } catch (err) {
          // Dig the server's reason out of the axios body: an over-draw refusal names the shortfall,
          // and that reason is the whole message.
          const { message, code } = extractErrorInfo(err, 'Could not record this transfer.');
          setError(message);
          return { success: false, code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /**
     * Reverse the move: the quantity goes back to the pool it came from and the minted destination
     * batch is removed.
     *
     * ⚠️ THE ONE WAY THIS SLICE DIFFERS FROM ITS CONSUMPTION TWIN. A 409 `STOCK_MOVEMENT_LOCKED`
     * RESOLVES as `{ success: false, code, error }` rather than throwing, so the screen can say WHY:
     * the destination batch has already been drawn from, and reversing the move would take back
     * stock that has since been sold or consumed. That is the system protecting stock, not a
     * failure, and "Could not delete" is the wrong thing to say about it.
     *
     * The `error` message is NOT rewritten here. The server's own sentence names the batch and the
     * quantity; the screen decides how to frame it — see `deleteRefusalMessage`.
     */
    const deleteStockTransfer = useCallback(
      async (id: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.deleteStockTransfer(id);
          if (response.success) return { success: true, data: response.data };
          return {
            success: false,
            error: apiMessage(response, 'Could not delete this transfer'),
          };
        } catch (err) {
          const { message, code } = extractErrorInfo(err, 'Could not delete this transfer');
          setError(message);
          return { success: false, code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // ─── Expense ─────────────────────────────────────────────────────────────

    /**
     * Page of expenses. `append` distinguishes infinite-scroll from a fresh query, exactly as the
     * three stock slices do — page 2 of a different query is not the continuation of page 1.
     *
     * Only `totalPages` is captured. There is no row count to capture — see the state cells.
     */
    const loadExpenseByBusiness = useCallback(
      async (
        businessId: number,
        query: ExpenseQuery = {},
        page = 1,
        limit = 20,
        append = false,
      ) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.getExpenseByBusiness(businessId, query, page, limit);
          if (response.success) {
            const rows = Array.isArray(response.data) ? response.data : [];
            setExpenses((prev) => (append ? [...prev, ...rows] : rows));
            setExpensesTotalPages(response.totalPages ?? 1);
            return { success: true, data: rows };
          }
          const message = apiMessage(response, 'Failed to load expenses');
          setError(message);
          if (!append) setExpenses([]);
          return { success: false, error: message };
        } catch (err) {
          const message = extractErrorMessage(err, 'Failed to load expenses');
          setError(message);
          if (!append) setExpenses([]);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /** Fetch ONE expense for the detail screen. Contract and reasoning: see `readOne`. */
    const loadExpense = useCallback(
      (id: number) => readOne(() => service.getExpense(id), 'Could not load this expense.'),
      [service],
    );

    const createExpense = useCallback(
      async (data: ExpensePayload) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.createExpense(data);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not save this expense.');
        } catch (err) {
          const { message, code } = extractErrorInfo(err, 'Could not save this expense.');
          setError(message);
          // `code` carries TAB_DISABLED and FEATURE_DISABLED, both 403s the screen words for itself:
          // the EXPENSES tab being off, and the reimbursement feature being off while an employee
          // is attached.
          return { success: false, code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /**
     * Correct an expense.
     *
     * ⚠️ `data.files` must be the FULL receipt list on every call. The server REPLACES the
     * collection and writes an empty one when the key is absent, so a partial payload silently
     * erases every attachment. The service layer refuses a missing list rather than letting that
     * reach the wire.
     */
    const updateExpense = useCallback(
      async (id: number, data: ExpenseUpdatePayload) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.updateExpense(id, data);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not save this expense.');
        } catch (err) {
          const { message, code } = extractErrorInfo(err, 'Could not save this expense.');
          setError(message);
          return { success: false, code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const deleteExpense = useCallback(
      async (id: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.deleteExpense(id);
          if (response.success) return { success: true, data: response.data };
          throw apiError(response, 'Could not delete this expense.');
        } catch (err) {
          const { message, code } = extractErrorInfo(err, 'Could not delete this expense.');
          setError(message);
          return { success: false, code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /**
     * Settle a reimbursement. The server stamps the time; the client supplies nothing but the id.
     *
     * ⚠️ Like `deleteStockTransfer`, a 409 RESOLVES as `{ success: false, code, error }` rather than
     * throwing, so the screen can say WHY. `STATE_CONFLICT` here means the expense is not
     * reimbursable or was already settled — reachable by two taps on the same row, or by two
     * devices — and "Could not mark reimbursed" is the wrong thing to say about a row that already
     * is. There is no un-reimburse endpoint, so this is one-way.
     *
     * Which is why the fallback below reads that way and is still correct: `reimburseRefusalMessage`
     * on the screen replaces it outright once it sees `STATE_CONFLICT`. The fallback only ever
     * speaks for a refusal that arrived with no code and no reason at all.
     */
    const markExpenseReimbursed = useCallback(
      async (id: number, reimbursedBy?: number | null) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.markExpenseReimbursed(id, reimbursedBy);
          if (response.success) return { success: true, data: response.data };
          return {
            success: false,
            error: apiMessage(response, 'Could not mark this expense reimbursed.'),
          };
        } catch (err) {
          const { message, code } = extractErrorInfo(
            err,
            'Could not mark this expense reimbursed.',
          );
          setError(message);
          return { success: false, code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /**
     * Per-category ₹ sums for a date range — what the list header's "This month · ₹68,020" is built
     * from. Writes NO shared state: it answers a different question than the rows do, and holding it
     * in a cell beside `expenses` would invite someone to render one against the other's filters.
     */
    const loadExpenseTotalByCategory = useCallback(
      (businessId: number, from: string, to: string) =>
        readOne(
          () => service.getExpenseTotalByCategory(businessId, from, to),
          'Failed to load expense totals',
        ),
      [service],
    );

    const clearError = useCallback(() => {
      setError(null);
    }, []);

    return {
      // State
      products,
      productsTotalPages,
      productMeta,
      services,
      servicesTotalPages,
      servicesTotalElements,
      employees,
      orders,
      ordersTotalPages,
      orderSummary,
      appointments,
      appointmentsTotalPages,
      appointmentDayCounts,
      bills,
      billsTotalPages,
      billSummary,
      inventory,
      inventoryTotalPages,
      inventoryTotal,

      // ─── Consumption ───────────────────────────────────────────────────────
      // No `consumptionsTotal` — the endpoint reports no row count. See the state cells.
      consumptions,
      consumptionsTotalPages,

      // ─── Wastage ───────────────────────────────────────────────────────────
      // No `wastageTotal` — the endpoint reports no row count. See the state cells.
      wastage,
      wastageTotalPages,

      // ─── Stock Transfer ────────────────────────────────────────────────────
      // No `stockTransfersTotal` — the endpoint reports no row count. See the state cells.
      stockTransfers,
      stockTransfersTotalPages,

      // ─── Expense ───────────────────────────────────────────────────────────
      // No `expensesTotal` — the endpoint reports no row count. The header's ₹ figure comes from
      // `loadExpenseTotalByCategory`, which holds no state. See the state cells.
      expenses,
      expensesTotalPages,

      loading,
      error,

      // Product CRUD
      loadProducts,
      loadProduct,
      createProduct,
      updateProduct,
      updateProductTracking,
      deleteProduct,
      ensureProductFolder,
      loadProductOptions,

      // Service CRUD
      loadServices,
      loadService,
      createService,
      updateService,
      updateServiceAvailability,
      deleteService,
      ensureServiceFolder,
      // Receipts. Named beside its siblings rather than in the expense block below, because it is
      // the same `ensureFolder` with a third discriminator — see the callback for how it differs.
      ensureExpenseFolder,

      // Order CRUD
      loadOrders,
      loadOrder,
      loadOrderSummary,
      loadOrdersByCustomer,
      loadBillableOrders,
      updateOrderStatus,
      createOrder,
      updateOrder,
      deleteOrder,

      // Appointment CRUD
      loadAppointments,
      fetchAppointmentsPage,
      loadAppointment,
      loadAppointmentDayCounts,
      updateAppointmentStatus,
      rescheduleAppointment,
      loadAppointmentsByCustomer,
      loadBillableAppointments,
      completeAppointmentItem,
      createAppointment,
      updateAppointment,
      deleteAppointment,

      // Bill CRUD
      loadBills,
      loadBill,
      loadBillSummary,
      updateBillStatus,
      updateBillPayment,
      createBill,
      updateBill,
      deleteBill,
      // Quick Add photos. Both belong to the bill, not to the shared folder helpers above, because
      // neither is keyed by an entity id.
      ensureBillItemFolder,
      attachQuickItemPhotos,

      // Other
      loadEmployees,

      // Inventory — no update, batches are immutable
      loadInventoryByBusiness,
      getInventoryStatusCounts,
      loadInventoryByProduct,
      loadInventoryBatch,
      addInventoryBatch,
      deleteInventoryBatch,
      getAllowedTransitions,
      updateBatchStatus,
      disposeBatch,
      getExpiringBatches,
      getTotalStock,

      // ─── Consumption ───────────────────────────────────────────────────────
      // No update — consumptions are immutable. Delete restocks.
      loadConsumptionsByBusiness,
      loadConsumption,
      createConsumption,
      deleteConsumption,

      // ─── Wastage ───────────────────────────────────────────────────────────
      // No update — wastage records are immutable. Delete restocks.
      loadWastageByBusiness,
      loadWastage,
      createWastage,
      deleteWastage,

      // ─── Stock Transfer ────────────────────────────────────────────────────
      // No update — transfers are immutable. Delete REVERSES the move, and can be refused with
      // STOCK_MOVEMENT_LOCKED; see the callback for why that resolves rather than throws.
      loadStockTransfersByBusiness,
      loadStockTransfer,
      createStockTransfer,
      deleteStockTransfer,

      // Expense — the mutable one: a real update, plus a reimburse action whose 409 STATE_CONFLICT
      // resolves rather than throws so the screen can word it.
      loadExpenseByBusiness,
      loadExpense,
      createExpense,
      updateExpense,
      deleteExpense,
      markExpenseReimbursed,
      loadExpenseTotalByCategory,

      // Utility
      clearError,
    };
  };
}
