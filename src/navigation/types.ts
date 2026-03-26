export type AuthStackParamList = {
  Splash: undefined;
  Landing: undefined;
  Login: undefined;
  SignupEmail: undefined;
  OtpVerification: {email: string};
  SignupCredentials: {email: string};
  ProfilePersonal: {email: string; username: string};
  ProfileBusiness: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
  };
  Review: {personal: PersonalData; businesses: BusinessData[]};
  PortalSelection: undefined;
  ForgotPasswordEmail: undefined;
  ForgotPasswordOtp: {email: string};
  ForgotPasswordNew: {email: string};
};

export type RootStackParamList = {
  Auth: undefined;
  OwnerTabs: undefined;
  CustomerTabs: undefined;
};

export type OwnerTabParamList = {
  Dashboard: undefined;
  Catalog: undefined;
  Operations: undefined;
  Inventory: undefined;
  People: undefined;
  Account: undefined;
};

export type CatalogStackParamList = {
  CatalogMain: undefined;
  ProductDetail: {productId?: number; mode: 'view' | 'edit' | 'add'};
  ServiceDetail: {serviceId?: number; mode: 'view' | 'edit' | 'add'};
};

export type OperationsStackParamList = {
  OperationsMain: undefined;
  OrderDetail: {orderId: number};
  AppointmentDetail: {appointmentId: number};
  BillingDetail: {billId: number};
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
