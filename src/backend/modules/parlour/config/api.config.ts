import { PARLOUR_API_URL } from '../../../../config/env';

export const PARLOUR_BASE_URL = PARLOUR_API_URL;

/**
 * Routes for the parlour module, checked entry by entry against Parlour*Controller.
 *
 * This table used to declare `/create`, `/update`, `/delete` and `/view` on five resources. None of
 * those routes has ever existed. The controllers are REST-conventional: POST and PUT on the bare
 * resource base, GET and DELETE on `base/{id}`, and sub-collections under a named segment. Nothing
 * called the fictional entries yet, so nothing was visibly broken — the first create flow to use
 * one would have 404'd.
 *
 * One `*_BASE` per resource rather than four aliases pointing at the same string: the aliases are
 * what made the fiction plausible in the first place.
 */
export const PARLOUR_ROUTES = {
  // POST base · PUT base · GET|DELETE base/{id}
  PRODUCTS_BASE: '/parlourProduct',
  PRODUCTS_VIEW_ALL: '/parlourProduct/viewAll',

  // Common controller, not a parlour one, so the path carries no module slug. Listed here anyway
  // because every call still rides this module's axios client and base URL — the same reason the
  // pharmacy table carries its own identical copy.
  DMS_ENTITY_FOLDER: '/api/dms/entity-folder',

  SERVICES_BASE: '/parlourService',
  SERVICES_VIEW_ALL: '/parlourService/viewAll',

  // ORDERS_BASE also carries PATCH base/{id}/status — status-only change (cascades items,
  // reconciles inventory, audits).
  ORDERS_BASE: '/parlourOrder',
  ORDERS_VIEW_ALL: '/parlourOrder/viewAll',
  ORDERS_SUMMARY: '/parlourOrder/summary',
  ORDERS_BY_CUSTOMER: '/parlourOrder/customer',

  // APPOINTMENTS_BASE also carries PATCH base/{id}/status and base/{id}/schedule.
  APPOINTMENTS_BASE: '/parlourAppointment',
  APPOINTMENTS_VIEW_ALL: '/parlourAppointment/viewAll',
  // Per-IST-day counts for the week strip / month grid dots.
  APPOINTMENTS_DAY_COUNTS: '/parlourAppointment/dayCounts',
  APPOINTMENTS_BY_CUSTOMER: '/parlourAppointment/customer',

  // Bills are the one exception to the shape above: update is PUT base/{billId}, not PUT base.
  // BILLS_BASE also carries PATCH base/{id}/status and base/{id}/payment.
  BILLS_BASE: '/parlourBill',
  // All-time rollup for the billing header, chips and wallet card.
  BILLS_SUMMARY: '/parlourBill/summary',
  BILLS_BY_BUSINESS: '/parlourBill/business',
  BILLS_BY_CUSTOMER: '/parlourBill/customer',

  // Inventory
  // ⚠ Not yet audited against ParlourInventoryController, unlike everything above. Known wrong:
  // INVENTORY_UPDATE has no backend at all (batches are immutable), UPDATE_STATUS is really
  // PATCH /{id}/status, and BY_BUSINESS takes a query param rather than a path segment.
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
