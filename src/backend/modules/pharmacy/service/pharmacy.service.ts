import {PharmacyApiInterface} from '../api/pharmacy.api.interface';

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

  async getAllOrders(businessId: number, page = 1, limit = 10) {
    if (!businessId) throw new Error('Business ID is required');
    return this.api.getAllOrders(businessId, page, limit);
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

  async getAllAppointments(businessId: number, page = 1, limit = 10) {
    if (!businessId) throw new Error('Business ID is required');
    return this.api.getAllAppointments(businessId, page, limit);
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
  async getBillsByBusiness(businessId: number) { return this.api.getBillsByBusiness(businessId); }
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
