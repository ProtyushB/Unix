import type { NavigatorScreenParams } from '@react-navigation/native';

// AuthStackParamList intentionally lives in AuthNavigator.tsx, next to the
// routes it describes. A second copy here drifted the moment the signup screens
// were merged — it still listed OtpVerification and SignupCredentials long after
// they were deleted, and the barrel was re-exporting that stale copy.

export type RootStackParamList = {
  Auth: undefined;
  OwnerTabs: undefined;
  CustomerTabs: undefined;
};

export type OwnerTabParamList = {
  Dashboard: undefined;
  // The five tabs with a stack behind them, so the only ones whose params are not `undefined`.
  Orders: NavigatorScreenParams<OrdersStackParamList>;
  Appointments: NavigatorScreenParams<AppointmentsStackParamList>;
  Billing: NavigatorScreenParams<BillingStackParamList>;
  Products: NavigatorScreenParams<CatalogStackParamList>;
  Services: NavigatorScreenParams<ServicesStackParamList>;
  Packages: undefined;
  Subscriptions: undefined;
  ServicePlans: undefined;
  Inventory: NavigatorScreenParams<InventoryStackParamList>;
  // The three stock-movement tabs. Stacks, not bare screens, for the same reason Inventory is one:
  // each has a detail route, and each hosts ProductDetail so "New Product" is a push rather than a
  // tab jump.
  Consumptions: NavigatorScreenParams<ConsumptionsStackParamList>;
  StockTransfers: NavigatorScreenParams<StockTransfersStackParamList>;
  Wastage: NavigatorScreenParams<WastageStackParamList>;
  Expenses: NavigatorScreenParams<ExpensesStackParamList>;
  Customers: undefined;
  Employees: undefined;
  WarrantyClaims: undefined;
  Loyalty: undefined;
  Reports: undefined;
  Account: undefined;
};

/**
 * The Products tab's stack.
 *
 * An earlier version of this type rotted — it described a `CatalogMain` and a `ServiceDetail` that
 * no navigator had, because nothing referenced it so nothing could catch the drift. Both of these
 * are wired into `OwnerTabParamList` above and consumed by real navigators, so a mismatch is now a
 * type error rather than a comment nobody reads.
 *
 * The id being absent means add mode: there is no record to fetch.
 */
export type CatalogStackParamList = {
  ProductsMain: undefined;
  ProductDetail: { productId?: number; mode: 'view' | 'edit' | 'add' };
};

/**
 * The Inventory tab's stack.
 *
 * Only two modes, unlike its siblings: a batch is IMMUTABLE after creation — the backend has no PUT
 * — so there is no `'edit'` to navigate to. Stock is corrected through wastage/transfer, lifecycle
 * moves through the status endpoint, and an untouched batch can be deleted.
 */
export type InventoryStackParamList = {
  InventoryMain: undefined;
  InventoryDetail: { batchId?: number; mode: 'view' | 'add' };
  /**
   * The SAME screen the catalog stack registers, deliberately mounted here a second time.
   *
   * "New Product" in the batch picker has to be a push inside THIS stack. Jumping to the Products
   * tab instead would leave the Inventory stack, and the half-filled Add Batch form — four
   * `useState` hooks living exactly as long as the screen is mounted — would be gone by the time
   * the user came back. A push freezes the screen below rather than unmounting it, so the form is
   * still there, and the product screen's own `goBack()` lands straight back on it.
   *
   * This is the one place Unix departs from Centrix, where the equivalent redirect flips tabs and
   * loses the batch outright.
   */
  ProductDetail: { productId?: number; mode: 'view' | 'edit' | 'add' };
};

/**
 * The Consumptions tab's stack.
 *
 * Only two modes, like Inventory's and for the same reason: a consumption is IMMUTABLE — the
 * backend has no PUT — so there is no `'edit'` to navigate to. Correcting one means deleting it
 * (which restocks) and recording it again.
 */
export type ConsumptionsStackParamList = {
  ConsumptionsMain: undefined;
  ConsumptionDetail: { consumptionId?: number; mode: 'view' | 'add' };
  /**
   * The SAME screen the catalog stack registers, deliberately mounted here a second time.
   *
   * "New Product" in the record form's picker has to be a push inside THIS stack. Jumping to the
   * Products tab instead would leave this stack, and the half-filled form — `useState` cells living
   * exactly as long as the screen is mounted — would be gone by the time the user came back. A push
   * freezes the screen below rather than unmounting it, so the form is still there, and the product
   * screen's own `goBack()` lands straight back on it.
   *
   * Route names resolve to the NEAREST navigator, so `navigate('ProductDetail')` from here stays on
   * this stack.
   */
  ProductDetail: { productId?: number; mode: 'view' | 'edit' | 'add' };
};

/** The Wastage tab's stack. Same shape and same reasons as the consumptions one — see above. */
export type WastageStackParamList = {
  WastageMain: undefined;
  WastageDetail: { wastageId?: number; mode: 'view' | 'add' };
  /** "New Product" from the picker. Same reason it is on the Consumptions stack — see above. */
  ProductDetail: { productId?: number; mode: 'view' | 'edit' | 'add' };
};

/**
 * The Expenses tab's stack.
 *
 * ⚠️ Note the mode union: `'view' | 'add' | 'edit'`, THREE where its stock-ops siblings have two.
 * An expense moves no stock, so unlike a consumption / wastage / transfer it can simply be
 * corrected rather than deleted and re-entered.
 *
 * No `ProductDetail` here — an expense names no product, so the picker that makes the other stacks
 * carry it does not exist on this one.
 */
export type ExpensesStackParamList = {
  ExpensesMain: undefined;
  ExpenseDetail: { expenseId?: number; mode: 'view' | 'add' | 'edit' };
};

/** The Stock Transfers tab's stack. Same shape and same reasons — see the consumptions one. */
export type StockTransfersStackParamList = {
  StockTransfersMain: undefined;
  StockTransferDetail: { stockTransferId?: number; mode: 'view' | 'add' };
  /** "New Product" from the picker. Same reason it is on the Consumptions stack — see above. */
  ProductDetail: { productId?: number; mode: 'view' | 'edit' | 'add' };
};

/** The Services tab's stack. Same shape as the catalog's, for the same reasons. */
export type ServicesStackParamList = {
  ServicesMain: undefined;
  ServiceDetail: { serviceId?: number; mode: 'view' | 'edit' | 'add' };
};

/**
 * The Orders tab's stack.
 *
 * Replaces an `OperationsStackParamList` that declared `OrderDetail`, `AppointmentDetail` and
 * `BillingDetail` on ONE stack behind an `OperationsMain` screen that never existed. Nothing
 * consumed it, so nothing could catch the drift — exactly the rot the note above describes. Three
 * tabs means three stacks: a shared one would let a bill's back button land on an order.
 *
 * `mode` is required and the id is not: no id means add mode, since there is no record to fetch.
 */
export type OrdersStackParamList = {
  OrdersMain: undefined;
  OrderDetail: { orderId?: number; mode: 'view' | 'edit' | 'add' };
  /** "New Product" from the products picker. Same reason it is on the Inventory stack — see above. */
  ProductDetail: { productId?: number; mode: 'view' | 'edit' | 'add' };
};

/** The Appointments tab's stack. */
export type AppointmentsStackParamList = {
  AppointmentsMain: undefined;
  AppointmentDetail: { appointmentId?: number; mode: 'view' | 'edit' | 'add' };
  /** "New Service" from the services picker. Same reason it is on the Inventory stack — see above. */
  ServiceDetail: { serviceId?: number; mode: 'view' | 'edit' | 'add' };
};

/** The Billing tab's stack. */
export type BillingStackParamList = {
  BillingMain: undefined;
  BillDetail: { billId?: number; mode: 'view' | 'edit' | 'add' };
};

// Shared stack for both Customer Profile tab and Business Account tab
export type ProfileStackParamList = {
  ProfileMain: undefined;
  Security: undefined;
  AuthMethods: undefined;
};

export type CustomerTabParamList = {
  Explore: undefined;
  Bookings: undefined;
  Orders: undefined;
  Bills: undefined;
  Profile: undefined;
};

export interface PersonalData {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export interface BusinessData {
  businessName: string;
  businessType: string;
  businessPhone: string;
  businessEmail: string;
  cin?: string;
  gstin?: string;
  pan?: string;
}
