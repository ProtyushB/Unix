import React, { type ComponentType } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Screen registry.
//
// Add a screen here to make it previewable. Each entry lazy-imports the real
// screen from ../src, so a screen that fails to bundle/run only breaks its own
// preview (caught by the error boundary) — never the whole harness.
//
// Screens use a mix of `export default` and named exports; `pick()` resolves
// either, so you usually don't need to name the export. Pass `exportName` only
// to disambiguate a file with several exported components.
// ─────────────────────────────────────────────────────────────────────────────

export interface ScreenEntry {
  id: string;
  title: string;
  group: string;
  /** Static-analyzable dynamic import of the screen module. */
  load: () => Promise<Record<string, unknown>>;
  /** Optional named export to use instead of the default / first component. */
  exportName?: string;
  /** route.params handed to the screen via the mock navigator. */
  params?: Record<string, unknown>;
}

function pick(mod: Record<string, unknown>, name?: string): ComponentType<any> {
  const candidate =
    (name && mod[name]) || mod.default || Object.values(mod).find((v) => typeof v === 'function');
  if (!candidate) throw new Error('No component export found in module');
  return candidate as ComponentType<any>;
}

export function lazyScreen(entry: ScreenEntry) {
  return React.lazy(async () => ({ default: pick(await entry.load(), entry.exportName) }));
}

// ─── Registered screens ──────────────────────────────────────────────────────
// Grouped by area. Extend freely — one line per screen.

export const REGISTRY: ScreenEntry[] = [
  // Auth
  {
    id: 'auth/landing',
    title: 'Landing',
    group: 'Auth',
    load: () => import('../src/screens/auth/LandingScreen'),
  },
  {
    id: 'auth/login',
    title: 'Login',
    group: 'Auth',
    load: () => import('../src/screens/auth/LoginScreen'),
  },
  {
    id: 'auth/portal',
    title: 'Portal Selection',
    group: 'Auth',
    load: () => import('../src/screens/auth/PortalSelectionScreen'),
  },
  {
    id: 'auth/signup',
    title: 'Signup',
    group: 'Auth',
    load: () => import('../src/screens/auth/SignupScreen'),
  },
  {
    id: 'auth/payment',
    title: 'Payment',
    group: 'Auth',
    load: () => import('../src/screens/auth/PaymentScreen'),
  },
  {
    id: 'auth/forgot-pw-email',
    title: 'Forgot Password · Email',
    group: 'Auth',
    load: () => import('../src/screens/auth/ForgotPasswordEmailScreen'),
  },
  {
    id: 'auth/forgot-pw-otp',
    title: 'Forgot Password · OTP',
    group: 'Auth',
    load: () => import('../src/screens/auth/ForgotPasswordOtpScreen'),
  },

  // Owner
  {
    id: 'owner/dashboard',
    title: 'Dashboard',
    group: 'Owner',
    load: () => import('../src/screens/owner/DashboardScreen'),
  },
  {
    id: 'owner/products',
    title: 'Products',
    group: 'Owner',
    load: () => import('../src/screens/owner/products/ProductsScreen'),
  },
  {
    // The detail screen takes its mode and id from route params, so the preview registers one
    // entry per mode rather than one screen you cannot reach the other states of.
    id: 'owner/product-detail-view',
    title: 'Product Detail · View',
    group: 'Owner',
    params: { productId: 1, mode: 'view' },
    load: () => import('../src/screens/owner/products/detail/ProductDetailScreen'),
  },
  {
    id: 'owner/product-detail-edit',
    title: 'Product Detail · Edit',
    group: 'Owner',
    params: { productId: 1, mode: 'edit' },
    load: () => import('../src/screens/owner/products/detail/ProductDetailScreen'),
  },
  {
    id: 'owner/product-detail-add',
    title: 'Product Detail · Add',
    group: 'Owner',
    params: { mode: 'add' },
    load: () => import('../src/screens/owner/products/detail/ProductDetailScreen'),
  },
  {
    id: 'owner/services',
    title: 'Services',
    group: 'Owner',
    load: () => import('../src/screens/owner/services/ServicesScreen'),
  },
  {
    // One entry per mode, same as the product detail trio — the screen takes its mode and id from
    // route params, so a single entry would leave the other two states unreachable.
    id: 'owner/service-detail-view',
    title: 'Service Detail · View',
    group: 'Owner',
    params: { serviceId: 70, mode: 'view' },
    load: () => import('../src/screens/owner/services/detail/ServiceDetailScreen'),
  },
  {
    id: 'owner/service-detail-edit',
    title: 'Service Detail · Edit',
    group: 'Owner',
    params: { serviceId: 70, mode: 'edit' },
    load: () => import('../src/screens/owner/services/detail/ServiceDetailScreen'),
  },
  {
    id: 'owner/service-detail-add',
    title: 'Service Detail · Add',
    group: 'Owner',
    params: { mode: 'add' },
    load: () => import('../src/screens/owner/services/detail/ServiceDetailScreen'),
  },
  {
    id: 'owner/customers',
    title: 'Customers',
    group: 'Owner',
    load: () => import('../src/screens/owner/customers/CustomersScreen'),
  },
  {
    id: 'owner/customer-profile',
    title: 'Customer Profile',
    group: 'Owner',
    // The whole record, because this screen cannot fetch one — see `CustomerProfileScreen`. That
    // also makes this the one preview entry whose params are a fixture rather than an id.
    params: {
      customer: {
        personId: 42,
        firstName: 'Priya',
        lastName: 'Sharma',
        email: 'priya@mail.com',
        phoneNumber: '+91 98765 43210',
        totalSpent: 42300,
        activityCount: 18,
        firstSeenAt: '2025-03-12T09:20:00.000Z',
        lastActivityAt: '2026-08-04T12:50:00.000Z',
      },
    },
    load: () => import('../src/screens/owner/customers/CustomerProfileScreen'),
  },
  {
    // One entry, not three: unlike the product/service detail screens the picker's three states
    // are internal, so the gallery can walk list → results → create from a single mount. The host
    // exists because the picker is a Modal and has nothing to render into on its own.
    id: 'owner/customer-picker',
    title: 'Customer Picker · Shared',
    group: 'Shared',
    load: () => import('./hosts/CustomerPickerHost'),
  },
  {
    id: 'owner/employees',
    title: 'Employees',
    group: 'Owner',
    load: () => import('../src/screens/owner/EmployeesScreen'),
  },
  {
    id: 'owner/orders',
    title: 'Orders',
    group: 'Owner',
    load: () => import('../src/screens/owner/orders/OrdersScreen'),
  },
  {
    // One entry per mode, same as the product and service detail trios.
    id: 'owner/order-detail-view',
    title: 'Order Detail · View',
    group: 'Owner',
    params: { orderId: 94, mode: 'view' },
    load: () => import('../src/screens/owner/orders/detail/OrderDetailScreen'),
  },
  {
    id: 'owner/order-detail-edit',
    title: 'Order Detail · Edit',
    group: 'Owner',
    params: { orderId: 94, mode: 'edit' },
    load: () => import('../src/screens/owner/orders/detail/OrderDetailScreen'),
  },
  {
    id: 'owner/order-detail-add',
    title: 'Order Detail · Add',
    group: 'Owner',
    params: { mode: 'add' },
    load: () => import('../src/screens/owner/orders/detail/OrderDetailScreen'),
  },
  {
    id: 'owner/appointments',
    title: 'Appointments',
    group: 'Owner',
    load: () => import('../src/screens/owner/appointments/AppointmentsScreen'),
  },
  {
    id: 'owner/appointment-detail-view',
    title: 'Appointment Detail · View',
    group: 'Owner',
    params: { appointmentId: 51, mode: 'view' },
    load: () => import('../src/screens/owner/appointments/detail/AppointmentDetailScreen'),
  },
  {
    id: 'owner/appointment-detail-edit',
    title: 'Appointment Detail · Edit',
    group: 'Owner',
    params: { appointmentId: 51, mode: 'edit' },
    load: () => import('../src/screens/owner/appointments/detail/AppointmentDetailScreen'),
  },
  {
    id: 'owner/appointment-detail-add',
    title: 'Appointment Detail · Add',
    group: 'Owner',
    params: { mode: 'add' },
    load: () => import('../src/screens/owner/appointments/detail/AppointmentDetailScreen'),
  },
  {
    id: 'owner/billing',
    title: 'Billing',
    group: 'Owner',
    load: () => import('../src/screens/owner/billing/BillingScreen'),
  },
  {
    id: 'owner/bill-detail-view',
    title: 'Bill Detail · View',
    group: 'Owner',
    params: { billId: 51, mode: 'view' },
    load: () => import('../src/screens/owner/billing/detail/BillDetailScreen'),
  },
  {
    id: 'owner/bill-detail-edit',
    title: 'Bill Detail · Edit',
    group: 'Owner',
    params: { billId: 51, mode: 'edit' },
    load: () => import('../src/screens/owner/billing/detail/BillDetailScreen'),
  },
  {
    id: 'owner/bill-detail-add',
    title: 'Bill Detail · Add',
    group: 'Owner',
    params: { mode: 'add' },
    load: () => import('../src/screens/owner/billing/detail/BillDetailScreen'),
  },
  {
    id: 'owner/inventory',
    title: 'Inventory',
    group: 'Owner',
    load: () => import('../src/screens/owner/inventory/InventoryScreen'),
  },
  {
    id: 'owner/consumptions',
    title: 'Consumptions',
    group: 'Owner',
    load: () => import('../src/screens/owner/consumptions/ConsumptionsScreen'),
  },
  {
    // Two entries, not three: a consumption is immutable, so there is no edit mode to preview.
    id: 'owner/consumption-detail-view',
    title: 'Consumption Detail · View',
    group: 'Owner',
    params: { consumptionId: 1, mode: 'view' },
    load: () => import('../src/screens/owner/consumptions/detail/ConsumptionDetailScreen'),
  },
  {
    id: 'owner/consumption-detail-add',
    title: 'Consumption Detail · Add',
    group: 'Owner',
    params: { mode: 'add' },
    load: () => import('../src/screens/owner/consumptions/detail/ConsumptionDetailScreen'),
  },
  {
    id: 'owner/wastage',
    title: 'Wastage',
    group: 'Owner',
    load: () => import('../src/screens/owner/wastage/WastageScreen'),
  },
  {
    id: 'owner/wastage-detail-view',
    title: 'Wastage Detail · View',
    group: 'Owner',
    params: { wastageId: 1, mode: 'view' },
    load: () => import('../src/screens/owner/wastage/detail/WastageDetailScreen'),
  },
  {
    id: 'owner/wastage-detail-add',
    title: 'Wastage Detail · Add',
    group: 'Owner',
    params: { mode: 'add' },
    load: () => import('../src/screens/owner/wastage/detail/WastageDetailScreen'),
  },
  {
    id: 'owner/expenses',
    title: 'Expenses',
    group: 'Owner',
    load: () => import('../src/screens/owner/expenses/ExpensesScreen'),
  },
  {
    id: 'owner/expense-detail-view',
    title: 'Expense Detail · View',
    group: 'Owner',
    params: { expenseId: 1, mode: 'view' },
    load: () => import('../src/screens/owner/expenses/detail/ExpenseDetailScreen'),
  },
  {
    id: 'owner/expense-detail-add',
    title: 'Expense Detail · Add',
    group: 'Owner',
    params: { mode: 'add' },
    load: () => import('../src/screens/owner/expenses/detail/ExpenseDetailScreen'),
  },
  {
    id: 'owner/expense-detail-edit',
    title: 'Expense Detail · Edit',
    group: 'Owner',
    params: { expenseId: 1, mode: 'edit' },
    load: () => import('../src/screens/owner/expenses/detail/ExpenseDetailScreen'),
  },
  {
    id: 'owner/stock-transfers',
    title: 'Stock Transfers',
    group: 'Owner',
    load: () => import('../src/screens/owner/stockTransfers/StockTransfersScreen'),
  },
  {
    id: 'owner/stock-transfer-detail-view',
    title: 'Stock Transfer Detail · View',
    group: 'Owner',
    params: { stockTransferId: 1, mode: 'view' },
    load: () => import('../src/screens/owner/stockTransfers/detail/StockTransferDetailScreen'),
  },
  {
    id: 'owner/stock-transfer-detail-add',
    title: 'Stock Transfer Detail · Add',
    group: 'Owner',
    params: { mode: 'add' },
    load: () => import('../src/screens/owner/stockTransfers/detail/StockTransferDetailScreen'),
  },
  {
    id: 'owner/reports',
    title: 'Reports',
    group: 'Owner',
    load: () => import('../src/screens/owner/ReportsScreen'),
  },
  {
    id: 'owner/account',
    title: 'Account',
    group: 'Owner',
    load: () => import('../src/screens/owner/AccountScreen'),
  },

  // Customer
  {
    id: 'customer/explore',
    title: 'Explore',
    group: 'Customer',
    load: () => import('../src/screens/customer/ExploreScreen'),
  },
  {
    id: 'customer/bookings',
    title: 'Bookings',
    group: 'Customer',
    load: () => import('../src/screens/customer/BookingsScreen'),
  },
  {
    id: 'customer/bills',
    title: 'Bills',
    group: 'Customer',
    load: () => import('../src/screens/customer/BillsScreen'),
  },
  {
    id: 'customer/orders',
    title: 'Orders',
    group: 'Customer',
    load: () => import('../src/screens/customer/CustomerOrdersScreen'),
  },
  {
    id: 'customer/profile',
    title: 'Profile',
    group: 'Customer',
    load: () => import('../src/screens/customer/CustomerProfileScreen'),
  },

  // Shared
  {
    id: 'shared/security',
    title: 'Security',
    group: 'Shared',
    load: () => import('../src/screens/shared/SecurityScreen'),
  },
  {
    id: 'shared/auth-methods',
    title: 'Auth Methods',
    group: 'Shared',
    load: () => import('../src/screens/shared/AuthMethodsScreen'),
  },
];
