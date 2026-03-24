/**
 * Shared Module Hook Factory
 *
 * createModuleHook creates a React hook with identical structure for all modules.
 * Each module (Parlour, Pharmacy, Restaurant) uses this with its own service provider.
 *
 * getSelectedBusinessId reads from session storage (AsyncStorage).
 */

import { useState, useCallback, useMemo } from 'react';
import { getSelectedBusiness, getSelectedBusinessType, getBusinessTypeMap } from '../../../../storage/session.storage';
import { PersonApiImpl } from '../../../person/api/person.api.impl';
import { DmsService } from '../../../dms/service/dms.service';
import { createEntityFolder } from '../../../dms/util/EntityFolderUtils';
import { NativeFile, ResourceFileDto } from '../../../dms/api/file.api.interface';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceResult<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  error?: string | null;
  totalPages?: number;
}

interface ModuleService {
  getAllProducts(businessId: number, page: number, limit: number): Promise<ServiceResult>;
  createProduct(data: Record<string, unknown>): Promise<ServiceResult>;
  updateProduct(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteProduct(id: number): Promise<ServiceResult>;

  getAllServices(businessId: number, page: number, limit: number): Promise<ServiceResult>;
  createService(data: Record<string, unknown>): Promise<ServiceResult>;
  updateService(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteService(id: number): Promise<ServiceResult>;

  getAllOrders(businessId: number, page: number, limit: number): Promise<ServiceResult>;
  createOrder(data: Record<string, unknown>): Promise<ServiceResult>;
  updateOrder(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteOrder(id: number): Promise<ServiceResult>;
  getOrdersByCustomer(customerId: number, options: Record<string, unknown>): Promise<ServiceResult>;

  getAllAppointments(businessId: number, page: number, limit: number): Promise<ServiceResult>;
  createAppointment(data: Record<string, unknown>): Promise<ServiceResult>;
  updateAppointment(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteAppointment(id: number): Promise<ServiceResult>;
  getAppointmentsByCustomer(customerId: number, options: Record<string, unknown>): Promise<ServiceResult>;

  getBillsByBusiness(businessId: number): Promise<ServiceResult>;

  getInventoryBatchesByBusiness(businessId: number): Promise<ServiceResult>;
  getInventoryBatchesByProduct(productId: number, businessId: number): Promise<ServiceResult>;
  addInventoryBatch(data: Record<string, unknown>): Promise<ServiceResult>;
  updateInventoryBatch(data: Record<string, unknown>): Promise<ServiceResult>;
  deleteInventoryBatch(id: number): Promise<ServiceResult>;
  updateBatchStatus(id: number, status: string): Promise<ServiceResult>;
  getExpiringBatches(businessId: number, withinDays: number): Promise<ServiceResult>;
  getTotalStock(productId: number, businessId: number): Promise<ServiceResult>;
}

// ─── Selected Business ID (async) ────────────────────────────────────────────

export const getSelectedBusinessId = async (): Promise<number | null> => {
  try {
    const selectedBusinessType = await getSelectedBusinessType();
    const selectedBusiness = await getSelectedBusiness();

    if (!selectedBusinessType || !selectedBusiness) {
      return null;
    }

    const businessTypeMap = await getBusinessTypeMap();
    if (!businessTypeMap) return null;

    const businesses = businessTypeMap[selectedBusinessType] || [];
    const business = businesses.find(
      (b: Record<string, unknown>) => b.businessName === selectedBusiness,
    );

    return (business?.id as number) || null;
  } catch {
    return null;
  }
};

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createModuleHook(getServiceFn: () => ModuleService, moduleName: string) {
  return () => {
    const [products, setProducts] = useState<unknown[]>([]);
    const [productsTotalPages, setProductsTotalPages] = useState(1);
    const [services, setServices] = useState<unknown[]>([]);
    const [servicesTotalPages, setServicesTotalPages] = useState(1);
    const [customers, setCustomers] = useState<unknown[]>([]);
    const [employees, setEmployees] = useState<unknown[]>([]);
    const [orders, setOrders] = useState<unknown[]>([]);
    const [ordersTotalPages, setOrdersTotalPages] = useState(1);
    const [appointments, setAppointments] = useState<unknown[]>([]);
    const [bills, setBills] = useState<unknown[]>([]);
    const [inventory, setInventory] = useState<unknown[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const service = getServiceFn();
    const dmsService = useMemo(() => new DmsService(), []);

    // ═══════════════════════════════════════════════════════════════
    // Product CRUD
    // ═══════════════════════════════════════════════════════════════

    const loadProducts = useCallback(
      async (page = 1, limit = 10) => {
        setLoading(true);
        setError(null);
        try {
          const businessId = await getSelectedBusinessId();
          if (!businessId) {
            setError('No business selected. Please select a business first.');
            setProducts([]);
            setLoading(false);
            return;
          }
          const response = await service.getAllProducts(businessId, page, limit);
          if (response.success) {
            const data = response.data;
            setProducts(Array.isArray(data) ? data : []);
            setProductsTotalPages(response.totalPages ?? 1);
          } else {
            setError(response.error || response.message || null);
            setProducts([]);
            setProductsTotalPages(1);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load products');
          setProducts([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const createProduct = useCallback(
      async (productData: Record<string, unknown>, files: NativeFile[] = [], parentFolderId: number | null = null) => {
        setLoading(true);
        setError(null);
        let uploadedDmsFiles: ResourceFileDto[] = [];
        try {
          if (files.length > 0 && parentFolderId) {
            uploadedDmsFiles = await dmsService.uploadMultipleFiles(files, parentFolderId);
            productData = { ...productData, dmsFileIds: uploadedDmsFiles.map((f) => f.id) };
          }
          const response = await service.createProduct(productData);
          if (response.success) return { success: true, data: response.data };
          throw new Error(response.error || response.message || 'Failed to create product');
        } catch (err) {
          for (const f of uploadedDmsFiles) {
            try { await dmsService.deleteFile(f.id!); } catch (_) {}
          }
          const message = (err as Error).message || 'Failed to create product';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service, dmsService],
    );

    const updateProduct = useCallback(
      async (productData: Record<string, unknown>) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.updateProduct(productData);
          if (response.success) return { success: true, data: response.data };
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to update product';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const deleteProduct = useCallback(
      async (id: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.deleteProduct(id);
          if (response.success) return { success: true, data: response.data };
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to delete product';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // ═══════════════════════════════════════════════════════════════
    // Service CRUD
    // ═══════════════════════════════════════════════════════════════

    const loadServices = useCallback(
      async (page = 1, limit = 10) => {
        setLoading(true);
        setError(null);
        try {
          const businessId = await getSelectedBusinessId();
          if (!businessId) {
            setError('No business selected. Please select a business first.');
            setServices([]);
            setLoading(false);
            return;
          }
          const response = await service.getAllServices(businessId, page, limit);
          if (response.success) {
            const data = response.data;
            setServices(Array.isArray(data) ? data : []);
            setServicesTotalPages(response.totalPages ?? 1);
          } else {
            setError(response.error || response.message || null);
            setServices([]);
            setServicesTotalPages(1);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load services');
          setServices([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const createService = useCallback(
      async (serviceData: Record<string, unknown>, files: NativeFile[] = [], parentFolderId: number | null = null) => {
        setLoading(true);
        setError(null);
        let uploadedDmsFiles: ResourceFileDto[] = [];
        try {
          if (files.length > 0 && parentFolderId) {
            uploadedDmsFiles = await dmsService.uploadMultipleFiles(files, parentFolderId);
            serviceData = { ...serviceData, dmsFileIds: uploadedDmsFiles.map((f) => f.id) };
          }
          const response = await service.createService(serviceData);
          if (response.success) return { success: true, data: response.data };
          throw new Error(response.error || response.message || 'Failed to create service');
        } catch (err) {
          for (const f of uploadedDmsFiles) {
            try { await dmsService.deleteFile(f.id!); } catch (_) {}
          }
          const message = (err as Error).message || 'Failed to create service';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service, dmsService],
    );

    const updateService = useCallback(
      async (serviceData: Record<string, unknown>) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.updateService(serviceData);
          if (response.success) return { success: true, data: response.data };
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to update service';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const deleteService = useCallback(
      async (id: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.deleteService(id);
          if (response.success) return { success: true, data: response.data };
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to delete service';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // ═══════════════════════════════════════════════════════════════
    // Customer & Employee
    // ═══════════════════════════════════════════════════════════════

    const loadCustomers = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const personApi = new PersonApiImpl();
        const response = await personApi.getAllPersons();
        if (response?.data) {
          setCustomers(Array.isArray(response.data) ? response.data : []);
        } else {
          setCustomers([]);
        }
      } catch (err) {
        setError((err as Error).message || 'Failed to load customers');
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    }, []);

    const loadEmployees = useCallback(async () => {
      setEmployees([]);
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // Order CRUD
    // ═══════════════════════════════════════════════════════════════

    const loadOrders = useCallback(
      async (page = 1, limit = 10) => {
        setLoading(true);
        setError(null);
        try {
          const businessId = await getSelectedBusinessId();
          if (!businessId) {
            setError('No business selected. Please select a business first.');
            setOrders([]);
            setLoading(false);
            return;
          }
          const response = await service.getAllOrders(businessId, page, limit);
          if (response.success) {
            const data = response.data;
            setOrders(Array.isArray(data) ? data : []);
            setOrdersTotalPages(response.totalPages ?? 1);
          } else {
            setError(response.error || response.message || null);
            setOrders([]);
            setOrdersTotalPages(1);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load orders');
          setOrders([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const createOrder = useCallback(
      async (orderData: Record<string, unknown>, files: NativeFile[] = [], parentFolderId: number | null = null) => {
        setLoading(true);
        setError(null);
        let dmsFolderId: number | null = null;
        let uploadedDmsFiles: ResourceFileDto[] = [];
        try {
          if (parentFolderId) {
            dmsFolderId = await createEntityFolder({ parentFolderId });
            orderData = { ...orderData, dmsFolderId };
          }
          if (files.length > 0) {
            uploadedDmsFiles = await dmsService.uploadMultipleFiles(files, dmsFolderId || parentFolderId!);
            orderData = { ...orderData, dmsFileIds: uploadedDmsFiles.map((f) => f.id) };
          }
          const response = await service.createOrder(orderData);
          if (response.success) return { success: true, data: response.data };
          throw new Error(response.error || response.message || 'Failed to create order');
        } catch (err) {
          for (const f of uploadedDmsFiles) {
            try { await dmsService.deleteFile(f.id!); } catch (_) {}
          }
          const message = (err as Error).message || 'Failed to create order';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service, dmsService],
    );

    const updateOrder = useCallback(
      async (orderData: Record<string, unknown>) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.updateOrder(orderData);
          if (response.success) return { success: true, data: response.data };
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to update order';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const deleteOrder = useCallback(
      async (id: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.deleteOrder(id);
          if (response.success) return { success: true, data: response.data };
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to delete order';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const loadOrdersByCustomer = useCallback(
      async (customerId: number, options: Record<string, unknown> = {}) => {
        setLoading(true);
        setError(null);
        try {
          if (!customerId) {
            setError('Customer ID is required');
            setOrders([]);
            setLoading(false);
            return;
          }
          const response = await service.getOrdersByCustomer(customerId, options);
          if (response.success) {
            const data = response.data;
            setOrders(Array.isArray(data) ? data : []);
          } else {
            setError(response.error || response.message || null);
            setOrders([]);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load orders for customer');
          setOrders([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // ═══════════════════════════════════════════════════════════════
    // Appointment CRUD
    // ═══════════════════════════════════════════════════════════════

    const loadAppointments = useCallback(
      async (page = 1, limit = 10) => {
        setLoading(true);
        setError(null);
        try {
          const businessId = await getSelectedBusinessId();
          if (!businessId) {
            setError('No business selected. Please select a business first.');
            setAppointments([]);
            setLoading(false);
            return;
          }
          const response = await service.getAllAppointments(businessId, page, limit);
          if (response.success) {
            const data = response.data;
            setAppointments(Array.isArray(data) ? data : []);
          } else {
            setError(response.error || response.message || null);
            setAppointments([]);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load appointments');
          setAppointments([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const createAppointment = useCallback(
      async (appointmentData: Record<string, unknown>, files: NativeFile[] = [], parentFolderId: number | null = null) => {
        setLoading(true);
        setError(null);
        let uploadedDmsFiles: ResourceFileDto[] = [];
        try {
          if (files.length > 0 && parentFolderId) {
            uploadedDmsFiles = await dmsService.uploadMultipleFiles(files, parentFolderId);
            appointmentData = { ...appointmentData, dmsFileIds: uploadedDmsFiles.map((f) => f.id) };
          }
          const response = await service.createAppointment(appointmentData);
          if (response.success) return { success: true, data: response.data };
          throw new Error(response.error || response.message || 'Failed to create appointment');
        } catch (err) {
          for (const f of uploadedDmsFiles) {
            try { await dmsService.deleteFile(f.id!); } catch (_) {}
          }
          const message = (err as Error).message || 'Failed to create appointment';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service, dmsService],
    );

    const updateAppointment = useCallback(
      async (appointmentData: Record<string, unknown>) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.updateAppointment(appointmentData);
          if (response.success) return { success: true, data: response.data };
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to update appointment';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const deleteAppointment = useCallback(
      async (id: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.deleteAppointment(id);
          if (response.success) return { success: true, data: response.data };
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to delete appointment';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const loadAppointmentsByCustomer = useCallback(
      async (customerId: number, options: Record<string, unknown> = {}) => {
        setLoading(true);
        setError(null);
        try {
          if (!customerId) {
            setError('Customer ID is required');
            setAppointments([]);
            setLoading(false);
            return;
          }
          const response = await service.getAppointmentsByCustomer(customerId, options);
          if (response.success) {
            const data = response.data;
            setAppointments(Array.isArray(data) ? data : []);
          } else {
            setError(response.error || response.message || null);
            setAppointments([]);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load appointments for customer');
          setAppointments([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    // ═══════════════════════════════════════════════════════════════
    // Bills
    // ═══════════════════════════════════════════════════════════════

    const loadBills = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const businessId = await getSelectedBusinessId();
        if (!businessId) {
          setError('No business selected. Please select a business first.');
          setBills([]);
          setLoading(false);
          return;
        }
        const response = await service.getBillsByBusiness(businessId);
        if (response.success) {
          const data = response.data;
          setBills(Array.isArray(data) ? data : []);
        } else {
          setError(response.error || response.message || null);
          setBills([]);
        }
      } catch (err) {
        setError((err as Error).message || 'Failed to load bills');
        setBills([]);
      } finally {
        setLoading(false);
      }
    }, [service]);

    // ═══════════════════════════════════════════════════════════════
    // Inventory CRUD
    // ═══════════════════════════════════════════════════════════════

    const loadInventoryByBusiness = useCallback(
      async (businessId: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.getInventoryBatchesByBusiness(businessId);
          if (response.success) {
            setInventory(Array.isArray(response.data) ? response.data : []);
          } else {
            setError(response.error || response.message || null);
            setInventory([]);
          }
        } catch (err) {
          setError((err as Error).message || 'Failed to load inventory');
          setInventory([]);
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const loadInventoryByProduct = useCallback(
      async (productId: number, businessId: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.getInventoryBatchesByProduct(productId, businessId);
          if (response.success) return { success: true, data: response.data };
          setError(response.error || response.message || null);
          return { success: false, error: response.error };
        } catch (err) {
          const message = (err as Error).message || 'Failed to load inventory by product';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const addInventoryBatch = useCallback(
      async (batchData: Record<string, unknown>) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.addInventoryBatch(batchData);
          if (response.success) return { success: true, data: response.data };
          throw new Error(response.error || response.message || 'Failed to add inventory batch');
        } catch (err) {
          const message = (err as Error).message || 'Failed to add inventory batch';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const updateInventoryBatch = useCallback(
      async (batchData: Record<string, unknown>) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.updateInventoryBatch(batchData);
          if (response.success) return { success: true, data: response.data };
          throw new Error(response.error || response.message || 'Failed to update inventory batch');
        } catch (err) {
          const message = (err as Error).message || 'Failed to update inventory batch';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const deleteInventoryBatch = useCallback(
      async (id: number) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.deleteInventoryBatch(id);
          if (response.success) return { success: true, data: response.data };
          throw new Error(response.error || response.message || 'Failed to delete inventory batch');
        } catch (err) {
          const message = (err as Error).message || 'Failed to delete inventory batch';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const updateBatchStatus = useCallback(
      async (id: number, status: string) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.updateBatchStatus(id, status);
          if (response.success) return { success: true, data: response.data };
          throw new Error(response.error || response.message || 'Failed to update batch status');
        } catch (err) {
          const message = (err as Error).message || 'Failed to update batch status';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const getExpiringBatches = useCallback(
      async (businessId: number, withinDays = 30) => {
        setLoading(true);
        setError(null);
        try {
          const response = await service.getExpiringBatches(businessId, withinDays);
          if (response.success) return { success: true, data: response.data };
          throw new Error(response.error || response.message || 'Failed to fetch expiring batches');
        } catch (err) {
          const message = (err as Error).message || 'Failed to fetch expiring batches';
          setError(message);
          return { success: false, error: message };
        } finally {
          setLoading(false);
        }
      },
      [service],
    );

    const getTotalStock = useCallback(
      async (productId: number, businessId: number) => {
        try {
          const response = await service.getTotalStock(productId, businessId);
          if (response.success) return { success: true, data: response.data };
          return { success: false, error: response.error };
        } catch (err) {
          return { success: false, error: (err as Error).message };
        }
      },
      [service],
    );

    const clearError = useCallback(() => {
      setError(null);
    }, []);

    return {
      // State
      products,
      productsTotalPages,
      services,
      servicesTotalPages,
      customers,
      employees,
      orders,
      ordersTotalPages,
      appointments,
      bills,
      inventory,
      loading,
      error,

      // Product CRUD
      loadProducts,
      createProduct,
      updateProduct,
      deleteProduct,

      // Service CRUD
      loadServices,
      createService,
      updateService,
      deleteService,

      // Order CRUD
      loadOrders,
      loadOrdersByCustomer,
      createOrder,
      updateOrder,
      deleteOrder,

      // Appointment CRUD
      loadAppointments,
      loadAppointmentsByCustomer,
      createAppointment,
      updateAppointment,
      deleteAppointment,

      // Other
      loadCustomers,
      loadEmployees,
      loadBills,

      // Inventory CRUD
      loadInventoryByBusiness,
      loadInventoryByProduct,
      addInventoryBatch,
      updateInventoryBatch,
      deleteInventoryBatch,
      updateBatchStatus,
      getExpiringBatches,
      getTotalStock,

      // Utility
      clearError,
    };
  };
}
