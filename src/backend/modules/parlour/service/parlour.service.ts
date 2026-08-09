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
import type { StockTransferPayload, StockTransferQuery } from '../../shared/stockTransfer.types';
import { isStockTransferReason } from '../../shared/stockTransfer.types';
import type {
  ExpensePayload,
  ExpenseQuery,
  ExpenseUpdatePayload,
} from '../../shared/expense.types';
import {
  isExpenseCategory,
  isExpenseRecurrence,
  isExpenseSortKey,
  isPaymentMethod,
} from '../../shared/expense.types';
import {
  ParlourApiInterface,
  BillableListOptions,
  ProductListOptions,
  ServiceListOptions,
  OrderListOptions,
  AppointmentListOptions,
  BillListOptions,
} from '../api/parlour.api.interface';

export class ParlourService {
  constructor(private api: ParlourApiInterface) {}

  // Products
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

  // Services
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

  // Orders
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
    if (!customerId) throw new Error('Customer ID is required');
    return this.api.getOrdersByCustomer(customerId, options);
  }
  async getBillableOrders(customerId: number, options: BillableListOptions) {
    if (!customerId) throw new Error('Customer ID is required');
    if (!options?.businessId) throw new Error('Business ID is required');
    return this.api.getBillableOrders(customerId, options);
  }

  // Appointments
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
    if (!data.appointmentDateTime) throw new Error('Appointment date and time is required');
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
    if (!customerId) throw new Error('Customer ID is required');
    return this.api.getAppointmentsByCustomer(customerId, options);
  }
  async getBillableAppointments(customerId: number, options: BillableListOptions) {
    if (!customerId) throw new Error('Customer ID is required');
    if (!options?.businessId) throw new Error('Business ID is required');
    return this.api.getBillableAppointments(customerId, options);
  }

  // Bills
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
    if (!customerId) throw new Error('Customer ID is required');
    return this.api.getBillsByCustomer(customerId);
  }
  async createBill(data: Record<string, unknown>) {
    return this.api.createBill(data);
  }
  async updateBill(billId: number, data: Record<string, unknown>) {
    if (!billId) throw new Error('Bill ID is required for update');
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
  //
  // The WORKED EXAMPLE. This layer is not a passthrough for these endpoints — it is where the
  // family's third trap is solved, and where the paging clamp lives so no caller can skip it.
  //
  // No update passthrough: a consumption is immutable and the backend has no PUT.
  async createConsumption(data: ConsumptionPayload) {
    if (!data?.businessId) throw new Error('Business ID is required');
    if (!data?.itemId) throw new Error('A product is required');
    // ⚠️ TRAP 3 — a bad enum is an HTTP **500**, not a 400.
    //
    // Spring cannot bind an unknown constant into the request body's enum, so the handler never
    // runs: there is no validation error, no field name, and nothing in the response a screen could
    // turn into a message. The user sees "something went wrong" and no way forward.
    //
    // So the guard runs BEFORE the axios call and throws locally. Same reasoning as
    // `updateBillPayment`'s pre-flight checks: catching it here is a synchronous message instead of
    // an opaque failure the user waited for.
    if (!isConsumptionReason(data?.reason)) throw new Error('Pick a valid consumption reason');
    // Zero is not a consumption, and a negative one would restock. `> 0` rather than a truthiness
    // check so `'0'` and `NaN` are both refused rather than one of them slipping through.
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
    // ⚠️ TRAP 2 — `page` is 1-BASED. `page=0` is a 400, NOT "the first page", so an infinite-scroll
    // list whose counter starts at zero fails on its very first request rather than on page two.
    // Clamped here rather than at the call site because every caller would otherwise have to
    // remember, and the one that forgets breaks the whole screen.
    return this.api.getConsumptionsByBusiness(businessId, query, Math.max(1, page), limit);
  }
  async deleteConsumption(id: number) {
    if (!id) throw new Error('Consumption ID is required');
    return this.api.deleteConsumption(id);
  }

  // ─── Wastage ───────────────────────────────────────────────────────────────
  //
  // The consumption slice with wastage's types. Not a passthrough: this is where the bad-enum trap
  // is solved and where the paging clamp lives so no caller can skip it.
  //
  // No update passthrough: a wastage is immutable and the backend has no PUT.
  async createWastage(data: WastagePayload) {
    if (!data?.businessId) throw new Error('Business ID is required');
    // ⚠️ `batchId`, not `itemId`. A wastage is addressed by the BATCH it comes out of — the server
    // derives the product and the pool from it. A payload carrying only an itemId is a 400 that
    // names a field the form never showed anyone.
    if (!data?.batchId) throw new Error('No stock is available to write off');
    // ⚠️ TRAP 3 — a bad enum is an HTTP **500**, not a 400. Spring cannot bind an unknown constant
    // into the request body's enum, so the handler never runs: no validation error, no field name,
    // nothing a screen could turn into a message. The guard runs BEFORE the axios call.
    //
    // Note it accepts all EIGHT reasons, CORRECTION included. That is deliberate and is NOT the
    // same list the form's chips render from (`WASTAGE_REASON_CHOICES`, seven): this guards what
    // the wire may legally carry, not what a person may pick.
    if (!isWastageReason(data?.reason)) throw new Error('Pick a valid wastage reason');
    // Zero is not a write-off, and a negative one would restock. `> 0` rather than a truthiness
    // check so `'0'` and `NaN` are both refused.
    if (!(Number(data?.quantity) > 0)) throw new Error('Quantity must be more than zero');
    return this.api.createWastage(data);
  }
  async getWastage(id: number) {
    if (!id) throw new Error('Wastage ID is required');
    return this.api.getWastage(id);
  }
  async getWastageByBusiness(businessId: number, query: WastageQuery = {}, page = 1, limit = 20) {
    if (!businessId) throw new Error('Business ID is required');
    // ⚠️ TRAP 2 — `page` is 1-BASED. `page=0` is a 400, NOT "the first page", so a list whose
    // counter starts at zero fails on its very first request rather than on page two.
    return this.api.getWastageByBusiness(businessId, query, Math.max(1, page), limit);
  }
  async deleteWastage(id: number) {
    if (!id) throw new Error('Wastage ID is required');
    return this.api.deleteWastage(id);
  }

  // ─── Expense ───────────────────────────────────────────────────────────────
  //
  // The mutable one. Six passthroughs rather than four, and THREE enum guards rather than one —
  // category, payment method and recurrence each 500 the same way if a bad constant reaches Spring.
  private assertExpenseShape(data: ExpensePayload) {
    if (!data?.businessId) throw new Error('Business ID is required');
    if (!data?.title?.trim()) throw new Error('Give the expense a title');
    // ⚠️ TRAP 3 — a bad enum is an HTTP **500**, not a 400. Spring cannot bind an unknown constant
    // into the body's enum, so `@Valid` never runs: no field name, nothing a screen could show.
    // All three guards run BEFORE the axios call.
    if (!isExpenseCategory(data?.category)) throw new Error('Pick a valid category');
    // Null is the legal way to say "not specified" — `''` is NOT a member and would be a 500.
    if (data?.paymentMethod != null && !isPaymentMethod(data.paymentMethod)) {
      throw new Error('Pick a valid payment method');
    }
    // Null is legal here too and reads as NONE server-side.
    if (data?.recurrence != null && !isExpenseRecurrence(data.recurrence)) {
      throw new Error('Pick a valid recurrence');
    }
    // `@NotNull @Positive`. `> 0` rather than truthiness so `'0'` and `NaN` are both refused.
    if (!(Number(data?.amount) > 0)) throw new Error('Amount must be more than zero');
  }

  async createExpense(data: ExpensePayload) {
    this.assertExpenseShape(data);
    // ⚠️ Refused here rather than sent: `recordExpense` never clears these three and the mapper
    // copies them straight through, so a payload carrying them would persist an already-settled
    // expense and skip both of `markReimbursed`'s eligibility checks. They are not on
    // `ExpensePayload`, so this only catches an object widened past its type at runtime.
    const forged = data as unknown as Record<string, unknown>;
    if (forged.reimbursed != null || forged.reimbursedAt != null || forged.reimbursedBy != null) {
      throw new Error('Reimbursement is settled through its own action, not on create');
    }
    return this.api.createExpense(data);
  }
  async getExpense(id: number) {
    if (!id) throw new Error('Expense ID is required');
    return this.api.getExpense(id);
  }
  async getExpenseByBusiness(businessId: number, query: ExpenseQuery = {}, page = 1, limit = 20) {
    if (!businessId) throw new Error('Business ID is required');
    // A miscased sort key is not an error server-side — it silently falls back to `expenseDate`, so
    // the list looks sorted by something it is not. Dropping it here makes the fallback deliberate.
    const safe: ExpenseQuery = { ...query };
    if (safe.sortBy != null && !isExpenseSortKey(safe.sortBy)) delete safe.sortBy;
    if (safe.category != null && !isExpenseCategory(safe.category)) delete safe.category;
    // ⚠️ TRAP 2 — `page` is 1-BASED. `page=0` is a 400, NOT "the first page".
    return this.api.getExpenseByBusiness(businessId, safe, Math.max(1, page), limit);
  }
  async updateExpense(id: number, data: ExpenseUpdatePayload) {
    if (!id) throw new Error('Expense ID is required');
    this.assertExpenseShape(data);
    // ⚠️ `files` must be present — the server REPLACES the collection and writes an empty list when
    // the key is absent, so an omitted `files` silently erases every receipt on the expense. An
    // empty array is a legitimate value (the user removed them all); `undefined` is not.
    if (data.files == null) {
      throw new Error('Receipts must be sent on every update, or the server erases them');
    }
    return this.api.updateExpense(id, data);
  }
  async deleteExpense(id: number) {
    if (!id) throw new Error('Expense ID is required');
    return this.api.deleteExpense(id);
  }
  async markExpenseReimbursed(id: number, reimbursedBy?: number | null) {
    if (!id) throw new Error('Expense ID is required');
    return this.api.markExpenseReimbursed(id, reimbursedBy);
  }
  async getExpenseTotalByCategory(businessId: number, from: string, to: string) {
    if (!businessId) throw new Error('Business ID is required');
    // Bound as `Instant` with `@DateTimeFormat(ISO.DATE_TIME)`: a date-only value is a 500, not a
    // 400, so the shape is checked here rather than discovered as an outage.
    if (!from || !to) throw new Error('A date range is required');
    return this.api.getExpenseTotalByCategory(businessId, from, to);
  }

  // ─── Stock Transfer ────────────────────────────────────────────────────────
  //
  // The consumption slice above, with its addressing field swapped: a transfer names the SOURCE
  // BATCH, like a wastage, and the server derives the product and the source pool from it.
  // Everything else — the pre-flight enum check, the paging clamp — is the same trap in the same
  // place.
  //
  // No update passthrough: a transfer is immutable and the backend has no PUT.
  async createStockTransfer(data: StockTransferPayload) {
    if (!data?.businessId) throw new Error('Business ID is required');
    // ⚠️ `sourceBatchId` is `@NotNull @Positive` and is what the controller addresses the whole
    // transfer by. Guarded here rather than left to the server because a bean-validation 400 names
    // a field the form never showed anyone — there is no batch picker, so "sourceBatchId must not be
    // null" is unactionable. The client-side message names what the user can actually change.
    if (!(Number(data?.sourceBatchId) > 0)) {
      throw new Error('No stock is available in the source pool for this product');
    }
    // ⚠️ TRAP 3 — a bad enum is an HTTP **500**, not a 400. Spring cannot bind an unknown constant
    // into the body's enum, so the handler never runs and there is nothing in the response a screen
    // could turn into a message. The guard runs BEFORE the axios call. See `createConsumption`.
    if (!isStockTransferReason(data?.reason)) throw new Error('Pick a valid transfer reason');
    // Zero moves nothing and a negative one would move stock the other way. `> 0` rather than a
    // truthiness check so `'0'` and `NaN` are both refused.
    if (!(Number(data?.quantity) > 0)) throw new Error('Quantity must be more than zero');
    // The same-pool check cannot live here any more: only `destType` travels, and the source pool is
    // whatever the named batch sits in. The form still refuses a same-pool pair before it gets this
    // far — see `validateStockTransfer` — and the server refuses it as the last line.
    return this.api.createStockTransfer(data);
  }
  async getStockTransfer(id: number) {
    if (!id) throw new Error('Stock transfer ID is required');
    return this.api.getStockTransfer(id);
  }
  async getStockTransfersByBusiness(
    businessId: number,
    query: StockTransferQuery = {},
    page = 1,
    limit = 20,
  ) {
    if (!businessId) throw new Error('Business ID is required');
    // ⚠️ TRAP 2 — `page` is 1-BASED. `page=0` is a 400, NOT "the first page", so an infinite-scroll
    // list whose counter starts at zero fails on its very first request. Clamped here rather than
    // at the call site because every caller would otherwise have to remember.
    return this.api.getStockTransfersByBusiness(businessId, query, Math.max(1, page), limit);
  }
  async deleteStockTransfer(id: number) {
    if (!id) throw new Error('Stock transfer ID is required');
    return this.api.deleteStockTransfer(id);
  }
}
