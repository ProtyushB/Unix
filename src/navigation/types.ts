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
  Consumptions: undefined;
  StockTransfers: undefined;
  Wastage: undefined;
  Expenses: undefined;
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
};

/** The Appointments tab's stack. */
export type AppointmentsStackParamList = {
  AppointmentsMain: undefined;
  AppointmentDetail: { appointmentId?: number; mode: 'view' | 'edit' | 'add' };
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
