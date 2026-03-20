import Config from 'react-native-config';

export const PARLOUR_BASE_URL = Config.PARLOUR_API_URL || 'http://localhost:8086';

export const PARLOUR_ROUTES = {
  // Products
  PRODUCTS_VIEW_ALL: '/parlourProduct/viewAll',
  PRODUCTS_VIEW: '/parlourProduct/view',
  PRODUCTS_CREATE: '/parlourProduct/create',
  PRODUCTS_UPDATE: '/parlourProduct/update',
  PRODUCTS_DELETE: '/parlourProduct/delete',

  // Services
  SERVICES_VIEW_ALL: '/parlourService/viewAll',
  SERVICES_VIEW: '/parlourService/view',
  SERVICES_CREATE: '/parlourService/create',
  SERVICES_UPDATE: '/parlourService/update',
  SERVICES_DELETE: '/parlourService/delete',

  // Orders
  ORDERS_VIEW_ALL: '/parlourOrder/viewAll',
  ORDERS_VIEW: '/parlourOrder/view',
  ORDERS_CREATE: '/parlourOrder/create',
  ORDERS_UPDATE: '/parlourOrder/update',
  ORDERS_DELETE: '/parlourOrder/delete',
  ORDERS_BY_CUSTOMER: '/parlourOrder/viewByCustomer',

  // Appointments
  APPOINTMENTS_VIEW_ALL: '/parlourAppointment/viewAll',
  APPOINTMENTS_VIEW: '/parlourAppointment/view',
  APPOINTMENTS_CREATE: '/parlourAppointment/create',
  APPOINTMENTS_UPDATE: '/parlourAppointment/update',
  APPOINTMENTS_DELETE: '/parlourAppointment/delete',
  APPOINTMENTS_BY_CUSTOMER: '/parlourAppointment/viewByCustomer',

  // Bills
  BILLS_VIEW_ALL: '/parlourBill/viewAll',
  BILLS_VIEW: '/parlourBill/view',
  BILLS_CREATE: '/parlourBill/create',
  BILLS_UPDATE: '/parlourBill/update',
  BILLS_DELETE: '/parlourBill/delete',
  BILLS_BY_BUSINESS: '/parlourBill/viewByBusiness',
  BILLS_BY_CUSTOMER: '/parlourBill/viewByCustomer',

  // Inventory
  INVENTORY_ADD: '/parlourInventory/add',
  INVENTORY_UPDATE: '/parlourInventory/update',
  INVENTORY_VIEW: '/parlourInventory/view',
  INVENTORY_BY_PRODUCT: '/parlourInventory/viewByProduct',
  INVENTORY_BY_BUSINESS: '/parlourInventory/viewByBusiness',
  INVENTORY_TOTAL_STOCK: '/parlourInventory/totalStock',
  INVENTORY_IS_AVAILABLE: '/parlourInventory/isAvailable',
  INVENTORY_EXPIRING: '/parlourInventory/expiring',
  INVENTORY_UPDATE_STATUS: '/parlourInventory/updateStatus',
  INVENTORY_DELETE: '/parlourInventory/delete',
};
