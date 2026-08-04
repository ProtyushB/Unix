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
    id: 'owner/customers',
    title: 'Customers',
    group: 'Owner',
    load: () => import('../src/screens/owner/CustomersScreen'),
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
    load: () => import('../src/screens/owner/OrdersScreen'),
  },
  {
    id: 'owner/appointments',
    title: 'Appointments',
    group: 'Owner',
    load: () => import('../src/screens/owner/appointments/AppointmentsScreen'),
  },
  {
    id: 'owner/billing',
    title: 'Billing',
    group: 'Owner',
    load: () => import('../src/screens/owner/billing/BillingScreen'),
  },
  {
    id: 'owner/inventory',
    title: 'Inventory',
    group: 'Owner',
    load: () => import('../src/screens/owner/InventoryScreen'),
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
