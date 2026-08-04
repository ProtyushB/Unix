import { PHARMACY_API_URL } from '../../../../config/env';

export const PHARMACY_BASE_URL = PHARMACY_API_URL;

/**
 * Routes for the pharmacy module. Mirror of the parlour table — see the note there for why the
 * `/create`, `/update`, `/delete` and `/view` entries were removed rather than repointed.
 */
export const PHARMACY_ROUTES = {
  // POST base · PUT base · GET|DELETE base/{id}
  PRODUCTS_BASE: '/pharmacyProduct',
  PRODUCTS_VIEW_ALL: '/pharmacyProduct/viewAll',

  // Common controller, not a pharmacy one, so the path carries no module slug. Listed here anyway
  // because every call still rides this module's axios client and base URL — the same reason the
  // parlour table carries its own identical copy.
  DMS_ENTITY_FOLDER: '/api/dms/entity-folder',

  SERVICES_BASE: '/pharmacyService',
  SERVICES_VIEW_ALL: '/pharmacyService/viewAll',

  // ORDERS_BASE also carries PATCH base/{id}/status — status-only change (cascades items,
  // reconciles inventory, audits).
  ORDERS_BASE: '/pharmacyOrder',
  ORDERS_VIEW_ALL: '/pharmacyOrder/viewAll',
  ORDERS_SUMMARY: '/pharmacyOrder/summary',
  ORDERS_BY_CUSTOMER: '/pharmacyOrder/customer',

  // APPOINTMENTS_BASE also carries PATCH base/{id}/status and base/{id}/schedule.
  APPOINTMENTS_BASE: '/pharmacyAppointment',
  APPOINTMENTS_VIEW_ALL: '/pharmacyAppointment/viewAll',
  // Per-IST-day counts for the week strip / month grid dots.
  APPOINTMENTS_DAY_COUNTS: '/pharmacyAppointment/dayCounts',
  APPOINTMENTS_BY_CUSTOMER: '/pharmacyAppointment/customer',

  // Bills are the one exception to the shape above: update is PUT base/{billId}, not PUT base.
  // BILLS_BASE also carries PATCH base/{id}/status and base/{id}/payment.
  BILLS_BASE: '/pharmacyBill',
  // All-time rollup for the billing header, chips and wallet card.
  BILLS_SUMMARY: '/pharmacyBill/summary',
  BILLS_BY_BUSINESS: '/pharmacyBill/business',
  BILLS_BY_CUSTOMER: '/pharmacyBill/customer',

  // Inventory
  // ⚠ Not yet audited against PharmacyInventoryController, unlike everything above. Same three
  // known defects as the parlour table.
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
