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
import { DmsService } from '../../../dms/service/dms.service';
import { createEntityFolder } from '../../../dms/util/EntityFolderUtils';
import { NativeFile, ResourceFileDto } from '../../../dms/api/file.api.interface';

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
    type: 'PRODUCT' | 'SERVICE';
    entityId: number;
    entityName?: string;
    currentFolderId?: number | null;
  }): Promise<ServiceResult>;

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

  // ─── Stock Transfer ────────────────────────────────────────────────────────
  // Empty on purpose — copy the consumption slice above.
}

// ─── Detail-screen reads ─────────────────────────────────────────────────────

/** What every `loadX(id)` hands back. `code` carries the backend's ErrorCode when there is one. */
interface ReadOneResult {
  success: boolean;
  data?: unknown;
  code?: string;
  error?: string | null;
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
    if (response.success) return { success: true, data: response.data };
    return { success: false, error: response.error || response.message || null };
  } catch (err) {
    const e = err as {
      response?: { data?: { code?: string; error?: string; message?: string } };
      message?: string;
    };
    const body = e.response?.data;
    const message = body?.error || body?.message || (err as Error).message || fallbackMessage;
    return { success: false, code: body?.code, error: message };
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
    // Empty on purpose — copy the consumption cells above. Two cells only, for the same reason.

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
            setError(response.error || response.message || null);
            setProducts([]);
            setProductsTotalPages(1);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load products');
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
          const e = err as {
            response?: { data?: { code?: string; error?: string; message?: string } };
            message?: string;
          };
          const body = e.response?.data;
          return {
            success: false,
            code: body?.code,
            error: body?.error || body?.message || e.message || 'Failed to update tracking',
          };
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
          throw new Error(response.error || response.message || 'Failed to create product');
        } catch (err) {
          for (const f of uploadedDmsFiles) {
            try {
              await dmsService.deleteFile(f.id!);
            } catch (_) {}
          }
          const message = (err as Error).message || 'Failed to create product';
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
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to update product';
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
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          // Same treatment as deleteService: dig the server's reason out of the axios body rather
          // than reporting "Request failed with status code 409". A product delete is refused when
          // orders or inventory still reference it, and that reason is the whole message.
          const e = err as {
            response?: { data?: { code?: string; error?: string; message?: string } };
            message?: string;
          };
          const body = e.response?.data;
          const message =
            body?.error || body?.message || (err as Error).message || 'Failed to delete product';
          setError(message);
          return { success: false, code: body?.code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    /** Fetch ONE product for the detail screen. Contract and reasoning: see `readOne`. */
    const loadProduct = useCallback(
      (id: number) => readOne(() => service.getProductById(id), 'Failed to load product'),
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
        type: 'PRODUCT' | 'SERVICE',
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
          return { success: false, error: response.error || response.message || null };
        } catch (err) {
          const message = (err as Error).message || 'Failed to prepare the image folder';
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
     * The business's products as `{id, name}` options, for the service form's Required Products
     * picker.
     *
     * A read for someone else's screen, so like `loadProduct` it writes no shared state — a picker
     * fetch that failed must not leave an `error` the save path would mistake for its own.
     *
     * One page, deliberately: the list endpoint runs the batched stock enrich, which makes it the
     * expensive call in the catalog, and the picker only needs names. The caller reports the cap
     * to the user rather than paging silently.
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
            };
          }
          return { success: false, error: response.error || response.message || null };
        } catch (err) {
          const e = err as { response?: { data?: { error?: string; message?: string } } };
          const body = e.response?.data;
          const message =
            body?.error || body?.message || (err as Error).message || 'Failed to load products';
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
      (id: number) => readOne(() => service.getServiceById(id), 'Failed to load service'),
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
            setError(response.error || response.message || null);
            setServices([]);
            setServicesTotalPages(1);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load services');
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
          throw new Error(response.error || response.message || 'Failed to create service');
        } catch (err) {
          for (const f of uploadedDmsFiles) {
            try {
              await dmsService.deleteFile(f.id!);
            } catch (_) {}
          }
          const message = (err as Error).message || 'Failed to create service';
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
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to update service';
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
          const e = err as {
            response?: { data?: { code?: string; error?: string; message?: string } };
            message?: string;
          };
          const body = e.response?.data;
          return {
            success: false,
            code: body?.code,
            error: body?.error || body?.message || e.message || 'Failed to update availability',
          };
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
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          // Dig the server's reason out of the axios body rather than reporting "Request failed
          // with status code 409". A service delete is routinely refused because appointments,
          // packages or bills still reference it, and that reason is the whole message.
          const e = err as {
            response?: { data?: { code?: string; error?: string; message?: string } };
            message?: string;
          };
          const body = e.response?.data;
          const message =
            body?.error || body?.message || (err as Error).message || 'Failed to delete service';
          setError(message);
          return { success: false, code: body?.code, error: message };
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
      (id: number) => readOne(() => service.getOrderById(id), 'Failed to load order'),
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
          'Failed to load billable orders',
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
            setError(response.error || response.message || null);
            setOrders([]);
            setOrdersTotalPages(1);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load orders');
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
          const message = response.error || response.message || 'Failed to update order status';
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          // Axios error → pull the wrapper out of the 409/400 body so callers can branch on `code`.
          const body = (err as any)?.response?.data;
          const message =
            body?.error ||
            body?.message ||
            (err as Error).message ||
            'Failed to update order status';
          setError(message);
          return { success: false, error: message, code: body?.code, data: body?.data };
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
          throw new Error(response.error || response.message || 'Failed to create order');
        } catch (err) {
          for (const f of uploadedDmsFiles) {
            try {
              await dmsService.deleteFile(f.id!);
            } catch (_) {}
          }
          const message = (err as Error).message || 'Failed to create order';
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
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to update order';
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
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to delete order';
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
            setError(response.error || response.message || null);
            setOrders([]);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load orders for customer');
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
      (id: number) => readOne(() => service.getAppointmentById(id), 'Failed to load appointment'),
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
          'Could not mark that service completed',
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
          'Failed to load billable appointments',
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
            setError(response.error || response.message || null);
            setAppointments([]);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load appointments');
          setAppointments([]);
        } finally {
          setLoading(false);
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
          const message =
            response.error || response.message || 'Failed to update appointment status';
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          const body = (err as any)?.response?.data;
          const message =
            body?.error ||
            body?.message ||
            (err as Error).message ||
            'Failed to update appointment status';
          setError(message);
          return { success: false, error: message, code: body?.code, data: body?.data };
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
          const message = response.error || response.message || 'Failed to reschedule appointment';
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          const body = (err as any)?.response?.data;
          const message =
            body?.error ||
            body?.message ||
            (err as Error).message ||
            'Failed to reschedule appointment';
          setError(message);
          return { success: false, error: message, code: body?.code, data: body?.data };
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
          throw new Error(response.error || response.message || 'Failed to create appointment');
        } catch (err) {
          for (const f of uploadedDmsFiles) {
            try {
              await dmsService.deleteFile(f.id!);
            } catch (_) {}
          }
          const message = (err as Error).message || 'Failed to create appointment';
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
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to update appointment';
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
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to delete appointment';
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
            setError(response.error || response.message || null);
            setAppointments([]);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load appointments for customer');
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
      (id: number) => readOne(() => service.getBillById(id), 'Failed to load bill'),
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
            setError(response.error || response.message || null);
            setBills([]);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load bills');
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
          return await service.updateBillStatus(id, billStatus);
        } catch (err) {
          // Dig the server's `code` out of the axios error — the screen branches on it to tell a
          // state conflict (409) apart from a generic failure.
          const e = err as {
            response?: { data?: { code?: string; error?: string; message?: string } };
            message?: string;
          };
          const body = e.response?.data;
          return {
            success: false,
            code: body?.code,
            error: body?.error || body?.message || e.message || 'Failed to update bill status',
          };
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
          return await service.updateBillPayment(id, paymentStatus, options);
        } catch (err) {
          const e = err as {
            response?: { data?: { code?: string; error?: string; message?: string } };
            message?: string;
          };
          const body = e.response?.data;
          return {
            success: false,
            code: body?.code,
            error: body?.error || body?.message || e.message || 'Failed to update bill payment',
          };
        }
      },
      [service],
    );

    const createBill = useCallback(
      async (data: Record<string, unknown>) => {
        try {
          return await service.createBill(data);
        } catch (err) {
          const e = err as {
            response?: { data?: { code?: string; error?: string; message?: string } };
            message?: string;
          };
          const body = e.response?.data;
          return {
            success: false,
            code: body?.code,
            error: body?.error || body?.message || e.message || 'Failed to create bill',
          };
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
          return await service.updateBill(billId, data);
        } catch (err) {
          const e = err as {
            response?: { data?: { code?: string; error?: string; message?: string } };
            message?: string;
          };
          const body = e.response?.data;
          return {
            success: false,
            code: body?.code,
            error: body?.error || body?.message || e.message || 'Failed to update bill',
          };
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
          return await service.deleteBill(id);
        } catch (err) {
          const e = err as {
            response?: { data?: { code?: string; error?: string; message?: string } };
            message?: string;
          };
          const body = e.response?.data;
          return {
            success: false,
            code: body?.code,
            error: body?.error || body?.message || e.message || 'Failed to delete bill',
          };
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
          setError(response.error || response.message || null);
          if (!append) setInventory([]);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to load inventory';
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
          return { success: false, error: response.error };
        } catch (err) {
          return { success: false, error: (err as Error).message || 'Failed to load counts' };
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
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to load inventory by product';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const loadInventoryBatch = useCallback(
      async (id: number) => {
        try {
          const response = await service.getInventoryBatch(id);
          if (response.success) return { success: true, data: response.data };
          return { success: false, error: response.error || response.message };
        } catch (err) {
          return { success: false, error: (err as Error).message || 'Failed to load batch' };
        }
      },
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
          return { success: false, error: response.error || response.message };
        } catch (err) {
          return { success: false, error: (err as Error).message || 'Failed to load transitions' };
        }
      },
      [service],
    );

    const disposeBatch = useCallback(
      async (batchId: number) => {
        try {
          const response = await service.disposeBatch(batchId);
          if (response.success) return { success: true, data: response.data };
          return { success: false, error: response.error || response.message };
        } catch (err) {
          return { success: false, error: (err as Error).message || 'Failed to dispose batch' };
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
          throw new Error(response.error || response.message || 'Failed to add inventory batch');
        } catch (err) {
          const message = (err as Error).message || 'Failed to add inventory batch';
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
          throw new Error(response.error || response.message || 'Failed to delete inventory batch');
        } catch (err) {
          const message = (err as Error).message || 'Failed to delete inventory batch';
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
          throw new Error(response.error || response.message || 'Failed to update batch status');
        } catch (err) {
          const message = (err as Error).message || 'Failed to update batch status';
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
          throw new Error(response.error || response.message || 'Failed to fetch expiring batches');
        } catch (err) {
          const message = (err as Error).message || 'Failed to fetch expiring batches';
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
          return { success: false, error: response.error };
        } catch (err) {
          return { success: false, error: (err as Error).message };
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
          setError(response.error || response.message || null);
          if (!append) setConsumptions([]);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to load consumptions';
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
      (id: number) => readOne(() => service.getConsumption(id), 'Failed to load consumption'),
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
          throw new Error(response.error || response.message || 'Failed to record consumption');
        } catch (err) {
          // Dig the server's reason out of the axios body rather than reporting "Request failed
          // with status code 400": the refusals here name a field (not enough stock in the batch,
          // quantity below zero) and that reason is the whole message.
          const e = err as {
            response?: { data?: { code?: string; error?: string; message?: string } };
            message?: string;
          };
          const body = e.response?.data;
          const message =
            body?.error ||
            body?.message ||
            (err as Error).message ||
            'Failed to record consumption';
          setError(message);
          return { success: false, code: body?.code, error: message };
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
          throw new Error(response.error || response.message || 'Failed to delete consumption');
        } catch (err) {
          const e = err as {
            response?: { data?: { code?: string; error?: string; message?: string } };
            message?: string;
          };
          const body = e.response?.data;
          const message =
            body?.error ||
            body?.message ||
            (err as Error).message ||
            'Failed to delete consumption';
          setError(message);
          return { success: false, code: body?.code, error: message };
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
          setError(response.error || response.message || null);
          if (!append) setWastage([]);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to load wastage';
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
      (id: number) => readOne(() => service.getWastage(id), 'Failed to load wastage'),
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
          throw new Error(response.error || response.message || 'Failed to record wastage');
        } catch (err) {
          // Dig the server's reason out of the axios body rather than reporting "Request failed
          // with status code 400": the refusals here name the shortfall (not enough stock left in
          // the batches) and that reason is the whole message.
          const e = err as {
            response?: { data?: { code?: string; error?: string; message?: string } };
            message?: string;
          };
          const body = e.response?.data;
          const message =
            body?.error || body?.message || (err as Error).message || 'Failed to record wastage';
          setError(message);
          return { success: false, code: body?.code, error: message };
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
          throw new Error(response.error || response.message || 'Failed to delete wastage');
        } catch (err) {
          const e = err as {
            response?: { data?: { code?: string; error?: string; message?: string } };
            message?: string;
          };
          const body = e.response?.data;
          const message =
            body?.error || body?.message || (err as Error).message || 'Failed to delete wastage';
          setError(message);
          return { success: false, code: body?.code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // ─── Stock Transfer ──────────────────────────────────────────────────────
    // Empty on purpose — copy the consumption callbacks above, with ONE addition:
    //
    // `deleteStockTransfer` must resolve `{ success: false, code: 'STOCK_MOVEMENT_LOCKED', error }`
    // on a 409 rather than throwing, so the screen can surface that specific refusal. A transfer is
    // locked once its destination batch has been drawn from — reversing it would take back stock
    // that has already been sold or consumed — and "Could not delete" is the wrong thing to say
    // about a record the system is protecting on purpose. The `code` comes off the axios body, the
    // same way `deleteProduct` and `updateBillStatus` already read theirs.

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
      // Empty on purpose — copy the consumption pair above.

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
      // Empty on purpose — copy the consumption block above. `deleteStockTransfer` needs the
      // STOCK_MOVEMENT_LOCKED branch described beside the callbacks.

      // Utility
      clearError,
    };
  };
}
