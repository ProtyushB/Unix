import {
  PharmacyApiInterface,
  ApiResponse,
  BillableListOptions,
  ProductListOptions,
  ProductListResponse,
  ServiceListOptions,
  OrderListOptions,
  OrderSummary,
  AppointmentListOptions,
  AppointmentDayCounts,
  BillListOptions,
  BillSummary,
} from './pharmacy.api.interface';
import pharmacyApiClient from '../config/axios.instance';
import { PHARMACY_ROUTES } from '../config/api.config';
import {
  compactParams,
  type InventoryQuery,
  type InventoryStatus,
  type InventoryStatusCounts,
  type InventoryType,
  type StatusChangeOptions,
} from '../../shared/inventory.types';
import type { ConsumptionPayload, ConsumptionQuery } from '../../shared/consumption.types';
import type { StockTransferPayload, StockTransferQuery } from '../../shared/stockTransfer.types';

export class PharmacyApiImpl extends PharmacyApiInterface {
  async getAllProducts(
    businessId: number,
    page: number,
    limit: number,
    options: ProductListOptions = {},
  ): Promise<ProductListResponse> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.PRODUCTS_VIEW_ALL, {
      params: { businessId, page, limit, ...options },
    });
    return res.data;
  }
  // Tracking-only PATCH, never the full PUT: that copies the whole request body over the record and
  // rebuilds the sale-unit ladder, so a partial body would silently destroy it.
  async updateProductTracking(id: number, trackInventory: boolean): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.patch(
      `${PHARMACY_ROUTES.PRODUCTS_BASE}/${id}/tracking`,
      null,
      { params: { trackInventory } },
    );
    return res.data;
  }
  async getProductById(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.PRODUCTS_BASE}/${id}`);
    return res.data;
  }
  async createProduct(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.post(PHARMACY_ROUTES.PRODUCTS_BASE, data);
    return res.data;
  }
  async updateProduct(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.put(PHARMACY_ROUTES.PRODUCTS_BASE, data);
    return res.data;
  }
  async deleteProduct(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.delete(`${PHARMACY_ROUTES.PRODUCTS_BASE}/${id}`);
    return res.data;
  }
  async ensureEntityFolder(params: {
    businessId: number;
    type: 'PRODUCT' | 'SERVICE';
    entityId: number;
    entityName?: string;
    currentFolderId?: number | null;
  }): Promise<ApiResponse<Record<string, number>>> {
    const res = await pharmacyApiClient.post(PHARMACY_ROUTES.DMS_ENTITY_FOLDER, params);
    return res.data;
  }
  async getAllServices(
    businessId: number,
    page: number,
    limit: number,
    options: ServiceListOptions = {},
  ): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.SERVICES_VIEW_ALL, {
      params: { businessId, page, limit, ...options },
    });
    return res.data;
  }
  // Availability-only PATCH, never the full PUT: that copies the whole request body over the record,
  // so a partial body would blank the description, price, requiredProductIds and the
  // isAppointmentRequired flag that decides whether billing auto-generates an appointment.
  async updateServiceAvailability(
    id: number,
    availability: boolean,
  ): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.patch(
      `${PHARMACY_ROUTES.SERVICES_BASE}/${id}/availability`,
      null,
      { params: { availability } },
    );
    return res.data;
  }
  async getServiceById(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.SERVICES_BASE}/${id}`);
    return res.data;
  }
  async createService(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.post(PHARMACY_ROUTES.SERVICES_BASE, data);
    return res.data;
  }
  async updateService(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.put(PHARMACY_ROUTES.SERVICES_BASE, data);
    return res.data;
  }
  async deleteService(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.delete(`${PHARMACY_ROUTES.SERVICES_BASE}/${id}`);
    return res.data;
  }
  async getAllOrders(
    businessId: number,
    page: number,
    limit: number,
    options: OrderListOptions = {},
  ): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.ORDERS_VIEW_ALL, {
      params: { businessId, page, limit, ...options },
    });
    return res.data;
  }
  async getOrderSummary(
    businessId: number,
    options: { fromDate?: string; toDate?: string } = {},
  ): Promise<ApiResponse<OrderSummary>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.ORDERS_SUMMARY, {
      params: { businessId, ...options },
    });
    return res.data;
  }
  async updateOrderStatus(
    id: number,
    status: string,
    options: { userId?: number; reason?: string } = {},
  ): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.patch(`${PHARMACY_ROUTES.ORDERS_BASE}/${id}/status`, null, {
      params: { status, ...options },
    });
    return res.data;
  }
  async getOrderById(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.ORDERS_BASE}/${id}`);
    return res.data;
  }
  async createOrder(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.post(PHARMACY_ROUTES.ORDERS_BASE, data);
    return res.data;
  }
  async updateOrder(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.put(PHARMACY_ROUTES.ORDERS_BASE, data);
    return res.data;
  }
  async deleteOrder(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.delete(`${PHARMACY_ROUTES.ORDERS_BASE}/${id}`);
    return res.data;
  }
  async getOrdersByCustomer(
    customerId: number,
    options: Record<string, unknown>,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.ORDERS_BY_CUSTOMER}/${customerId}`, {
      params: options,
    });
    return res.data;
  }
  // `/billable` hangs off the same customer segment, so it reuses the route constant. Distinct from
  // getOrdersByCustomer: that returns the whole history, this returns only what is not on a bill.
  async getBillableOrders(
    customerId: number,
    options: BillableListOptions,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(
      `${PHARMACY_ROUTES.ORDERS_BY_CUSTOMER}/${customerId}/billable`,
      { params: options },
    );
    return res.data;
  }
  async getAllAppointments(
    businessId: number,
    page: number,
    limit: number,
    options: AppointmentListOptions = {},
  ): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.APPOINTMENTS_VIEW_ALL, {
      params: { businessId, page, limit, ...options },
    });
    return res.data;
  }
  async getAppointmentDayCounts(
    businessId: number,
    options: { fromDate: string; toDate: string },
  ): Promise<ApiResponse<AppointmentDayCounts>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.APPOINTMENTS_DAY_COUNTS, {
      params: { businessId, ...options },
    });
    return res.data;
  }
  async updateAppointmentStatus(
    id: number,
    status: string,
    options: { userId?: number; reason?: string } = {},
  ): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.patch(
      `${PHARMACY_ROUTES.APPOINTMENTS_BASE}/${id}/status`,
      null,
      { params: { status, ...options } },
    );
    return res.data;
  }
  // appointmentDateTime is a zone-less IST wall clock — never an ISO instant with a Z.
  async rescheduleAppointment(
    id: number,
    appointmentDateTime: string,
    options: { userId?: number; reason?: string } = {},
  ): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.patch(
      `${PHARMACY_ROUTES.APPOINTMENTS_BASE}/${id}/schedule`,
      null,
      { params: { appointmentDateTime, ...options } },
    );
    return res.data;
  }
  // POST base/{id}/item/{itemId}/complete — see the parlour twin for why `itemId` is a string.
  async completeAppointmentItem(
    appointmentId: number,
    itemId: string,
  ): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.post(
      `${PHARMACY_ROUTES.APPOINTMENTS_BASE}/${appointmentId}/item/${itemId}/complete`,
    );
    return res.data;
  }
  async getAppointmentById(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.APPOINTMENTS_BASE}/${id}`);
    return res.data;
  }
  async createAppointment(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.post(PHARMACY_ROUTES.APPOINTMENTS_BASE, data);
    return res.data;
  }
  async updateAppointment(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.put(PHARMACY_ROUTES.APPOINTMENTS_BASE, data);
    return res.data;
  }
  async deleteAppointment(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.delete(`${PHARMACY_ROUTES.APPOINTMENTS_BASE}/${id}`);
    return res.data;
  }
  async getAppointmentsByCustomer(
    customerId: number,
    options: Record<string, unknown>,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(
      `${PHARMACY_ROUTES.APPOINTMENTS_BY_CUSTOMER}/${customerId}`,
      { params: options },
    );
    return res.data;
  }
  async getBillableAppointments(
    customerId: number,
    options: BillableListOptions,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(
      `${PHARMACY_ROUTES.APPOINTMENTS_BY_CUSTOMER}/${customerId}/billable`,
      { params: options },
    );
    return res.data;
  }
  async getBillById(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.BILLS_BASE}/${id}`);
    return res.data;
  }
  async getBillsByBusiness(
    businessId: number,
    page = 1,
    limit = 20,
    options: BillListOptions = {},
  ): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.BILLS_BY_BUSINESS}/${businessId}`, {
      params: { page, limit, ...options },
    });
    return res.data;
  }
  async getBillSummary(businessId: number): Promise<ApiResponse<BillSummary>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.BILLS_SUMMARY, {
      params: { businessId },
    });
    return res.data;
  }
  // Status-only PATCH, never the full PUT: that rebuilds the bill from a complete request body and
  // a partial one silently wipes its lines. Cancelling here also un-links the billed
  // orders/appointments and restocks bill-owned bare lines, server-side.
  async updateBillStatus(id: number, billStatus: string): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.patch(`${PHARMACY_ROUTES.BILLS_BASE}/${id}/status`, null, {
      params: { billStatus },
    });
    return res.data;
  }
  // paidAmount is required for PARTIALLY_PAID, refundedAmount for PARTIAL_REFUNDED — the server
  // 400s otherwise rather than silently settling to zero.
  async updateBillPayment(
    id: number,
    paymentStatus: string,
    options: { paidAmount?: number; refundedAmount?: number } = {},
  ): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.patch(`${PHARMACY_ROUTES.BILLS_BASE}/${id}/payment`, null, {
      params: { paymentStatus, ...options },
    });
    return res.data;
  }
  async getBillsByCustomer(customerId: number): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.BILLS_BY_CUSTOMER}/${customerId}`);
    return res.data;
  }
  async createBill(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.post(PHARMACY_ROUTES.BILLS_BASE, data);
    return res.data;
  }
  async updateBill(billId: number, data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.put(`${PHARMACY_ROUTES.BILLS_BASE}/${billId}`, data);
    return res.data;
  }
  async deleteBill(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.delete(`${PHARMACY_ROUTES.BILLS_BASE}/${id}`);
    return res.data;
  }
  // ── Inventory ──────────────────────────────────────────────────────────────
  // No update method: batches are immutable and the backend has no PUT. See the interface.
  async addInventoryBatch(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    // The trailing slash matters — `@PostMapping("/")` does not match a bare `/pharmacyInventory`.
    const res = await pharmacyApiClient.post(`${PHARMACY_ROUTES.INVENTORY_BASE}/`, data);
    return res.data;
  }
  async getInventoryBatch(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.INVENTORY_BASE}/${id}`);
    return res.data;
  }
  async getInventoryBatchesByProduct(
    itemId: number,
    businessId: number,
    inventoryType?: InventoryType | null,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.INVENTORY_BY_PRODUCT, {
      // `itemId`, not `productId` — see the parlour impl.
      params: compactParams({ itemId, businessId, inventoryType }),
    });
    return res.data;
  }
  async getInventoryBatchesByBusiness(
    businessId: number,
    query: InventoryQuery = {},
    page = 1,
    limit = 20,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.INVENTORY_BY_BUSINESS, {
      // Paging is 1-BASED and the size param is `limit`, not `size`.
      params: compactParams({ businessId, page, limit, ...query }),
    });
    return res.data;
  }
  async getInventoryStatusCounts(
    businessId: number,
    query: InventoryQuery = {},
  ): Promise<ApiResponse<InventoryStatusCounts>> {
    const { status: _ignored, sortBy: _s, sortDir: _d, ...filters } = query;
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.INVENTORY_STATUS_COUNTS, {
      params: compactParams({ businessId, ...filters }),
    });
    return res.data;
  }
  async getTotalStock(
    itemId: number,
    businessId: number,
    inventoryType?: InventoryType | null,
  ): Promise<ApiResponse<number>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.INVENTORY_TOTAL_STOCK, {
      params: compactParams({ itemId, businessId, inventoryType }),
    });
    return res.data;
  }
  async isAvailable(
    itemId: number,
    businessId: number,
    inventoryType?: InventoryType | null,
  ): Promise<ApiResponse<boolean>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.INVENTORY_IS_AVAILABLE, {
      params: compactParams({ itemId, businessId, inventoryType }),
    });
    return res.data;
  }
  async getExpiringBatches(
    businessId: number,
    withinDays: number,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.INVENTORY_EXPIRING, {
      params: { businessId, withinDays },
    });
    return res.data;
  }
  async getAllowedTransitions(id: number): Promise<ApiResponse<InventoryStatus[]>> {
    const res = await pharmacyApiClient.get(
      `${PHARMACY_ROUTES.INVENTORY_BASE}/${id}/allowedTransitions`,
    );
    return res.data;
  }
  async updateBatchStatus(
    id: number,
    status: InventoryStatus,
    options: StatusChangeOptions = {},
  ): Promise<ApiResponse<unknown>> {
    // PATCH, not PUT, and everything rides as QUERY PARAMS — there is no request body.
    const res = await pharmacyApiClient.patch(
      `${PHARMACY_ROUTES.INVENTORY_BASE}/${id}/status`,
      null,
      { params: compactParams({ status, ...options }) },
    );
    return res.data;
  }
  async deleteInventoryBatch(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.delete(`${PHARMACY_ROUTES.INVENTORY_BASE}/${id}`);
    return res.data;
  }
  async disposeBatch(batchId: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.post(`${PHARMACY_ROUTES.WASTAGE_DISPOSE}/${batchId}`);
    return res.data;
  }

  // ─── Consumption ───────────────────────────────────────────────────────────
  // Mirror of the parlour slice — see it for the trailing-slash and 1-based-paging notes.
  async createConsumption(data: ConsumptionPayload): Promise<ApiResponse<unknown>> {
    // ⚠️ The trailing slash matters — see the parlour impl.
    const res = await pharmacyApiClient.post(`${PHARMACY_ROUTES.CONSUMPTION_BASE}/`, data);
    return res.data;
  }
  async getConsumption(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.CONSUMPTION_BASE}/${id}`);
    return res.data;
  }
  async getConsumptionsByBusiness(
    businessId: number,
    query: ConsumptionQuery = {},
    page = 1,
    limit = 20,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.CONSUMPTION_BY_BUSINESS, {
      // compactParams and 1-based paging — see the parlour impl.
      params: compactParams({ businessId, page, limit, ...query }),
    });
    return res.data;
  }
  async deleteConsumption(id: number): Promise<ApiResponse<unknown>> {
    // Deleting RESTOCKS what was consumed.
    const res = await pharmacyApiClient.delete(`${PHARMACY_ROUTES.CONSUMPTION_BASE}/${id}`);
    return res.data;
  }

  // ─── Wastage ───────────────────────────────────────────────────────────────
  // Empty on purpose — copy the consumption slice above.

  // ─── Stock Transfer ────────────────────────────────────────────────────────
  // Mirror of the parlour slice — read that file for the trailing-slash and 1-based-paging traps.
  async createStockTransfer(data: StockTransferPayload): Promise<ApiResponse<unknown>> {
    // ⚠️ TRAILING SLASH — see the parlour twin.
    const res = await pharmacyApiClient.post(`${PHARMACY_ROUTES.STOCK_TRANSFER_BASE}/`, data);
    return res.data;
  }
  async getStockTransfer(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.STOCK_TRANSFER_BASE}/${id}`);
    return res.data;
  }
  async getStockTransfersByBusiness(
    businessId: number,
    query: StockTransferQuery = {},
    page = 1,
    limit = 20,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.STOCK_TRANSFER_BY_BUSINESS, {
      params: compactParams({ businessId, page, limit, ...query }),
    });
    return res.data;
  }
  async deleteStockTransfer(id: number): Promise<ApiResponse<unknown>> {
    // Deleting REVERSES the move. 409 `STOCK_MOVEMENT_LOCKED` once the destination batch is used.
    const res = await pharmacyApiClient.delete(`${PHARMACY_ROUTES.STOCK_TRANSFER_BASE}/${id}`);
    return res.data;
  }
}
