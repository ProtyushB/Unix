import {PharmacyApiInterface, ApiResponse} from './pharmacy.api.interface';
import pharmacyApiClient from '../config/axios.instance';
import {PHARMACY_ROUTES} from '../config/api.config';

export class PharmacyApiImpl extends PharmacyApiInterface {
  async getAllProducts(businessId: number, page: number, limit: number): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.PRODUCTS_VIEW_ALL, {params: {businessId, page, limit}});
    return res.data;
  }
  async getProductById(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.PRODUCTS_VIEW}/${id}`);
    return res.data;
  }
  async createProduct(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.post(PHARMACY_ROUTES.PRODUCTS_CREATE, data);
    return res.data;
  }
  async updateProduct(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.put(PHARMACY_ROUTES.PRODUCTS_UPDATE, data);
    return res.data;
  }
  async deleteProduct(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.delete(`${PHARMACY_ROUTES.PRODUCTS_DELETE}/${id}`);
    return res.data;
  }
  async getAllServices(businessId: number, page: number, limit: number): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.SERVICES_VIEW_ALL, {params: {businessId, page, limit}});
    return res.data;
  }
  async getServiceById(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.SERVICES_VIEW}/${id}`);
    return res.data;
  }
  async createService(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.post(PHARMACY_ROUTES.SERVICES_CREATE, data);
    return res.data;
  }
  async updateService(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.put(PHARMACY_ROUTES.SERVICES_UPDATE, data);
    return res.data;
  }
  async deleteService(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.delete(`${PHARMACY_ROUTES.SERVICES_DELETE}/${id}`);
    return res.data;
  }
  async getAllOrders(businessId: number, page: number, limit: number): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.ORDERS_VIEW_ALL, {params: {businessId, page, limit}});
    return res.data;
  }
  async getOrderById(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.ORDERS_VIEW}/${id}`);
    return res.data;
  }
  async createOrder(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.post(PHARMACY_ROUTES.ORDERS_CREATE, data);
    return res.data;
  }
  async updateOrder(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.put(PHARMACY_ROUTES.ORDERS_UPDATE, data);
    return res.data;
  }
  async deleteOrder(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.delete(`${PHARMACY_ROUTES.ORDERS_DELETE}/${id}`);
    return res.data;
  }
  async getOrdersByCustomer(customerId: number, options: Record<string, unknown>): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.ORDERS_BY_CUSTOMER}/${customerId}`, {params: options});
    return res.data;
  }
  async getAllAppointments(businessId: number, page: number, limit: number): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.APPOINTMENTS_VIEW_ALL, {params: {businessId, page, limit}});
    return res.data;
  }
  async getAppointmentById(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.APPOINTMENTS_VIEW}/${id}`);
    return res.data;
  }
  async createAppointment(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.post(PHARMACY_ROUTES.APPOINTMENTS_CREATE, data);
    return res.data;
  }
  async updateAppointment(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.put(PHARMACY_ROUTES.APPOINTMENTS_UPDATE, data);
    return res.data;
  }
  async deleteAppointment(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.delete(`${PHARMACY_ROUTES.APPOINTMENTS_DELETE}/${id}`);
    return res.data;
  }
  async getAppointmentsByCustomer(customerId: number, options: Record<string, unknown>): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.APPOINTMENTS_BY_CUSTOMER}/${customerId}`, {params: options});
    return res.data;
  }
  async getAllBills(page: number, limit: number): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.BILLS_VIEW_ALL, {params: {page, limit}});
    return res.data;
  }
  async getBillById(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.BILLS_VIEW}/${id}`);
    return res.data;
  }
  async getBillsByBusiness(businessId: number): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.BILLS_BY_BUSINESS}/${businessId}`);
    return res.data;
  }
  async getBillsByCustomer(customerId: number): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.BILLS_BY_CUSTOMER}/${customerId}`);
    return res.data;
  }
  async createBill(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.post(PHARMACY_ROUTES.BILLS_CREATE, data);
    return res.data;
  }
  async updateBill(billId: number, data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.put(`${PHARMACY_ROUTES.BILLS_UPDATE}/${billId}`, data);
    return res.data;
  }
  async deleteBill(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.delete(`${PHARMACY_ROUTES.BILLS_DELETE}/${id}`);
    return res.data;
  }
  async addInventoryBatch(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.post(PHARMACY_ROUTES.INVENTORY_ADD, data);
    return res.data;
  }
  async updateInventoryBatch(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.put(PHARMACY_ROUTES.INVENTORY_UPDATE, data);
    return res.data;
  }
  async getInventoryBatch(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.INVENTORY_VIEW}/${id}`);
    return res.data;
  }
  async getInventoryBatchesByProduct(productId: number, businessId: number): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.INVENTORY_BY_PRODUCT, {params: {productId, businessId}});
    return res.data;
  }
  async getInventoryBatchesByBusiness(businessId: number): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(`${PHARMACY_ROUTES.INVENTORY_BY_BUSINESS}/${businessId}`);
    return res.data;
  }
  async getTotalStock(productId: number, businessId: number): Promise<ApiResponse<number>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.INVENTORY_TOTAL_STOCK, {params: {productId, businessId}});
    return res.data;
  }
  async isAvailable(productId: number, businessId: number): Promise<ApiResponse<boolean>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.INVENTORY_IS_AVAILABLE, {params: {productId, businessId}});
    return res.data;
  }
  async getExpiringBatches(businessId: number, withinDays: number): Promise<ApiResponse<unknown[]>> {
    const res = await pharmacyApiClient.get(PHARMACY_ROUTES.INVENTORY_EXPIRING, {params: {businessId, withinDays}});
    return res.data;
  }
  async updateBatchStatus(id: number, status: string): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.put(`${PHARMACY_ROUTES.INVENTORY_UPDATE_STATUS}/${id}`, null, {params: {status}});
    return res.data;
  }
  async deleteInventoryBatch(id: number): Promise<ApiResponse<unknown>> {
    const res = await pharmacyApiClient.delete(`${PHARMACY_ROUTES.INVENTORY_DELETE}/${id}`);
    return res.data;
  }
}
