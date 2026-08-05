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
  Orders: undefined;
  Appointments: undefined;
  Billing: undefined;
  // The two tabs with a stack behind them, so the only ones whose params are not `undefined`.
  Products: NavigatorScreenParams<CatalogStackParamList>;
  Services: NavigatorScreenParams<ServicesStackParamList>;
  Packages: undefined;
  Subscriptions: undefined;
  ServicePlans: undefined;
  Inventory: undefined;
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

/** The Services tab's stack. Same shape as the catalog's, for the same reasons. */
export type ServicesStackParamList = {
  ServicesMain: undefined;
  ServiceDetail: { serviceId?: number; mode: 'view' | 'edit' | 'add' };
};

export type OperationsStackParamList = {
  OperationsMain: undefined;
  OrderDetail: { orderId: number };
  AppointmentDetail: { appointmentId: number };
  BillingDetail: { billId: number };
};

export type InventoryStackParamList = {
  InventoryMain: undefined;
};

export type PeopleStackParamList = {
  PeopleMain: undefined;
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
