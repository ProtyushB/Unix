import type {
  InventoryQuery,
  InventoryStatus,
  InventoryType,
  StatusChangeOptions,
} from '../../shared/inventory.types';
import type { ConsumptionPayload, ConsumptionQuery } from '../../shared/consumption.types';
import { isConsumptionReason } from '../../shared/consumption.types';
import type { WastagePayload, WastageQuery } from '../../shared/wastage.types';
import { isWastageReason } from '../../shared/wastage.types';
import {
  PharmacyApiInterface,
  BillableListOptions,
  ProductListOptions,
  ServiceListOptions,
  OrderListOptions,
  AppointmentListOptions,
  BillListOptions,
} from '../api/pharmacy.api.interface';

export class PharmacyService {
  constructor(private api: PharmacyApiInterface) {}

  async getAllProducts(businessId: number, page = 1, limit = 10, options: ProductListOptions = {}) {
    if (!businessId) throw new Error('Business ID is required');
    return this.api.getAllProducts(businessId, page, limit, options);
  }
  async updateProductTracking(id: number, trackInventory: boolean) {
    if (!id) throw new Error('Product ID is required');
    return this.api.updateProductTracking(id, trackInventory);
  }
  async getProductById(id: number) {
    return this.api.getProductById(id);
  }
  async createProduct(data: Record<string, unknown>) {
    if (!data.name || !data.businessId) throw new Error('Name and Business ID are required');
    return this.api.createProduct(data);
  }
  async updateProduct(data: Record<string, unknown>) {
    if (!data.id) throw new Error('Product ID is required for update');
    return this.api.updateProduct(data);
  }
  async deleteProduct(id: number) {
    return this.api.deleteProduct(id);
  }
  async ensureEntityFolder(params: {
    businessId: number;
    type: 'PRODUCT' | 'SERVICE';
    entityId: number;
    entityName?: string;
    currentFolderId?: number | null;
  }) {
    // The entity must already be saved — the backend names the folder after its id.
    if (!params?.businessId || !params?.entityId) {
      throw new Error('Business ID and entity ID are required');
    }
    return this.api.ensureEntityFolder(params);
  }

  async getAllServices(businessId: number, page = 1, limit = 10, options: ServiceListOptions = {}) {
    if (!businessId) throw new Error('Business ID is required');
    return this.api.getAllServices(businessId, page, limit, options);
  }
  async updateServiceAvailability(id: number, availability: boolean) {
    if (!id) throw new Error('Service ID is required');
    return this.api.updateServiceAvailability(id, availability);
  }
  async getServiceById(id: number) {
    return this.api.getServiceById(id);
  }
  async createService(data: Record<string, unknown>) {
    if (!data.name || !data.businessId) throw new Error('Name and Business ID are required');
    return this.api.createService(data);
  }
  async updateService(data: Record<string, unknown>) {
    if (!data.id) throw new Error('Service ID is required for update');
    return this.api.updateService(data);
  }
  async deleteService(id: number) {
    return this.api.deleteService(id);
  }

  async getAllOrders(businessId: number, page = 1, limit = 10, options: OrderListOptions = {}) {
    if (!businessId) throw new Error('Business ID is required');
    return this.api.getAllOrders(businessId, page, limit, options);
  }
  async getOrderSummary(businessId: number, options: { fromDate?: string; toDate?: string } = {}) {
    if (!businessId) throw new Error('Business ID is required');
    return this.api.getOrderSummary(businessId, options);
  }
  async updateOrderStatus(
    id: number,
    status: string,
    options: { userId?: number; reason?: string } = {},
  ) {
    if (!id) throw new Error('Order ID is required');
    if (!status) throw new Error('Status is required');
    return this.api.updateOrderStatus(id, status, options);
  }
  async getOrderById(id: number) {
    return this.api.getOrderById(id);
  }
  async createOrder(data: Record<string, unknown>) {
    if (!data.customerId || !data.businessId)
      throw new Error('Customer ID and Business ID are required');
    return this.api.createOrder(data);
  }
  async updateOrder(data: Record<string, unknown>) {
    if (!data.id) throw new Error('Order ID is required for update');
    return this.api.updateOrder(data);
  }
  async deleteOrder(id: number) {
    return this.api.deleteOrder(id);
  }
  async getOrdersByCustomer(customerId: number, options = {}) {
    return this.api.getOrdersByCustomer(customerId, options);
  }
  async getBillableOrders(customerId: number, options: BillableListOptions) {
    if (!customerId) throw new Error('Customer ID is required');
    if (!options?.businessId) throw new Error('Business ID is required');
    return this.api.getBillableOrders(customerId, options);
  }

  async getAllAppointments(
    businessId: number,
    page = 1,
    limit = 10,
    options: AppointmentListOptions = {},
  ) {
    if (!businessId) throw new Error('Business ID is required');
    return this.api.getAllAppointments(businessId, page, limit, options);
  }
  async getAppointmentDayCounts(businessId: number, options: { fromDate: string; toDate: string }) {
    if (!businessId) throw new Error('Business ID is required');
    // Both bounds are mandatory server-side — an unbounded day map is unbounded output.
    if (!options?.fromDate || !options?.toDate) throw new Error('fromDate and toDate are required');
    return this.api.getAppointmentDayCounts(businessId, options);
  }
  async updateAppointmentStatus(
    id: number,
    status: string,
    options: { userId?: number; reason?: string } = {},
  ) {
    if (!id) throw new Error('Appointment ID is required');
    if (!status) throw new Error('Status is required');
    return this.api.updateAppointmentStatus(id, status, options);
  }
  async rescheduleAppointment(
    id: number,
    appointmentDateTime: string,
    options: { userId?: number; reason?: string } = {},
  ) {
    if (!id) throw new Error('Appointment ID is required');
    if (!appointmentDateTime) throw new Error('Appointment date and time is required');
    return this.api.rescheduleAppointment(id, appointmentDateTime, options);
  }
  async completeAppointmentItem(appointmentId: number, itemId: string) {
    if (!appointmentId) throw new Error('Appointment ID is required');
    if (!itemId) throw new Error('Item ID is required');
    return this.api.completeAppointmentItem(appointmentId, itemId);
  }
  async getAppointmentById(id: number) {
    return this.api.getAppointmentById(id);
  }
  async createAppointment(data: Record<string, unknown>) {
    if (!data.customerId || !data.businessId)
      throw new Error('Customer ID and Business ID are required');
    return this.api.createAppointment(data);
  }
  async updateAppointment(data: Record<string, unknown>) {
    if (!data.id) throw new Error('Appointment ID is required for update');
    return this.api.updateAppointment(data);
  }
  async deleteAppointment(id: number) {
    return this.api.deleteAppointment(id);
  }
  async getAppointmentsByCustomer(customerId: number, options = {}) {
    return this.api.getAppointmentsByCustomer(customerId, options);
  }
  async getBillableAppointments(customerId: number, options: BillableListOptions) {
    if (!customerId) throw new Error('Customer ID is required');
    if (!options?.businessId) throw new Error('Business ID is required');
    return this.api.getBillableAppointments(customerId, options);
  }

  async getBillById(id: number) {
    return this.api.getBillById(id);
  }
  async getBillsByBusiness(
    businessId: number,
    page = 1,
    limit = 20,
    options: BillListOptions = {},
  ) {
    if (!businessId) throw new Error('Business ID is required');
    return this.api.getBillsByBusiness(businessId, page, limit, options);
  }
  async getBillSummary(businessId: number) {
    if (!businessId) throw new Error('Business ID is required');
    return this.api.getBillSummary(businessId);
  }
  async updateBillStatus(id: number, billStatus: string) {
    if (!id) throw new Error('Bill ID is required');
    if (!billStatus) throw new Error('Bill status is required');
    return this.api.updateBillStatus(id, billStatus);
  }
  async updateBillPayment(
    id: number,
    paymentStatus: string,
    options: { paidAmount?: number; refundedAmount?: number } = {},
  ) {
    if (!id) throw new Error('Bill ID is required');
    if (!paymentStatus) throw new Error('Payment status is required');
    // Guard here as well as server-side: catching it before the round trip gives the sheet a
    // synchronous error instead of a 400 the user waits for.
    if (paymentStatus === 'PARTIALLY_PAID' && options.paidAmount == null) {
      throw new Error('paidAmount is required when marking a bill partially paid');
    }
    if (paymentStatus === 'PARTIAL_REFUNDED' && options.refundedAmount == null) {
      throw new Error('refundedAmount is required when marking a bill partially refunded');
    }
    return this.api.updateBillPayment(id, paymentStatus, options);
  }
  async getBillsByCustomer(customerId: number) {
    return this.api.getBillsByCustomer(customerId);
  }
  async createBill(data: Record<string, unknown>) {
    return this.api.createBill(data);
  }
  async updateBill(billId: number, data: Record<string, unknown>) {
    return this.api.updateBill(billId, data);
  }
  async deleteBill(id: number) {
    return this.api.deleteBill(id);
  }

  // ── Inventory ──────────────────────────────────────────────────────────────
  // No update passthrough: batches are immutable and the backend has no PUT.
  async addInventoryBatch(data: Record<string, unknown>) {
    return this.api.addInventoryBatch(data);
  }
  async getInventoryBatch(id: number) {
    return this.api.getInventoryBatch(id);
  }
  async getInventoryBatchesByProduct(
    itemId: number,
    businessId: number,
    inventoryType?: InventoryType | null,
  ) {
    return this.api.getInventoryBatchesByProduct(itemId, businessId, inventoryType);
  }
  async getInventoryBatchesByBusiness(
    businessId: number,
    query: InventoryQuery = {},
    page = 1,
    limit = 20,
  ) {
    return this.api.getInventoryBatchesByBusiness(businessId, query, page, limit);
  }
  async getInventoryStatusCounts(businessId: number, query: InventoryQuery = {}) {
    return this.api.getInventoryStatusCounts(businessId, query);
  }
  async getTotalStock(itemId: number, businessId: number, inventoryType?: InventoryType | null) {
    return this.api.getTotalStock(itemId, businessId, inventoryType);
  }
  async isAvailable(itemId: number, businessId: number, inventoryType?: InventoryType | null) {
    return this.api.isAvailable(itemId, businessId, inventoryType);
  }
  async getExpiringBatches(businessId: number, withinDays = 30) {
    return this.api.getExpiringBatches(businessId, withinDays);
  }
  async getAllowedTransitions(id: number) {
    return this.api.getAllowedTransitions(id);
  }
  async updateBatchStatus(id: number, status: InventoryStatus, options: StatusChangeOptions = {}) {
    return this.api.updateBatchStatus(id, status, options);
  }
  async deleteInventoryBatch(id: number) {
    return this.api.deleteInventoryBatch(id);
  }
  async disposeBatch(batchId: number) {
    return this.api.disposeBatch(batchId);
  }

  // ─── Consumption ───────────────────────────────────────────────────────────
  // Mirror of the parlour slice — see it for why the reason guard and the paging clamp live in this
  // layer rather than in the impl or the screen.
  async createConsumption(data: ConsumptionPayload) {
    if (!data?.businessId) throw new Error('Business ID is required');
    if (!data?.itemId) throw new Error('A product is required');
    // ⚠️ A bad enum is an HTTP 500, not a 400 — throw locally instead. See the parlour service.
    if (!isConsumptionReason(data?.reason)) throw new Error('Pick a valid consumption reason');
    if (!(Number(data?.quantity) > 0)) throw new Error('Quantity must be more than zero');
    return this.api.createConsumption(data);
  }
  async getConsumption(id: number) {
    if (!id) throw new Error('Consumption ID is required');
    return this.api.getConsumption(id);
  }
  async getConsumptionsByBusiness(
    businessId: number,
    query: ConsumptionQuery = {},
    page = 1,
    limit = 20,
  ) {
    if (!businessId) throw new Error('Business ID is required');
    // ⚠️ `page` is 1-BASED; `page=0` is a 400. See the parlour service.
    return this.api.getConsumptionsByBusiness(businessId, query, Math.max(1, page), limit);
  }
  async deleteConsumption(id: number) {
    if (!id) throw new Error('Consumption ID is required');
    return this.api.deleteConsumption(id);
  }

  // ─── Wastage ───────────────────────────────────────────────────────────────
  // Mirror of the parlour slice — see it for why the reason guard and the paging clamp live in this
  // layer, and for why `batchId` rather than `itemId` is the field that must be present.
  async createWastage(data: WastagePayload) {
    if (!data?.businessId) throw new Error('Business ID is required');
    // ⚠️ `batchId`, not `itemId` — a wastage is addressed by the batch. See the parlour service.
    if (!data?.batchId) throw new Error('No stock is available to write off');
    // ⚠️ A bad enum is an HTTP 500, not a 400 — throw locally instead. Accepts all EIGHT reasons,
    // CORRECTION included: this guards the wire, not the chip list.
    if (!isWastageReason(data?.reason)) throw new Error('Pick a valid wastage reason');
    if (!(Number(data?.quantity) > 0)) throw new Error('Quantity must be more than zero');
    return this.api.createWastage(data);
  }
  async getWastage(id: number) {
    if (!id) throw new Error('Wastage ID is required');
    return this.api.getWastage(id);
  }
  async getWastageByBusiness(businessId: number, query: WastageQuery = {}, page = 1, limit = 20) {
    if (!businessId) throw new Error('Business ID is required');
    // ⚠️ `page` is 1-BASED; `page=0` is a 400. See the parlour service.
    return this.api.getWastageByBusiness(businessId, query, Math.max(1, page), limit);
  }
  async deleteWastage(id: number) {
    if (!id) throw new Error('Wastage ID is required');
    return this.api.deleteWastage(id);
  }

  // ─── Stock Transfer ────────────────────────────────────────────────────────
  // Empty on purpose — copy the consumption slice above.
}
