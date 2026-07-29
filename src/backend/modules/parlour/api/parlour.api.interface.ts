export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  totalPages?: number;
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

export abstract class ParlourApiInterface {
  // Products
  abstract getAllProducts(businessId: number, page: number, limit: number): Promise<ApiResponse<unknown[]>>;
  abstract getProductById(id: number): Promise<ApiResponse<unknown>>;
  abstract createProduct(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract updateProduct(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract deleteProduct(id: number): Promise<ApiResponse<unknown>>;

  // Services
  abstract getAllServices(businessId: number, page: number, limit: number): Promise<ApiResponse<unknown[]>>;
  abstract getServiceById(id: number): Promise<ApiResponse<unknown>>;
  abstract createService(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract updateService(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract deleteService(id: number): Promise<ApiResponse<unknown>>;

  // Orders
  abstract getAllOrders(businessId: number, page: number, limit: number, options?: OrderListOptions): Promise<ApiResponse<unknown[]>>;
  abstract getOrderSummary(businessId: number, options?: {fromDate?: string; toDate?: string}): Promise<ApiResponse<OrderSummary>>;
  abstract updateOrderStatus(id: number, status: string, options?: {userId?: number; reason?: string}): Promise<ApiResponse<unknown>>;
  abstract getOrderById(id: number): Promise<ApiResponse<unknown>>;
  abstract createOrder(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract updateOrder(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract deleteOrder(id: number): Promise<ApiResponse<unknown>>;
  abstract getOrdersByCustomer(customerId: number, options: Record<string, unknown>): Promise<ApiResponse<unknown[]>>;

  // Appointments
  abstract getAllAppointments(businessId: number, page: number, limit: number): Promise<ApiResponse<unknown[]>>;
  abstract getAppointmentById(id: number): Promise<ApiResponse<unknown>>;
  abstract createAppointment(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract updateAppointment(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract deleteAppointment(id: number): Promise<ApiResponse<unknown>>;
  abstract getAppointmentsByCustomer(customerId: number, options: Record<string, unknown>): Promise<ApiResponse<unknown[]>>;

  // Bills
  abstract getAllBills(page: number, limit: number): Promise<ApiResponse<unknown[]>>;
  abstract getBillById(id: number): Promise<ApiResponse<unknown>>;
  abstract getBillsByBusiness(businessId: number): Promise<ApiResponse<unknown[]>>;
  abstract getBillsByCustomer(customerId: number): Promise<ApiResponse<unknown[]>>;
  abstract createBill(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract updateBill(billId: number, data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract deleteBill(id: number): Promise<ApiResponse<unknown>>;

  // Inventory
  abstract addInventoryBatch(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract updateInventoryBatch(data: Record<string, unknown>): Promise<ApiResponse<unknown>>;
  abstract getInventoryBatch(id: number): Promise<ApiResponse<unknown>>;
  abstract getInventoryBatchesByProduct(productId: number, businessId: number): Promise<ApiResponse<unknown[]>>;
  abstract getInventoryBatchesByBusiness(businessId: number): Promise<ApiResponse<unknown[]>>;
  abstract getTotalStock(productId: number, businessId: number): Promise<ApiResponse<number>>;
  abstract isAvailable(productId: number, businessId: number): Promise<ApiResponse<boolean>>;
  abstract getExpiringBatches(businessId: number, withinDays: number): Promise<ApiResponse<unknown[]>>;
  abstract updateBatchStatus(id: number, status: string): Promise<ApiResponse<unknown>>;
  abstract deleteInventoryBatch(id: number): Promise<ApiResponse<unknown>>;
}
