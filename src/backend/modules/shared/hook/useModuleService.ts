/**
 * Shared Module Hook Factory
 *
 * createModuleHook creates a React hook with identical structure for all modules.
 * Each module (Parlour, Pharmacy, Restaurant) uses this with its own service provider.
 *
 * getSelectedBusinessId reads from session storage (AsyncStorage).
 */

import { useState, useCallback, useMemo } from 'react';
import { getSelectedBusiness, getSelectedBusinessType, getBusinessTypeMap } from '../../../../storage/session.storage';
import { PersonApiImpl } from '../../../person/api/person.api.impl';
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
  ): Promise<ServiceResult & {meta?: ProductListMeta}>;
  updateProductTracking?(id: number, trackInventory: boolean): Promise<ServiceResult>;
  createProduct(data: Record<string, unknown>): Promise<ServiceResult>;
  updateProduct(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteProduct(id: number): Promise<ServiceResult>;

  getAllServices(
    businessId: number,
    page: number,
    limit: number,
    options?: ServiceListOptions,
  ): Promise<ServiceResult>;
  updateServiceAvailability?(id: number, availability: boolean): Promise<ServiceResult>;
  createService(data: Record<string, unknown>): Promise<ServiceResult>;
  updateService(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteService(id: number): Promise<ServiceResult>;

  getAllOrders(businessId: number, page: number, limit: number, options?: OrderListOptions): Promise<ServiceResult>;
  // Optional: only modules whose backend exposes /{module}Order/summary implement it (Parlour,
  // Pharmacy). Restaurant omits it, so callers must guard with `service.getOrderSummary?.(...)`.
  getOrderSummary?(businessId: number, options?: {fromDate?: string; toDate?: string}): Promise<ServiceResult<OrderSummary>>;
  // Optional for the same reason as getOrderSummary — only Parlour and Pharmacy expose
  // PATCH /{module}Order/{id}/status. Callers must guard with `service.updateOrderStatus?.(...)`.
  updateOrderStatus?(id: number, status: string, options?: {userId?: number; reason?: string}): Promise<ServiceResult>;
  createOrder(data: Record<string, unknown>): Promise<ServiceResult>;
  updateOrder(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteOrder(id: number): Promise<ServiceResult>;
  getOrdersByCustomer(customerId: number, options: Record<string, unknown>): Promise<ServiceResult>;

  getAllAppointments(businessId: number, page: number, limit: number, options?: AppointmentListOptions): Promise<ServiceResult>;
  // Optional for the same reason as getOrderSummary — only Parlour and Pharmacy expose these three.
  // Restaurant omits them, so callers must guard with `service.getAppointmentDayCounts?.(...)`.
  getAppointmentDayCounts?(businessId: number, options: {fromDate: string; toDate: string}): Promise<ServiceResult<AppointmentDayCounts>>;
  updateAppointmentStatus?(id: number, status: string, options?: {userId?: number; reason?: string}): Promise<ServiceResult>;
  rescheduleAppointment?(id: number, appointmentDateTime: string, options?: {userId?: number; reason?: string}): Promise<ServiceResult>;
  createAppointment(data: Record<string, unknown>): Promise<ServiceResult>;
  updateAppointment(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteAppointment(id: number): Promise<ServiceResult>;
  getAppointmentsByCustomer(customerId: number, options: Record<string, unknown>): Promise<ServiceResult>;

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
    options?: {paidAmount?: number; refundedAmount?: number},
  ): Promise<ServiceResult>;

  getInventoryBatchesByBusiness(businessId: number): Promise<ServiceResult>;
  getInventoryBatchesByProduct(productId: number, businessId: number): Promise<ServiceResult>;
  addInventoryBatch(data: Record<string, unknown>): Promise<ServiceResult>;
  updateInventoryBatch(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteInventoryBatch(id: number): Promise<ServiceResult>;
  updateBatchStatus(id: number, status: string): Promise<ServiceResult>;
  getExpiringBatches(businessId: number, withinDays: number): Promise<ServiceResult>;
  getTotalStock(productId: number, businessId: number): Promise<ServiceResult>;
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
    const [customers, setCustomers] = useState<unknown[]>([]);
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
            return {success: false, error: 'Not supported for this module'};
          }
          return await service.updateProductTracking(id, trackInventory);
        } catch (err) {
          const e = err as {response?: {data?: {code?: string; error?: string; message?: string}}; message?: string};
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
      async (productData: Record<string, unknown>, files: NativeFile[] = [], parentFolderId: number | null = null) => {
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
            try { await dmsService.deleteFile(f.id!); } catch (_) {}
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
          const e = err as {response?: {data?: {code?: string; error?: string; message?: string}}; message?: string};
          const body = e.response?.data;
          const message = body?.error || body?.message || (err as Error).message || 'Failed to delete product';
          setError(message);
          return { success: false, code: body?.code, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // ═══════════════════════════════════════════════════════════════
    // Service CRUD
    // ═══════════════════════════════════════════════════════════════

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
      async (serviceData: Record<string, unknown>, files: NativeFile[] = [], parentFolderId: number | null = null) => {
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
            try { await dmsService.deleteFile(f.id!); } catch (_) {}
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
            return {success: false, error: 'Not supported for this module'};
          }
          return await service.updateServiceAvailability(id, availability);
        } catch (err) {
          const e = err as {response?: {data?: {code?: string; error?: string; message?: string}}; message?: string};
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
          const e = err as {response?: {data?: {code?: string; error?: string; message?: string}}; message?: string};
          const body = e.response?.data;
          const message = body?.error || body?.message || (err as Error).message || 'Failed to delete service';
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

    const loadCustomers = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const personApi = new PersonApiImpl();
        const response = await personApi.getAllPersons();
        if (response?.data) {
          setCustomers(Array.isArray(response.data) ? response.data : []);
        } else {
          setCustomers([]);
        }
      } catch (err) {
        setError((err as Error).message || 'Failed to load customers');
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    }, []);

    const loadEmployees = useCallback(async () => {
      setEmployees([]);
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // Order CRUD
    // ═══════════════════════════════════════════════════════════════

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
      async (options: {fromDate?: string; toDate?: string} = {}) => {
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
            body?.error || body?.message || (err as Error).message || 'Failed to update order status';
          setError(message);
          return { success: false, error: message, code: body?.code, data: body?.data };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const createOrder = useCallback(
      async (orderData: Record<string, unknown>, files: NativeFile[] = [], parentFolderId: number | null = null) => {
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
            uploadedDmsFiles = await dmsService.uploadMultipleFiles(files, dmsFolderId || parentFolderId!);
            orderData = { ...orderData, dmsFileIds: uploadedDmsFiles.map((f) => f.id) };
          }
          const response = await service.createOrder(orderData);
          if (response.success) return { success: true, data: response.data };
          throw new Error(response.error || response.message || 'Failed to create order');
        } catch (err) {
          for (const f of uploadedDmsFiles) {
            try { await dmsService.deleteFile(f.id!); } catch (_) {}
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
     * MERGES rather than replaces. Switching Day↔Calendar or paging months fetches a different
     * window, and blanking the map first would drop every dot for a frame.
     */
    const loadAppointmentDayCounts = useCallback(
      async (options: {fromDate: string; toDate: string}) => {
        try {
          const businessId = await getSelectedBusinessId();
          if (!businessId || !service.getAppointmentDayCounts) return;
          const response = await service.getAppointmentDayCounts(businessId, options);
          if (response.success && response.data?.counts) {
            const next = response.data.counts;
            setAppointmentDayCounts(prev => ({ ...prev, ...next }));
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
          const message = response.error || response.message || 'Failed to update appointment status';
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          const body = (err as any)?.response?.data;
          const message =
            body?.error || body?.message || (err as Error).message || 'Failed to update appointment status';
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
          const response = await service.rescheduleAppointment(appointmentId, appointmentDateTime, { reason });
          if (response.success) return { success: true, data: response.data };
          const message = response.error || response.message || 'Failed to reschedule appointment';
          setError(message);
          return { success: false, error: message };
        } catch (err) {
          const body = (err as any)?.response?.data;
          const message =
            body?.error || body?.message || (err as Error).message || 'Failed to reschedule appointment';
          setError(message);
          return { success: false, error: message, code: body?.code, data: body?.data };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const createAppointment = useCallback(
      async (appointmentData: Record<string, unknown>, files: NativeFile[] = [], parentFolderId: number | null = null) => {
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
            try { await dmsService.deleteFile(f.id!); } catch (_) {}
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
            setBillsTotalPages((response as {totalPages?: number}).totalPages || 1);
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
            return {success: false, error: 'Not supported for this module'};
          }
          return await service.updateBillStatus(id, billStatus);
        } catch (err) {
          // Dig the server's `code` out of the axios error — the screen branches on it to tell a
          // state conflict (409) apart from a generic failure.
          const e = err as {response?: {data?: {code?: string; error?: string; message?: string}}; message?: string};
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
        options: {paidAmount?: number; refundedAmount?: number} = {},
      ) => {
        try {
          if (!service.updateBillPayment) {
            return {success: false, error: 'Not supported for this module'};
          }
          return await service.updateBillPayment(id, paymentStatus, options);
        } catch (err) {
          const e = err as {response?: {data?: {code?: string; error?: string; message?: string}}; message?: string};
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

    // ═══════════════════════════════════════════════════════════════
    // Inventory CRUD
    // ═══════════════════════════════════════════════════════════════

    const loadInventoryByBusiness = useCallback(
      async (businessId: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.getInventoryBatchesByBusiness(businessId);
          if (response.success) {
            setInventory(Array.isArray(response.data) ? response.data : []);
          } else {
            setError(response.error || response.message || null);
            setInventory([]);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load inventory');
          setInventory([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const loadInventoryByProduct = useCallback(
      async (productId: number, businessId: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.getInventoryBatchesByProduct(productId, businessId);
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

    const updateInventoryBatch = useCallback(
      async (batchData: Record<string, unknown>) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.updateInventoryBatch(batchData);
          if (response.success) return { success: true, data: response.data };
          throw new Error(response.error || response.message || 'Failed to update inventory batch');
        } catch (err) {
          const message = (err as Error).message || 'Failed to update inventory batch';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

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

    const updateBatchStatus = useCallback(
      async (id: number, status: string) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.updateBatchStatus(id, status);
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
      async (productId: number, businessId: number) => {
        try {
          const response = await service.getTotalStock(productId, businessId);
          if (response.success) return { success: true, data: response.data };
          return { success: false, error: response.error };
        } catch (err) {
          return { success: false, error: (err as Error).message };
        }
      },
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
      customers,
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
      loading,
      error,

      // Product CRUD
      loadProducts,
      createProduct,
      updateProduct,
      updateProductTracking,
      deleteProduct,

      // Service CRUD
      loadServices,
      createService,
      updateService,
      updateServiceAvailability,
      deleteService,

      // Order CRUD
      loadOrders,
      loadOrderSummary,
      loadOrdersByCustomer,
      updateOrderStatus,
      createOrder,
      updateOrder,
      deleteOrder,

      // Appointment CRUD
      loadAppointments,
      loadAppointmentDayCounts,
      updateAppointmentStatus,
      rescheduleAppointment,
      loadAppointmentsByCustomer,
      createAppointment,
      updateAppointment,
      deleteAppointment,

      // Other
      loadCustomers,
      loadEmployees,
      loadBills,
      loadBillSummary,
      updateBillStatus,
      updateBillPayment,

      // Inventory CRUD
      loadInventoryByBusiness,
      loadInventoryByProduct,
      addInventoryBatch,
      updateInventoryBatch,
      deleteInventoryBatch,
      updateBatchStatus,
      getExpiringBatches,
      getTotalStock,

      // Utility
      clearError,
    };
  };
}
