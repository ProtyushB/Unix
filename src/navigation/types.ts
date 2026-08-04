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
  // The only tab with a stack behind it, so the only one whose params are not `undefined`.
  Products: NavigatorScreenParams<CatalogStackParamList>;
  Services: undefined;
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
 * The previous version of this type rotted — it described `CatalogMain` and a `ServiceDetail` that
 * no navigator ever had, because nothing referenced it so nothing could catch the drift. This one
 * is wired into `OwnerTabParamList.Products` below and consumed by a real navigator, so a mismatch
 * is a type error rather than a comment nobody reads.
 *
 * `productId` absent means add mode: there is no record to fetch.
 */
export type CatalogStackParamList = {
  ProductsMain: undefined;
  ProductDetail: { productId?: number; mode: 'view' | 'edit' | 'add' };
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
