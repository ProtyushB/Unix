import {PharmacyApiInterface, OrderListOptions, AppointmentListOptions, BillListOptions} from '../api/pharmacy.api.interface';

export class PharmacyService {
  constructor(private api: PharmacyApiInterface) {}

  async getAllProducts(businessId: number, page = 1, limit = 10) {
    if (!businessId) throw new Error('Business ID is required');
    return this.api.getAllProducts(businessId, page, limit);
  }
  async getProductById(id: number) { return this.api.getProductById(id); }
  async createProduct(data: Record<string, unknown>) {
    if (!data.name || !data.businessId) throw new Error('Name and Business ID are required');
    return this.api.createProduct(data);
  }
  async updateProduct(data: Record<string, unknown>) {
    if (!data.id) throw new Error('Product ID is required for update');
    return this.api.updateProduct(data);
  }
  async deleteProduct(id: number) { return this.api.deleteProduct(id); }

  async getAllServices(businessId: number, page = 1, limit = 10) {
    if (!businessId) throw new Error('Business ID is required');
    return this.api.getAllServices(businessId, page, limit);
  }
  async getServiceById(id: number) { return this.api.getServiceById(id); }
  async createService(data: Record<string, unknown>) {
    if (!data.name || !data.businessId) throw new Error('Name and Business ID are required');
    return this.api.createService(data);
  }
  async updateService(data: Record<string, unknown>) {
    if (!data.id) throw new Error('Service ID is required for update');
    return this.api.updateService(data);
  }
  async deleteService(id: number) { return this.api.deleteService(id); }

  async getAllOrders(businessId: number, page = 1, limit = 10, options: OrderListOptions = {}) {
    if (!businessId) throw new Error('Business ID is required');
    return this.api.getAllOrders(businessId, page, limit, options);
  }
  async getOrderSummary(businessId: number, options: {fromDate?: string; toDate?: string} = {}) {
    if (!businessId) throw new Error('Business ID is required');
    return this.api.getOrderSummary(businessId, options);
  }
  async updateOrderStatus(id: number, status: string, options: {userId?: number; reason?: string} = {}) {
    if (!id) throw new Error('Order ID is required');
    if (!status) throw new Error('Status is required');
    return this.api.updateOrderStatus(id, status, options);
  }
  async getOrderById(id: number) { return this.api.getOrderById(id); }
  async createOrder(data: Record<string, unknown>) {
    if (!data.customerId || !data.businessId) throw new Error('Customer ID and Business ID are required');
    return this.api.createOrder(data);
  }
  async updateOrder(data: Record<string, unknown>) {
    if (!data.id) throw new Error('Order ID is required for update');
    return this.api.updateOrder(data);
  }
  async deleteOrder(id: number) { return this.api.deleteOrder(id); }
  async getOrdersByCustomer(customerId: number, options = {}) { return this.api.getOrdersByCustomer(customerId, options); }

  async getAllAppointments(businessId: number, page = 1, limit = 10, options: AppointmentListOptions = {}) {
    if (!businessId) throw new Error('Business ID is required');
    return this.api.getAllAppointments(businessId, page, limit, options);
  }
  async getAppointmentDayCounts(businessId: number, options: {fromDate: string; toDate: string}) {
    if (!businessId) throw new Error('Business ID is required');
    // Both bounds are mandatory server-side — an unbounded day map is unbounded output.
    if (!options?.fromDate || !options?.toDate) throw new Error('fromDate and toDate are required');
    return this.api.getAppointmentDayCounts(businessId, options);
  }
  async updateAppointmentStatus(id: number, status: string, options: {userId?: number; reason?: string} = {}) {
    if (!id) throw new Error('Appointment ID is required');
    if (!status) throw new Error('Status is required');
    return this.api.updateAppointmentStatus(id, status, options);
  }
  async rescheduleAppointment(id: number, appointmentDateTime: string, options: {userId?: number; reason?: string} = {}) {
    if (!id) throw new Error('Appointment ID is required');
    if (!appointmentDateTime) throw new Error('Appointment date and time is required');
    return this.api.rescheduleAppointment(id, appointmentDateTime, options);
  }
  async getAppointmentById(id: number) { return this.api.getAppointmentById(id); }
  async createAppointment(data: Record<string, unknown>) {
    if (!data.customerId || !data.businessId) throw new Error('Customer ID and Business ID are required');
    return this.api.createAppointment(data);
  }
  async updateAppointment(data: Record<string, unknown>) {
    if (!data.id) throw new Error('Appointment ID is required for update');
    return this.api.updateAppointment(data);
  }
  async deleteAppointment(id: number) { return this.api.deleteAppointment(id); }
  async getAppointmentsByCustomer(customerId: number, options = {}) { return this.api.getAppointmentsByCustomer(customerId, options); }

  async getAllBills(page = 1, limit = 10) { return this.api.getAllBills(page, limit); }
  async getBillById(id: number) { return this.api.getBillById(id); }
  async getBillsByBusiness(businessId: number, page = 1, limit = 20, options: BillListOptions = {}) {
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
  async updateBillPayment(id: number, paymentStatus: string, options: {paidAmount?: number; refundedAmount?: number} = {}) {
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
  async getBillsByCustomer(customerId: number) { return this.api.getBillsByCustomer(customerId); }
  async createBill(data: Record<string, unknown>) { return this.api.createBill(data); }
  async updateBill(billId: number, data: Record<string, unknown>) { return this.api.updateBill(billId, data); }
  async deleteBill(id: number) { return this.api.deleteBill(id); }

  async addInventoryBatch(data: Record<string, unknown>) { return this.api.addInventoryBatch(data); }
  async updateInventoryBatch(data: Record<string, unknown>) { return this.api.updateInventoryBatch(data); }
  async getInventoryBatch(id: number) { return this.api.getInventoryBatch(id); }
  async getInventoryBatchesByProduct(productId: number, businessId: number) { return this.api.getInventoryBatchesByProduct(productId, businessId); }
  async getInventoryBatchesByBusiness(businessId: number) { return this.api.getInventoryBatchesByBusiness(businessId); }
  async getTotalStock(productId: number, businessId: number) { return this.api.getTotalStock(productId, businessId); }
  async isAvailable(productId: number, businessId: number) { return this.api.isAvailable(productId, businessId); }
  async getExpiringBatches(businessId: number, withinDays = 30) { return this.api.getExpiringBatches(businessId, withinDays); }
  async updateBatchStatus(id: number, status: string) { return this.api.updateBatchStatus(id, status); }
  async deleteInventoryBatch(id: number) { return this.api.deleteInventoryBatch(id); }
}
