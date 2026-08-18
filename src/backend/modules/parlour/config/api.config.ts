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

  // The same common controller, one level more specific: the folder for ONE quick-add line on ONE
  // bill. Not a `type` on the entity-folder call above — that one takes PRODUCT/SERVICE/EXPENSE and
  // keys on a single entity id, and a quick-add line is keyed by a bill id AND a client-minted uuid.
  // The backend ensures the `Bill_{billId}` parent itself; the client must not create it.
  DMS_BILL_ITEM_FOLDER: '/api/dms/bill-item-folder',

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

  // Inventory — audited against ParlourInventoryController 2026-08-07.
  //
  // Seven of the ten routes here used to be wrong (`/add`, `/view/{id}`, `/viewByProduct`,
  // `/viewByBusiness/{id}`, `/updateStatus/{id}`, `/delete/{id}`, and a PUT `/update` with no
  // backend at all), so the screen could not load or save anything. If you add a route, open the
  // controller — do not pattern-match off the other resources, which do use `/add` and `/viewAll`.
  //
  // Ids are PATH SEGMENTS here, so most calls build off the base. Note POST create needs the
  // TRAILING SLASH — `@PostMapping("/")` does not match a bare `/parlourInventory`.
  INVENTORY_BASE: '/parlourInventory',
  INVENTORY_BY_PRODUCT: '/parlourInventory/byProduct',
  INVENTORY_BY_BUSINESS: '/parlourInventory/byBusiness',
  INVENTORY_STATUS_COUNTS: '/parlourInventory/byBusiness/statusCounts',
  INVENTORY_TOTAL_STOCK: '/parlourInventory/totalStock',
  INVENTORY_IS_AVAILABLE: '/parlourInventory/isAvailable',
  INVENTORY_EXPIRING: '/parlourInventory/expiring',

  // Dispose is a WASTAGE endpoint, not an inventory one, and is @TabGated(WASTAGE) — it can 403
  // while inventory works perfectly. See `canDispose` for the client-side gate.
  WASTAGE_DISPOSE: '/parlourWastage/dispose',

  // ─── Consumption ───────────────────────────────────────────────────────────
  //
  // The worked example the two slices below copy. Same shape as the inventory block: ids are PATH
  // SEGMENTS, so GET-one and DELETE build off the base, and the list lives under `/byBusiness`.
  //
  // ⚠️ POST needs a TRAILING SLASH — `@PostMapping("/")` does not match a bare
  // `/parlourConsumption`, and the 404 comes back with nothing in it to explain why. The slash is
  // added at the call site rather than baked in here, matching `INVENTORY_BASE`, so the same
  // constant still serves `GET /{id}` and `DELETE /{id}`.
  CONSUMPTION_BASE: '/parlourConsumption',
  CONSUMPTION_BY_BUSINESS: '/parlourConsumption/byBusiness',

  // ─── Wastage ───────────────────────────────────────────────────────────────
  //
  // Same shape as the consumption pair above: ids are PATH SEGMENTS, so GET-one and DELETE build off
  // the base, and the list lives under `/byBusiness`.
  //
  // ⚠️ POST needs a TRAILING SLASH, exactly as consumption and inventory do — `@PostMapping("/")`
  // does not match a bare `/parlourWastage`, and the 404 carries nothing to explain itself. Added at
  // the call site rather than baked in here so the same constant still serves `GET|DELETE /{id}`.
  //
  // Note `WASTAGE_DISPOSE` above shares this controller but is NOT this feature: it is inventory's
  // Dispose action on one expired batch, and it is not the base to build the CRUD off.
  WASTAGE_BASE: '/parlourWastage',
  WASTAGE_BY_BUSINESS: '/parlourWastage/byBusiness',

  // ─── Stock Transfer ────────────────────────────────────────────────────────
  // Shaped exactly like the consumption pair above: ids are PATH SEGMENTS, so GET-one and DELETE
  // build off the base and the list lives under `/byBusiness`.
  //
  // ⚠️ POST needs a TRAILING SLASH — `@PostMapping("/")` does not match a bare
  // `/parlourStockTransfer`, and the 404 says nothing about why. Added at the call site rather than
  // baked in here so the same constant still serves `GET /{id}` and `DELETE /{id}`.
  STOCK_TRANSFER_BASE: '/parlourStockTransfer',
  STOCK_TRANSFER_BY_BUSINESS: '/parlourStockTransfer/byBusiness',

  // ─── Expense ───────────────────────────────────────────────────────────────
  // Same shape as the three above — ids are PATH SEGMENTS, the list lives under `/byBusiness` — but
  // this feature has two endpoints the stock ones do not, because an expense is mutable:
  //
  //   • `PUT {base}/{id}` — a real update. Consumption, wastage and stock transfer have no PUT at
  //     all; changing one of those would mean re-running a stock movement. An expense moves no
  //     stock, so it can simply be corrected.
  //   • `PATCH {base}/{id}/reimburse` — the ONLY route to a settled expense. The reimbursement
  //     state is not writable through PUT (the server drops those three fields), and there is no
  //     un-reimburse endpoint: settling is terminal.
  //
  // ⚠️ POST needs a TRAILING SLASH, exactly as the three above — `@PostMapping("/")` does not match
  // a bare `/parlourExpense`. Added at the call site so the same constant still serves
  // `GET|PUT|DELETE /{id}`.
  EXPENSE_BASE: '/parlourExpense',
  EXPENSE_BY_BUSINESS: '/parlourExpense/byBusiness',
  // Per-category sums over a date range. The list endpoint reports `totalPages` and nothing else,
  // so this is the ONLY way to put a real ₹ figure in the header — a count is simply not available.
  EXPENSE_TOTAL_BY_CATEGORY: '/parlourExpense/totalByCategory',
};
