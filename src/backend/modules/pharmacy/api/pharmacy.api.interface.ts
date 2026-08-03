export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  totalPages?: number;
  /**
   * Total matching rows across every page. Absent on most endpoints — the server omits it when
   * null — so treat it as "unknown", never as zero: a client holding page 1 of 3 cannot derive it
   * from `totalPages`, which is why it exists.
   */
  totalElements?: number;
  error: string | null;
}

/**
 * Orders V2 list filters, layered on top of businessId/page/limit. `status` is a comma-separated
 * OrderStatus list; `fromDate`/`toDate` are YYYY-MM-DD (IST, toDate inclusive). All optional — an
 * empty object reproduces the plain paginated list.
 */
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
 * Appointments list filters. Same shape as OrderListOptions — `status` is a comma-separated
 * AppointmentStatus list, dates are YYYY-MM-DD IST with `toDate` inclusive.
 *
 * The day view sends fromDate === toDate plus `sortDir: 'asc'`; the backend's viewAll defaults to
 * desc, so ascending must be explicit or the day reads bottom-up.
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
 * Per-IST-day appointment counts for the week strip / month grid dots. Keys are YYYY-MM-DD and
 * match a row's own `appointmentDate`, so the client indexes one by the other with no date maths.
 * Days with no appointments are omitted.
 */
export interface AppointmentDayCounts {
  total: number;
  counts: Record<string, number>;
}

/**
 * Bills list filters. Same shape as the order/appointment options minus the date window — the
 * billing screens have no date filter, so the backend deliberately does not accept one.
 *
 * `billStatus` and `paymentStatus` are comma-separated enum-name lists and are INDEPENDENT: a bill
 * can be FINALIZED and UNPAID at once, which is why they are two params rather than one.
 *
 * Note `search` does NOT match customer name — the backend matches bill number, phone, email and
 * the numeric id only. The placeholder copy has to say so.
 */
/**
 * Server-side narrowing for the product list. `search` matches name and brand only — which is
 * exactly what the Products screen's "Try a different name or brand" copy promises.
 *
 * `sortBy` is whitelisted server-side and silently falls back to `id` on anything else. Note the
 * server's own default is `id` ascending, i.e. oldest first — the screen passes an explicit sort
 * rather than inheriting it.
 */
export interface ProductListOptions {
  search?: string;
  sortBy?: string;
  sortDir?: string;
}

/**
 * Catalog-wide figures behind the "142 items · 6 low on stock" header.
 *
 * Business-scoped, NOT scoped to the active search: these describe the catalog being managed, and a
 * stock warning that shrank because someone typed in the search box would be misleading. The screen
 * only renders this line in browse mode.
 */
export interface ProductListMeta {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  /** The boundary the counts were computed with — use it for row badges so the two can't drift. */
  lowStockThreshold: number;
}

/**
 * The product list carries its summary on the envelope rather than in a second `/summary` call, so
 * the header can never describe a different fetch than the rows under it. Absent on every other
 * endpoint (the server omits the field when null).
 */
export interface ProductListResponse extends ApiResponse<unknown[]> {
  meta?: ProductListMeta;
}

/**
 * Server-side narrowing for the service list.
 *
 * `search` matches the service NAME only — not the description, and not categories. The screen's
 * copy says "Try a different name." for exactly that reason; promising more than the spec performs
 * is how a user concludes search is broken.
 *
 * `sortBy` is whitelisted server-side and silently falls back to `id` on anything else. The
 * server's own default is `id` ascending — oldest first — so the screen always sends an explicit
 * sort.
 */
export interface ServiceListOptions {
  search?: string;
  sortBy?: string;
  sortDir?: string;
}

export interface BillListOptions {
  search?: string;
  billStatus?: string;
  paymentStatus?: string;
  sortBy?: string;
  sortDir?: string;
}

/**
 * All-time billing rollup: the header line, the status chips and the wallet card in one payload.
 * See the parlour twin for the full contract — notably that the counts map is sparse and that
 * outstandingFromPartial + outstandingFromUnpaid always equals totalOutstanding.
 */
export interface BillSummary {
  totalBills: number;
  countsByPaymentStatus: Record<string, number>;
  countsByBillStatus: Record<string, number>;
  totalPaid: number;
  outstandingFromPartial: number;
  outstandingFromUnpaid: number;
  totalOutstanding: number;
  outstandingBillCount: number;
}

export abstract class PharmacyApiInterface {
  abstract getAllProducts(
    businessId: number,
    page: number,
    limit: number,
    options?: ProductListOptions,
  ): Promise<ProductListResponse>;
  /** Flips only `trackInventory` — see the impl for why the full PUT is not an option. */
  abstract updateProductTracking(
    id: number,
    trackInventory: boolean,
  ): Promise<ApiResponse<unknown>>;
  abstract getProductById(id: number): Promise<ApiResponse<unknown>>;
  abstract createProduct(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract updateProduct(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract deleteProduct(id: number): Promise<ApiResponse<unknown>>;

  abstract getAllServices(
    businessId: number,
    page: number,
    limit: number,
    options?: ServiceListOptions,
  ): Promise<ApiResponse<unknown[]>>;
  /** Flips only `availability` — see the impl for why the full PUT is not an option. */
  abstract updateServiceAvailability(
    id: number,
    availability: boolean,
  ): Promise<ApiResponse<unknown>>;
  abstract getServiceById(id: number): Promise<ApiResponse<unknown>>;
  abstract createService(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract updateService(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract deleteService(id: number): Promise<ApiResponse<unknown>>;

  abstract getAllOrders(
    businessId: number,
    page: number,
    limit: number,
    options?: OrderListOptions,
  ): Promise<ApiResponse<unknown[]>>;
  abstract getOrderSummary(
    businessId: number,
    options?: { fromDate?: string; toDate?: string },
  ): Promise<ApiResponse<OrderSummary>>;
  abstract updateOrderStatus(
    id: number,
    status: string,
    options?: { userId?: number; reason?: string },
  ): Promise<ApiResponse<unknown>>;
  abstract getOrderById(id: number): Promise<ApiResponse<unknown>>;
  abstract createOrder(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract updateOrder(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract deleteOrder(id: number): Promise<ApiResponse<unknown>>;
  abstract getOrdersByCustomer(
    customerId: number,
    options: Record<string, unknown>,
  ): Promise<ApiResponse<unknown[]>>;

  abstract getAllAppointments(
    businessId: number,
    page: number,
    limit: number,
    options?: AppointmentListOptions,
  ): Promise<ApiResponse<unknown[]>>;
  abstract getAppointmentDayCounts(
    businessId: number,
    options: { fromDate: string; toDate: string },
  ): Promise<ApiResponse<AppointmentDayCounts>>;
  abstract updateAppointmentStatus(
    id: number,
    status: string,
    options?: { userId?: number; reason?: string },
  ): Promise<ApiResponse<unknown>>;
  abstract rescheduleAppointment(
    id: number,
    appointmentDateTime: string,
    options?: { userId?: number; reason?: string },
  ): Promise<ApiResponse<unknown>>;
  abstract getAppointmentById(id: number): Promise<ApiResponse<unknown>>;
  abstract createAppointment(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract updateAppointment(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract deleteAppointment(id: number): Promise<ApiResponse<unknown>>;
  abstract getAppointmentsByCustomer(
    customerId: number,
    options: Record<string, unknown>,
  ): Promise<ApiResponse<unknown[]>>;

  abstract getBillById(id: number): Promise<ApiResponse<unknown>>;
  abstract getBillsByBusiness(
    businessId: number,
    page?: number,
    limit?: number,
    options?: BillListOptions,
  ): Promise<ApiResponse<unknown[]>>;
  abstract getBillSummary(businessId: number): Promise<ApiResponse<BillSummary>>;
  abstract updateBillStatus(id: number, billStatus: string): Promise<ApiResponse<unknown>>;
  abstract updateBillPayment(
    id: number,
    paymentStatus: string,
    options?: { paidAmount?: number; refundedAmount?: number },
  ): Promise<ApiResponse<unknown>>;
  abstract getBillsByCustomer(customerId: number): Promise<ApiResponse<unknown[]>>;
  abstract createBill(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract updateBill(billId: number, data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract deleteBill(id: number): Promise<ApiResponse<unknown>>;

  abstract addInventoryBatch(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract updateInventoryBatch(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract getInventoryBatch(id: number): Promise<ApiResponse<unknown>>;
  abstract getInventoryBatchesByProduct(
    productId: number,
    businessId: number,
  ): Promise<ApiResponse<unknown[]>>;
  abstract getInventoryBatchesByBusiness(businessId: number): Promise<ApiResponse<unknown[]>>;
  abstract getTotalStock(productId: number, businessId: number): Promise<ApiResponse<number>>;
  abstract isAvailable(productId: number, businessId: number): Promise<ApiResponse<boolean>>;
  abstract getExpiringBatches(
    businessId: number,
    withinDays: number,
  ): Promise<ApiResponse<unknown[]>>;
  abstract updateBatchStatus(id: number, status: string): Promise<ApiResponse<unknown>>;
  abstract deleteInventoryBatch(id: number): Promise<ApiResponse<unknown>>;
}
