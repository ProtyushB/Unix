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

  // The same common controller, one level more specific: the folder for ONE quick-add line on ONE
  // bill. Not a `type` on the entity-folder call above — that one takes PRODUCT/SERVICE/EXPENSE and
  // keys on a single entity id, and a quick-add line is keyed by a bill id AND a client-minted uuid.
  // The backend ensures the `Bill_{billId}` parent itself; the client must not create it.
  DMS_BILL_ITEM_FOLDER: '/api/dms/bill-item-folder',

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

  // Inventory — audited against PharmacyInventoryController 2026-08-07. The controller is
  // byte-identical to the parlour one apart from its base path; see the parlour table for the note
  // on what was wrong here before and why POST needs the trailing slash.
  INVENTORY_BASE: '/pharmacyInventory',
  INVENTORY_BY_PRODUCT: '/pharmacyInventory/byProduct',
  INVENTORY_BY_BUSINESS: '/pharmacyInventory/byBusiness',
  INVENTORY_STATUS_COUNTS: '/pharmacyInventory/byBusiness/statusCounts',
  INVENTORY_TOTAL_STOCK: '/pharmacyInventory/totalStock',
  INVENTORY_IS_AVAILABLE: '/pharmacyInventory/isAvailable',
  INVENTORY_EXPIRING: '/pharmacyInventory/expiring',

  WASTAGE_DISPOSE: '/pharmacyWastage/dispose',

  // ─── Consumption ───────────────────────────────────────────────────────────
  // Mirror of the parlour pair. ⚠️ POST needs a TRAILING SLASH — see the parlour table.
  CONSUMPTION_BASE: '/pharmacyConsumption',
  CONSUMPTION_BY_BUSINESS: '/pharmacyConsumption/byBusiness',

  // ─── Wastage ───────────────────────────────────────────────────────────────
  // Mirror of the parlour pair. ⚠️ POST needs a TRAILING SLASH — see the parlour table.
  WASTAGE_BASE: '/pharmacyWastage',
  WASTAGE_BY_BUSINESS: '/pharmacyWastage/byBusiness',

  // ─── Stock Transfer ────────────────────────────────────────────────────────
  // Mirror of the parlour pair. ⚠️ POST needs a TRAILING SLASH — see the parlour table.
  STOCK_TRANSFER_BASE: '/pharmacyStockTransfer',
  STOCK_TRANSFER_BY_BUSINESS: '/pharmacyStockTransfer/byBusiness',

  // ─── Expense ───────────────────────────────────────────────────────────────
  // Mirror of the parlour trio. ⚠️ POST needs a TRAILING SLASH — see the parlour table, which also
  // explains why this feature has a PUT and a reimburse PATCH when the three above have neither.
  EXPENSE_BASE: '/pharmacyExpense',
  EXPENSE_BY_BUSINESS: '/pharmacyExpense/byBusiness',
  EXPENSE_TOTAL_BY_CATEGORY: '/pharmacyExpense/totalByCategory',
};
