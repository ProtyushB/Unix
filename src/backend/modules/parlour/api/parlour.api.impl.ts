import {
  ParlourApiInterface,
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
} from './parlour.api.interface';
import parlourApiClient from '../config/axios.instance';
import { PARLOUR_ROUTES } from '../config/api.config';
import {
  compactParams,
  type InventoryQuery,
  type InventoryStatus,
  type InventoryStatusCounts,
  type InventoryType,
  type StatusChangeOptions,
} from '../../shared/inventory.types';
import type { ConsumptionPayload, ConsumptionQuery } from '../../shared/consumption.types';
import type { WastagePayload, WastageQuery } from '../../shared/wastage.types';
import type { StockTransferPayload, StockTransferQuery } from '../../shared/stockTransfer.types';

export class ParlourApiImpl extends ParlourApiInterface {
  // ── Products ───────────────────────────────────────────────────────────────
  async getAllProducts(
    businessId: number,
    page: number,
    limit: number,
    options: ProductListOptions = {},
  ): Promise<ProductListResponse> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.PRODUCTS_VIEW_ALL, {
      params: { businessId, page, limit, ...options },
    });
    return res.data;
  }
  // Tracking-only PATCH, never the full PUT: that copies the whole request body over the record and
  // rebuilds the sale-unit ladder, so a partial body would silently destroy it.
  async updateProductTracking(id: number, trackInventory: boolean): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.patch(
      `${PARLOUR_ROUTES.PRODUCTS_BASE}/${id}/tracking`,
      null,
      { params: { trackInventory } },
    );
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
  async ensureEntityFolder(params: {
    businessId: number;
    type: 'PRODUCT' | 'SERVICE';
    entityId: number;
    entityName?: string;
    currentFolderId?: number | null;
  }): Promise<ApiResponse<Record<string, number>>> {
    const res = await parlourApiClient.post(PARLOUR_ROUTES.DMS_ENTITY_FOLDER, params);
    return res.data;
  }

  // ── Services ───────────────────────────────────────────────────────────────
  async getAllServices(
    businessId: number,
    page: number,
    limit: number,
    options: ServiceListOptions = {},
  ): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.SERVICES_VIEW_ALL, {
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
    const res = await parlourApiClient.patch(
      `${PARLOUR_ROUTES.SERVICES_BASE}/${id}/availability`,
      null,
      { params: { availability } },
    );
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
  async getAllOrders(
    businessId: number,
    page: number,
    limit: number,
    options: OrderListOptions = {},
  ): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.ORDERS_VIEW_ALL, {
      params: { businessId, page, limit, ...options },
    });
    return res.data;
  }
  async getOrderSummary(
    businessId: number,
    options: { fromDate?: string; toDate?: string } = {},
  ): Promise<ApiResponse<OrderSummary>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.ORDERS_SUMMARY, {
      params: { businessId, ...options },
    });
    return res.data;
  }
  async updateOrderStatus(
    id: number,
    status: string,
    options: { userId?: number; reason?: string } = {},
  ): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.patch(`${PARLOUR_ROUTES.ORDERS_BASE}/${id}/status`, null, {
      params: { status, ...options },
    });
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
  async getOrdersByCustomer(
    customerId: number,
    options: Record<string, unknown>,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.ORDERS_BY_CUSTOMER}/${customerId}`, {
      params: options,
    });
    return res.data;
  }
  // `/billable` hangs off the same customer segment, so it reuses the route constant rather than
  // adding a near-duplicate one. Distinct from getOrdersByCustomer: that returns the customer's
  // whole history, this returns only what is not already on a bill.
  async getBillableOrders(
    customerId: number,
    options: BillableListOptions,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(
      `${PARLOUR_ROUTES.ORDERS_BY_CUSTOMER}/${customerId}/billable`,
      { params: options },
    );
    return res.data;
  }

  // ── Appointments ───────────────────────────────────────────────────────────
  async getAllAppointments(
    businessId: number,
    page: number,
    limit: number,
    options: AppointmentListOptions = {},
  ): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.APPOINTMENTS_VIEW_ALL, {
      params: { businessId, page, limit, ...options },
    });
    return res.data;
  }
  async getAppointmentDayCounts(
    businessId: number,
    options: { fromDate: string; toDate: string },
  ): Promise<ApiResponse<AppointmentDayCounts>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.APPOINTMENTS_DAY_COUNTS, {
      params: { businessId, ...options },
    });
    return res.data;
  }
  async updateAppointmentStatus(
    id: number,
    status: string,
    options: { userId?: number; reason?: string } = {},
  ): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.patch(
      `${PARLOUR_ROUTES.APPOINTMENTS_BASE}/${id}/status`,
      null,
      { params: { status, ...options } },
    );
    return res.data;
  }
  // appointmentDateTime is a zone-less IST wall clock ("2025-04-24T14:30:00"), matching create and
  // update. Never send an ISO instant with a Z — the server re-reads it as IST and lands 5h30m off.
  async rescheduleAppointment(
    id: number,
    appointmentDateTime: string,
    options: { userId?: number; reason?: string } = {},
  ): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.patch(
      `${PARLOUR_ROUTES.APPOINTMENTS_BASE}/${id}/schedule`,
      null,
      { params: { appointmentDateTime, ...options } },
    );
    return res.data;
  }
  // POST base/{id}/item/{itemId}/complete. `itemId` is a STRING, not a number: the server matches
  // a fulfillment UUID, a standalone item UUID, or a legacy numeric serviceId — and only it knows
  // which of the three it is looking at.
  async completeAppointmentItem(
    appointmentId: number,
    itemId: string,
  ): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.post(
      `${PARLOUR_ROUTES.APPOINTMENTS_BASE}/${appointmentId}/item/${itemId}/complete`,
    );
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
  async getAppointmentsByCustomer(
    customerId: number,
    options: Record<string, unknown>,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(
      `${PARLOUR_ROUTES.APPOINTMENTS_BY_CUSTOMER}/${customerId}`,
      { params: options },
    );
    return res.data;
  }
  async getBillableAppointments(
    customerId: number,
    options: BillableListOptions,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(
      `${PARLOUR_ROUTES.APPOINTMENTS_BY_CUSTOMER}/${customerId}/billable`,
      { params: options },
    );
    return res.data;
  }

  // ── Bills ──────────────────────────────────────────────────────────────────
  async getBillById(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.BILLS_BASE}/${id}`);
    return res.data;
  }
  async getBillsByBusiness(
    businessId: number,
    page = 1,
    limit = 20,
    options: BillListOptions = {},
  ): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.BILLS_BY_BUSINESS}/${businessId}`, {
      params: { page, limit, ...options },
    });
    return res.data;
  }
  async getBillSummary(businessId: number): Promise<ApiResponse<BillSummary>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.BILLS_SUMMARY, {
      params: { businessId },
    });
    return res.data;
  }
  // Status-only PATCH, never the full PUT: that rebuilds the bill from a complete request body and
  // a partial one silently wipes its lines. Cancelling here also un-links the billed
  // orders/appointments and restocks bill-owned bare lines, server-side.
  async updateBillStatus(id: number, billStatus: string): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.patch(`${PARLOUR_ROUTES.BILLS_BASE}/${id}/status`, null, {
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
    const res = await parlourApiClient.patch(`${PARLOUR_ROUTES.BILLS_BASE}/${id}/payment`, null, {
      params: { paymentStatus, ...options },
    });
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
  // No update method: batches are immutable and the backend has no PUT. See the interface.
  async addInventoryBatch(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    // The trailing slash matters — `@PostMapping("/")` does not match a bare `/parlourInventory`.
    const res = await parlourApiClient.post(`${PARLOUR_ROUTES.INVENTORY_BASE}/`, data);
    return res.data;
  }
  async getInventoryBatch(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.INVENTORY_BASE}/${id}`);
    return res.data;
  }
  async getInventoryBatchesByProduct(
    itemId: number,
    businessId: number,
    inventoryType?: InventoryType | null,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.INVENTORY_BY_PRODUCT, {
      // `itemId`, not `productId` — the server reads the former and ignores the latter, which is
      // how this silently returned every batch regardless of product.
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
    const res = await parlourApiClient.get(PARLOUR_ROUTES.INVENTORY_BY_BUSINESS, {
      // Paging is 1-BASED and the size param is `limit`, not `size`.
      params: compactParams({ businessId, page, limit, ...query }),
    });
    return res.data;
  }
  async getInventoryStatusCounts(
    businessId: number,
    query: InventoryQuery = {},
  ): Promise<ApiResponse<InventoryStatusCounts>> {
    // `status` is deliberately dropped: the endpoint groups by it, and sending one would zero every
    // chip but the selected one.
    const { status: _ignored, sortBy: _s, sortDir: _d, ...filters } = query;
    const res = await parlourApiClient.get(PARLOUR_ROUTES.INVENTORY_STATUS_COUNTS, {
      params: compactParams({ businessId, ...filters }),
    });
    return res.data;
  }
  async getTotalStock(
    itemId: number,
    businessId: number,
    inventoryType?: InventoryType | null,
  ): Promise<ApiResponse<number>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.INVENTORY_TOTAL_STOCK, {
      params: compactParams({ itemId, businessId, inventoryType }),
    });
    return res.data;
  }
  async isAvailable(
    itemId: number,
    businessId: number,
    inventoryType?: InventoryType | null,
  ): Promise<ApiResponse<boolean>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.INVENTORY_IS_AVAILABLE, {
      params: compactParams({ itemId, businessId, inventoryType }),
    });
    return res.data;
  }
  async getExpiringBatches(
    businessId: number,
    withinDays: number,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.INVENTORY_EXPIRING, {
      params: { businessId, withinDays },
    });
    return res.data;
  }
  async getAllowedTransitions(id: number): Promise<ApiResponse<InventoryStatus[]>> {
    const res = await parlourApiClient.get(
      `${PARLOUR_ROUTES.INVENTORY_BASE}/${id}/allowedTransitions`,
    );
    return res.data;
  }
  async updateBatchStatus(
    id: number,
    status: InventoryStatus,
    options: StatusChangeOptions = {},
  ): Promise<ApiResponse<unknown>> {
    // PATCH, not PUT, and everything rides as QUERY PARAMS — there is no request body.
    const res = await parlourApiClient.patch(
      `${PARLOUR_ROUTES.INVENTORY_BASE}/${id}/status`,
      null,
      { params: compactParams({ status, ...options }) },
    );
    return res.data;
  }
  async deleteInventoryBatch(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.delete(`${PARLOUR_ROUTES.INVENTORY_BASE}/${id}`);
    return res.data;
  }
  async disposeBatch(batchId: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.post(`${PARLOUR_ROUTES.WASTAGE_DISPOSE}/${batchId}`);
    return res.data;
  }

  // ─── Consumption ───────────────────────────────────────────────────────────
  // The WORKED EXAMPLE for all three stock-movement features. Two of the family's three traps are
  // visible here; the third (a bad enum being a 500 rather than a 400) is solved one layer up, in
  // `parlour.service.ts`, because the fix is to never make the call.
  //
  // No update method: a consumption is immutable and the backend has no PUT.
  async createConsumption(data: ConsumptionPayload): Promise<ApiResponse<unknown>> {
    // ⚠️ TRAP 1 — the TRAILING SLASH. `@PostMapping("/")` does not match a bare
    // `/parlourConsumption`: the request 404s, and the body says nothing about why. Precedent and
    // proof it is not a one-off: `addInventoryBatch` above needs exactly the same slash.
    const res = await parlourApiClient.post(`${PARLOUR_ROUTES.CONSUMPTION_BASE}/`, data);
    return res.data;
  }
  async getConsumption(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.CONSUMPTION_BASE}/${id}`);
    return res.data;
  }
  async getConsumptionsByBusiness(
    businessId: number,
    query: ConsumptionQuery = {},
    page = 1,
    limit = 20,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.CONSUMPTION_BY_BUSINESS, {
      // `compactParams`, never a bare spread: axios serialises `{reason: null}` as `reason=`, and
      // Spring binds that empty string to a blank enum and answers 400 instead of reading it as
      // "no filter". Dropping the key is the difference between an unfiltered list and an error.
      //
      // ⚠️ TRAP 2 — paging is 1-BASED and the size param is `limit`, not `size`. The clamp lives
      // in the service so it cannot be skipped by a caller that reaches straight for the impl.
      params: compactParams({ businessId, page, limit, ...query }),
    });
    return res.data;
  }
  async deleteConsumption(id: number): Promise<ApiResponse<unknown>> {
    // Deleting RESTOCKS what was consumed — a reversal, not a tidy-up.
    const res = await parlourApiClient.delete(`${PARLOUR_ROUTES.CONSUMPTION_BASE}/${id}`);
    return res.data;
  }

  // ─── Wastage ───────────────────────────────────────────────────────────────
  // The consumption slice with wastage's routes and types. Same three traps, same answers; the enum
  // one is solved a layer up in `parlour.service.ts`, because the fix is to never make the call.
  //
  // No update method: a wastage is immutable and the backend has no PUT.
  async createWastage(data: WastagePayload): Promise<ApiResponse<unknown>> {
    // ⚠️ TRAP 1 — the TRAILING SLASH. `@PostMapping("/")` does not match a bare `/parlourWastage`:
    // the request 404s with nothing in the body to say why. Same slash `addInventoryBatch` and
    // `createConsumption` need.
    const res = await parlourApiClient.post(`${PARLOUR_ROUTES.WASTAGE_BASE}/`, data);
    return res.data;
  }
  async getWastage(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.WASTAGE_BASE}/${id}`);
    return res.data;
  }
  async getWastageByBusiness(
    businessId: number,
    query: WastageQuery = {},
    page = 1,
    limit = 20,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.WASTAGE_BY_BUSINESS, {
      // `compactParams`, never a bare spread: axios serialises `{reason: null}` as `reason=`, which
      // Spring binds to a blank enum and answers 400 instead of reading as "no filter".
      //
      // ⚠️ TRAP 2 — paging is 1-BASED and the size param is `limit`, not `size`. The clamp lives in
      // the service so a caller reaching straight for the impl cannot skip it.
      params: compactParams({ businessId, page, limit, ...query }),
    });
    return res.data;
  }
  async deleteWastage(id: number): Promise<ApiResponse<unknown>> {
    // Deleting RESTOCKS what was written off — a reversal, not a tidy-up.
    const res = await parlourApiClient.delete(`${PARLOUR_ROUTES.WASTAGE_BASE}/${id}`);
    return res.data;
  }

  // ─── Stock Transfer ────────────────────────────────────────────────────────
  // The same two traps the consumption slice above carries, for the same reasons. The third (a bad
  // enum being a 500 rather than a 400) is solved one layer up, in `parlour.service.ts`.
  //
  // No update method: a transfer is immutable and the backend has no PUT.
  async createStockTransfer(data: StockTransferPayload): Promise<ApiResponse<unknown>> {
    // ⚠️ TRAP 1 — the TRAILING SLASH. `@PostMapping("/")` does not match a bare
    // `/parlourStockTransfer`: the request 404s and the body says nothing about why.
    const res = await parlourApiClient.post(`${PARLOUR_ROUTES.STOCK_TRANSFER_BASE}/`, data);
    return res.data;
  }
  async getStockTransfer(id: number): Promise<ApiResponse<unknown>> {
    const res = await parlourApiClient.get(`${PARLOUR_ROUTES.STOCK_TRANSFER_BASE}/${id}`);
    return res.data;
  }
  async getStockTransfersByBusiness(
    businessId: number,
    query: StockTransferQuery = {},
    page = 1,
    limit = 20,
  ): Promise<ApiResponse<unknown[]>> {
    const res = await parlourApiClient.get(PARLOUR_ROUTES.STOCK_TRANSFER_BY_BUSINESS, {
      // `compactParams`, never a bare spread — see the consumption twin. There is no `reason` key
      // to compact here: the transfer controller reads none, and `StockTransferQuery` omits it so
      // that adding one is a compile error rather than a silently unfiltered list.
      //
      // ⚠️ TRAP 2 — paging is 1-BASED and the size param is `limit`, not `size`. The clamp lives in
      // the service so it cannot be skipped by a caller that reaches straight for the impl.
      params: compactParams({ businessId, page, limit, ...query }),
    });
    return res.data;
  }
  async deleteStockTransfer(id: number): Promise<ApiResponse<unknown>> {
    // Deleting REVERSES the move — the quantity goes back to the source pool and the minted
    // destination batch is removed. Refused with a 409 once that batch has been drawn from.
    const res = await parlourApiClient.delete(`${PARLOUR_ROUTES.STOCK_TRANSFER_BASE}/${id}`);
    return res.data;
  }
}
