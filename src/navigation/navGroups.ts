import {
  LayoutDashboard, Package, Calendar, Receipt,
  ShoppingBag, Layers,
  Gift, Repeat2, CalendarClock,
  Archive, Beaker, ArrowLeftRight, AlertTriangle,
  User, Users,
  ShieldCheck, Star,
  BarChart3,
  Wallet, Tag, Boxes, Handshake, UserCircle,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { OwnerTabParamList } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NavItem {
  icon:   LucideIcon;
  label:  string;
  badge?: string;
  route:  { tab: keyof OwnerTabParamList };
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

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    groupIcon: LayoutDashboard,
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', route: { tab: 'Dashboard' } },
    ],
  },
  {
    id: 'transactions',
    label: 'Transactions',
    groupIcon: Wallet,
    items: [
      { icon: Package,  label: 'Orders',       route: { tab: 'Orders' } },
      { icon: Calendar, label: 'Appointments', route: { tab: 'Appointments' }, badge: '5' },
      { icon: Receipt,  label: 'Billing',      route: { tab: 'Billing' } },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    groupIcon: Tag,
    items: [
      { icon: ShoppingBag, label: 'Products', route: { tab: 'Products' }, badge: '24' },
      { icon: Layers,      label: 'Services', route: { tab: 'Services' } },
    ],
  },
  {
    id: 'bundles',
    label: 'Bundles',
    groupIcon: Gift,
    items: [
      { icon: Gift,          label: 'Packages',      route: { tab: 'Packages' } },
      { icon: Repeat2,       label: 'Subscriptions', route: { tab: 'Subscriptions' } },
      { icon: CalendarClock, label: 'Service Plans', route: { tab: 'ServicePlans' } },
    ],
  },
  {
    id: 'stock',
    label: 'Stock & Ops',
    groupIcon: Boxes,
    items: [
      { icon: Archive,        label: 'Inventory',       route: { tab: 'Inventory' } },
      { icon: Beaker,         label: 'Consumptions',    route: { tab: 'Consumptions' } },
      { icon: ArrowLeftRight, label: 'Stock Transfers', route: { tab: 'StockTransfers' } },
      { icon: AlertTriangle,  label: 'Wastage',         route: { tab: 'Wastage' } },
    ],
  },
  {
    id: 'contacts',
    label: 'Contacts',
    groupIcon: User,
    items: [
      { icon: User, label: 'Customers', route: { tab: 'Customers' } },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    groupIcon: Users,
    items: [
      { icon: Users, label: 'Employees', route: { tab: 'Employees' } },
    ],
  },
  {
    id: 'post-sale',
    label: 'Post-sale',
    groupIcon: Handshake,
    items: [
      { icon: ShieldCheck, label: 'Warranty Claims', route: { tab: 'WarrantyClaims' } },
      { icon: Star,        label: 'Loyalty',         route: { tab: 'Loyalty' } },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    groupIcon: BarChart3,
    items: [
      { icon: BarChart3, label: 'Reports', route: { tab: 'Reports' } },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    groupIcon: UserCircle,
    items: [
      { icon: User, label: 'Profile', route: { tab: 'Account' } },
    ],
  },
];

// ─── Lookups ─────────────────────────────────────────────────────────────────

export function findGroupByTabName(tabName: string): NavGroup | undefined {
  return NAV_GROUPS.find(g => g.items.some(it => it.route.tab === tabName));
}
