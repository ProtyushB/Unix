import {
  LayoutDashboard, Package, Calendar, Receipt,
  ShoppingBag, Layers,
  Gift, Repeat2, CalendarClock,
  Archive, Beaker, ArrowLeftRight, AlertTriangle, Banknote,
  User, Users,
  ShieldCheck, Star,
  BarChart3,
  Wallet, Tag, Boxes, Handshake, UserCircle,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { OwnerTabParamList } from './types';
// `import type` is load-bearing: a value import would close a real Metro cycle
// (backend/tab-config → business/axios.instance → RootNavigator →
// OwnerTabNavigator → navGroups).
import type { TabKey, TabMap } from '../backend/tab-config';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NavItem {
  icon:   LucideIcon;
  label:  string;
  badge?: string;
  route:  { tab: keyof OwnerTabParamList };
  /**
   * Backend TabKey this item is gated on. Items WITHOUT a tabKey are always
   * visible (same rule as the web sidebar) — that's how Account stays reachable
   * no matter what the business has switched off.
   */
  tabKey?: TabKey;
}

export interface NavGroup {
  id:        string;
  label:     string;
  groupIcon: LucideIcon;
  items:     NavItem[];
}

// ─── Data ────────────────────────────────────────────────────────────────────
// Each item routes to its own dedicated tab in OwnerTabParamList. Groups are
// purely presentational — they determine how items are clustered in the
// bottom-nav sheet, not how screens are mounted.
//
// Group and item order mirrors `Centrix/src/components/Sidebar/navGroups.js`;
// keep the two in step so web and mobile present the same nav. There is no
// ordering field on either side — position in this array IS the order.

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    groupIcon: LayoutDashboard,
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', route: { tab: 'Dashboard' }, tabKey: 'DASHBOARD' },
    ],
  },
  {
    id: 'transactions',
    label: 'Transactions',
    groupIcon: Wallet,
    items: [
      { icon: Package,  label: 'Orders',       route: { tab: 'Orders' },       tabKey: 'ORDERS' },
      { icon: Calendar, label: 'Appointments', route: { tab: 'Appointments' }, tabKey: 'APPOINTMENTS', badge: '5' },
      // Label is "Billing", the backend key is BILLS.
      { icon: Receipt,  label: 'Billing',      route: { tab: 'Billing' },      tabKey: 'BILLS' },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    groupIcon: Tag,
    items: [
      { icon: ShoppingBag, label: 'Products', route: { tab: 'Products' }, tabKey: 'PRODUCTS', badge: '24' },
      { icon: Layers,      label: 'Services', route: { tab: 'Services' }, tabKey: 'SERVICES' },
    ],
  },
  {
    id: 'bundles',
    label: 'Bundles',
    groupIcon: Gift,
    items: [
      { icon: Gift,          label: 'Packages',      route: { tab: 'Packages' },      tabKey: 'PACKAGES' },
      { icon: Repeat2,       label: 'Subscriptions', route: { tab: 'Subscriptions' }, tabKey: 'SUBSCRIPTIONS' },
      { icon: CalendarClock, label: 'Service Plans', route: { tab: 'ServicePlans' },  tabKey: 'SERVICE_PLANS' },
    ],
  },
  {
    id: 'stock',
    label: 'Stock & Ops',
    groupIcon: Boxes,
    items: [
      { icon: Archive,        label: 'Inventory',       route: { tab: 'Inventory' },      tabKey: 'INVENTORY' },
      // Route names are plural, the backend keys are singular — mind the gap.
      { icon: Beaker,         label: 'Consumptions',    route: { tab: 'Consumptions' },   tabKey: 'CONSUMPTION' },
      { icon: ArrowLeftRight, label: 'Stock Transfers', route: { tab: 'StockTransfers' }, tabKey: 'STOCK_TRANSFER' },
      { icon: AlertTriangle,  label: 'Wastage',         route: { tab: 'Wastage' },        tabKey: 'WASTAGE' },
      // No real Expenses screen yet — routes to PlaceholderScreen so the mobile
      // nav lists the same items as the web sidebar and gates on the same key.
      { icon: Banknote,       label: 'Expenses',        route: { tab: 'Expenses' },       tabKey: 'EXPENSES' },
    ],
  },
  {
    id: 'contacts',
    label: 'Contacts',
    groupIcon: User,
    items: [
      { icon: User, label: 'Customers', route: { tab: 'Customers' }, tabKey: 'CUSTOMERS' },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    groupIcon: Users,
    items: [
      { icon: Users, label: 'Employees', route: { tab: 'Employees' }, tabKey: 'EMPLOYEES' },
    ],
  },
  {
    id: 'post-sale',
    label: 'Post-sale',
    groupIcon: Handshake,
    items: [
      { icon: ShieldCheck, label: 'Warranty Claims', route: { tab: 'WarrantyClaims' }, tabKey: 'WARRANTY_CLAIMS' },
      { icon: Star,        label: 'Loyalty',         route: { tab: 'Loyalty' },        tabKey: 'LOYALTY' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    groupIcon: BarChart3,
    items: [
      { icon: BarChart3, label: 'Reports', route: { tab: 'Reports' }, tabKey: 'REPORTS' },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    groupIcon: UserCircle,
    // Intentionally no tabKey: Account is the only route to profile, security and
    // logout, so no tab config may hide it. Mobile-only group — on web these live
    // in the sidebar footer rather than the nav list.
    items: [
      { icon: User, label: 'Profile', route: { tab: 'Account' } },
    ],
  },
];

// ─── Filtering ───────────────────────────────────────────────────────────────

/**
 * Filter NAV_GROUPS against the `{TabKey: boolean}` map from the tab-config
 * backend. Items whose tabKey is explicitly `false` are removed; groups left
 * empty are removed too. Items without a tabKey are always visible.
 *
 * Byte-for-byte the web behaviour — see `filterNavGroupsByTabs` in
 * `Centrix/src/components/Sidebar/navGroups.js`.
 */
export function filterNavGroupsByTabs(
  groups: NavGroup[],
  tabs?: TabMap | null,
): NavGroup[] {
  if (!tabs) return groups;
  return groups
    .map(g => ({ ...g, items: g.items.filter(i => !i.tabKey || tabs[i.tabKey] !== false) }))
    .filter(g => g.items.length > 0);
}

// ─── Lookups ─────────────────────────────────────────────────────────────────

/**
 * Which group owns this route? Deliberately scans the UNFILTERED list — it
 * answers a structural question, independent of what's currently visible.
 */
export function findGroupByTabName(tabName: string): NavGroup | undefined {
  return NAV_GROUPS.find(g => g.items.some(it => it.route.tab === tabName));
}

/** Resolve an item by its route name — used to look up the active tab's tabKey. */
export function findItemByTabName(tabName: string): NavItem | undefined {
  for (const group of NAV_GROUPS) {
    const item = group.items.find(it => it.route.tab === tabName);
    if (item) return item;
  }
  return undefined;
}
