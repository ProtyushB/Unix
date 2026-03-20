import Config from 'react-native-config';

export const PHARMACY_BASE_URL = Config.PHARMACY_API_URL || 'http://localhost:8086';

export const PHARMACY_ROUTES = {
  PRODUCTS_VIEW_ALL: '/pharmacyProduct/viewAll',
  PRODUCTS_VIEW: '/pharmacyProduct/view',
  PRODUCTS_CREATE: '/pharmacyProduct/create',
  PRODUCTS_UPDATE: '/pharmacyProduct/update',
  PRODUCTS_DELETE: '/pharmacyProduct/delete',

  SERVICES_VIEW_ALL: '/pharmacyService/viewAll',
  SERVICES_VIEW: '/pharmacyService/view',
  SERVICES_CREATE: '/pharmacyService/create',
  SERVICES_UPDATE: '/pharmacyService/update',
  SERVICES_DELETE: '/pharmacyService/delete',

  ORDERS_VIEW_ALL: '/pharmacyOrder/viewAll',
  ORDERS_VIEW: '/pharmacyOrder/view',
  ORDERS_CREATE: '/pharmacyOrder/create',
  ORDERS_UPDATE: '/pharmacyOrder/update',
  ORDERS_DELETE: '/pharmacyOrder/delete',
  ORDERS_BY_CUSTOMER: '/pharmacyOrder/viewByCustomer',

  APPOINTMENTS_VIEW_ALL: '/pharmacyAppointment/viewAll',
  APPOINTMENTS_VIEW: '/pharmacyAppointment/view',
  APPOINTMENTS_CREATE: '/pharmacyAppointment/create',
  APPOINTMENTS_UPDATE: '/pharmacyAppointment/update',
  APPOINTMENTS_DELETE: '/pharmacyAppointment/delete',
  APPOINTMENTS_BY_CUSTOMER: '/pharmacyAppointment/viewByCustomer',

  BILLS_VIEW_ALL: '/pharmacyBill/viewAll',
  BILLS_VIEW: '/pharmacyBill/view',
  BILLS_CREATE: '/pharmacyBill/create',
  BILLS_UPDATE: '/pharmacyBill/update',
  BILLS_DELETE: '/pharmacyBill/delete',
  BILLS_BY_BUSINESS: '/pharmacyBill/viewByBusiness',
  BILLS_BY_CUSTOMER: '/pharmacyBill/viewByCustomer',

  INVENTORY_ADD: '/pharmacyInventory/add',
  INVENTORY_UPDATE: '/pharmacyInventory/update',
  INVENTORY_VIEW: '/pharmacyInventory/view',
  INVENTORY_BY_PRODUCT: '/pharmacyInventory/viewByProduct',
  INVENTORY_BY_BUSINESS: '/pharmacyInventory/viewByBusiness',
  INVENTORY_TOTAL_STOCK: '/pharmacyInventory/totalStock',
  INVENTORY_IS_AVAILABLE: '/pharmacyInventory/isAvailable',
  INVENTORY_EXPIRING: '/pharmacyInventory/expiring',
  INVENTORY_UPDATE_STATUS: '/pharmacyInventory/updateStatus',
  INVENTORY_DELETE: '/pharmacyInventory/delete',
};
