import {ParlourApiInterface, ApiResponse, ProductListOptions, ProductListResponse, OrderListOptions, OrderSummary, AppointmentListOptions, AppointmentDayCounts, BillListOptions, BillSummary} from './parlour.api.interface';
import parlourApiClient from '../config/axios.instance';
import {PARLOUR_ROUTES} from '../config/api.config';

export class ParlourApiImpl extends ParlourApiInterface {
  // ── Products ───────────────────────────────────────────────────────────────
  async getAllProducts(businessId: number, page: number, limit: number, options: ProductListOptions = {}): Promise<ProductListResponse> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.PRODUCTS_VIEW_ALL, {params: {businessId, page, limit, ...options}});
    return res.data;
  }
  // Tracking-only PATCH, never the full PUT: that copies the whole request body over the record and
  // rebuilds the sale-unit ladder, so a partial body would silently destroy it.
  async updateProductTracking(id: number, trackInventory: boolean): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.patch(`${PARLOUR_ROUTES.PRODUCTS_BASE}/${id}/tracking`, null, {params: {trackInventory}});
    return res.data;
  }
  async getProductById(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.PRODUCTS_BASE}/${id}`);
    return res.data;
  }
  async createProduct(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.post(PARLOUR_ROUTES.PRODUCTS_BASE, data);
    return res.data;
  }
  async updateProduct(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.put(PARLOUR_ROUTES.PRODUCTS_BASE, data);
    return res.data;
  }
  async deleteProduct(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.delete(`${PARLOUR_ROUTES.PRODUCTS_BASE}/${id}`);
    return res.data;
  }

  // ── Services ───────────────────────────────────────────────────────────────
  async getAllServices(businessId: number, page: number, limit: number): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.SERVICES_VIEW_ALL, {params: {businessId, page, limit}});
    return res.data;
  }
  async getServiceById(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.SERVICES_BASE}/${id}`);
    return res.data;
  }
  async createService(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.post(PARLOUR_ROUTES.SERVICES_BASE, data);
    return res.data;
  }
  async updateService(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.put(PARLOUR_ROUTES.SERVICES_BASE, data);
    return res.data;
  }
  async deleteService(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.delete(`${PARLOUR_ROUTES.SERVICES_BASE}/${id}`);
    return res.data;
  }

  // ── Orders ─────────────────────────────────────────────────────────────────
  async getAllOrders(businessId: number, page: number, limit: number, options: OrderListOptions = {}): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.ORDERS_VIEW_ALL, {params: {businessId, page, limit, ...options}});
    return res.data;
  }
  async getOrderSummary(businessId: number, options: {fromDate?: string; toDate?: string} = {}): Promise<ApiResponse<OrderSummary>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.ORDERS_SUMMARY, {params: {businessId, ...options}});
    return res.data;
  }
  async updateOrderStatus(id: number, status: string, options: {userId?: number; reason?: string} = {}): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.patch(`${PARLOUR_ROUTES.ORDERS_BASE}/${id}/status`, null, {params: {status, ...options}});
    return res.data;
  }
  async getOrderById(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.ORDERS_BASE}/${id}`);
    return res.data;
  }
  async createOrder(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.post(PARLOUR_ROUTES.ORDERS_BASE, data);
    return res.data;
  }
  async updateOrder(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.put(PARLOUR_ROUTES.ORDERS_BASE, data);
    return res.data;
  }
  async deleteOrder(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.delete(`${PARLOUR_ROUTES.ORDERS_BASE}/${id}`);
    return res.data;
  }
  async getOrdersByCustomer(customerId: number, options: Record<string, unknown>): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.ORDERS_BY_CUSTOMER}/${customerId}`, {params: options});
    return res.data;
  }

  // ── Appointments ───────────────────────────────────────────────────────────
  async getAllAppointments(businessId: number, page: number, limit: number, options: AppointmentListOptions = {}): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.APPOINTMENTS_VIEW_ALL, {params: {businessId, page, limit, ...options}});
    return res.data;
  }
  async getAppointmentDayCounts(businessId: number, options: {fromDate: string; toDate: string}): Promise<ApiResponse<AppointmentDayCounts>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.APPOINTMENTS_DAY_COUNTS, {params: {businessId, ...options}});
    return res.data;
  }
  async updateAppointmentStatus(id: number, status: string, options: {userId?: number; reason?: string} = {}): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.patch(`${PARLOUR_ROUTES.APPOINTMENTS_BASE}/${id}/status`, null, {params: {status, ...options}});
    return res.data;
  }
  // appointmentDateTime is a zone-less IST wall clock ("2025-04-24T14:30:00"), matching create and
  // update. Never send an ISO instant with a Z — the server re-reads it as IST and lands 5h30m off.
  async rescheduleAppointment(id: number, appointmentDateTime: string, options: {userId?: number; reason?: string} = {}): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.patch(`${PARLOUR_ROUTES.APPOINTMENTS_BASE}/${id}/schedule`, null, {params: {appointmentDateTime, ...options}});
    return res.data;
  }
  async getAppointmentById(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.APPOINTMENTS_BASE}/${id}`);
    return res.data;
  }
  async createAppointment(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.post(PARLOUR_ROUTES.APPOINTMENTS_BASE, data);
    return res.data;
  }
  async updateAppointment(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.put(PARLOUR_ROUTES.APPOINTMENTS_BASE, data);
    return res.data;
  }
  async deleteAppointment(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.delete(`${PARLOUR_ROUTES.APPOINTMENTS_BASE}/${id}`);
    return res.data;
  }
  async getAppointmentsByCustomer(customerId: number, options: Record<string, unknown>): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.APPOINTMENTS_BY_CUSTOMER}/${customerId}`, {params: options});
    return res.data;
  }

  // ── Bills ──────────────────────────────────────────────────────────────────
  async getAllBills(page: number, limit: number): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.BILLS_VIEW_ALL, {params: {page, limit}});
    return res.data;
  }
  async getBillById(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.BILLS_BASE}/${id}`);
    return res.data;
  }
  async getBillsByBusiness(businessId: number, page = 1, limit = 20, options: BillListOptions = {}): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.BILLS_BY_BUSINESS}/${businessId}`, {params: {page, limit, ...options}});
    return res.data;
  }
  async getBillSummary(businessId: number): Promise<ApiResponse<BillSummary>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.BILLS_SUMMARY, {params: {businessId}});
    return res.data;
  }
  // Status-only PATCH, never the full PUT: that rebuilds the bill from a complete request body and
  // a partial one silently wipes its lines. Cancelling here also un-links the billed
  // orders/appointments and restocks bill-owned bare lines, server-side.
  async updateBillStatus(id: number, billStatus: string): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.patch(`${PARLOUR_ROUTES.BILLS_BASE}/${id}/status`, null, {params: {billStatus}});
    return res.data;
  }
  // paidAmount is required for PARTIALLY_PAID, refundedAmount for PARTIAL_REFUNDED — the server
  // 400s otherwise rather than silently settling to zero.
  async updateBillPayment(id: number, paymentStatus: string, options: {paidAmount?: number; refundedAmount?: number} = {}): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.patch(`${PARLOUR_ROUTES.BILLS_BASE}/${id}/payment`, null, {params: {paymentStatus, ...options}});
    return res.data;
  }
  async getBillsByCustomer(customerId: number): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.BILLS_BY_CUSTOMER}/${customerId}`);
    return res.data;
  }
  async createBill(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.post(PARLOUR_ROUTES.BILLS_BASE, data);
    return res.data;
  }
  async updateBill(billId: number, data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.put(`${PARLOUR_ROUTES.BILLS_BASE}/${billId}`, data);
    return res.data;
  }
  async deleteBill(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.delete(`${PARLOUR_ROUTES.BILLS_BASE}/${id}`);
    return res.data;
  }

  // ── Inventory ──────────────────────────────────────────────────────────────
  async addInventoryBatch(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.post(PARLOUR_ROUTES.INVENTORY_ADD, data);
    return res.data;
  }
  async updateInventoryBatch(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.put(PARLOUR_ROUTES.INVENTORY_UPDATE, data);
    return res.data;
  }
  async getInventoryBatch(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.INVENTORY_VIEW}/${id}`);
    return res.data;
  }
  async getInventoryBatchesByProduct(productId: number, businessId: number): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.INVENTORY_BY_PRODUCT, {params: {productId, businessId}});
    return res.data;
  }
  async getInventoryBatchesByBusiness(businessId: number): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.INVENTORY_BY_BUSINESS}/${businessId}`);
    return res.data;
  }
  async getTotalStock(productId: number, businessId: number): Promise<ApiResponse<number>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.INVENTORY_TOTAL_STOCK, {params: {productId, businessId}});
    return res.data;
  }
  async isAvailable(productId: number, businessId: number): Promise<ApiResponse<boolean>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.INVENTORY_IS_AVAILABLE, {params: {productId, businessId}});
    return res.data;
  }
  async getExpiringBatches(businessId: number, withinDays: number): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.INVENTORY_EXPIRING, {params: {businessId, withinDays}});
    return res.data;
  }
  async updateBatchStatus(id: number, status: string): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.put(`${PARLOUR_ROUTES.INVENTORY_UPDATE_STATUS}/${id}`, null, {params: {status}});
    return res.data;
  }
  async deleteInventoryBatch(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.delete(`${PARLOUR_ROUTES.INVENTORY_DELETE}/${id}`);
    return res.data;
  }
}
