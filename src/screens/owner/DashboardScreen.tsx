import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  PackagePlus,
  ShoppingCart,
  CalendarPlus,
  ReceiptText,
  CalendarX,
  Plus,
} from 'lucide-react-native';

import {
  DashboardHeader,
  BusinessSwitcherChip,
  SectionHead,
  StatCard,
  QuickActionTile,
  RecentOrderRow,
  RecentAppointmentRow,
  SectionEmptyCard,
  DashboardErrorCard,
  LiveDataBanner,
  ActivationPendingPanel,
  DashboardSkeleton,
  type StatTrend,
  type RecentOrder,
  type RecentAppointment,
} from '../../components/dashboard';

import { useParlour } from '../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../backend/modules/pharmacy/hook/usePharmacy';
import { useRestaurant } from '../../backend/modules/restaurant/hook/useRestaurant';
import { useDashboard } from '../../backend/dashboard/hook/useDashboard';
import type { DashboardMetric } from '../../backend/dashboard/api/dashboard.api.interface';

import { useAppContext } from '../../context/AppContext';
import { refreshBusinessProfile } from '../../backend/person/service/profile.sync';
import { findBusiness, type Business } from '../../storage/session.storage';
import { formatCompactCurrency, formatSyncTime } from '../../utils/formatters';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';
import { openBusinessSheet } from '../../navigation/businessSheetState';

// ─── Constants ──────────────────────────────────────────────────────────────

const SUPPORT_EMAIL = 'support@eternitytechnologies.in';

/** Rows shown per section on the dashboard, per the mockup. */
const RECENT_LIMIT = 3;
// Fetched upfront so "See all" can reveal the extra rows inline (the mockup's
// "Lists Expanded" state) without a second round-trip. RECENT_LIMIT is the
// collapsed preview count; the rest stay hidden until expanded.
const EXPANDED_LIMIT = 10;

// ─── Row mapping ────────────────────────────────────────────────────────────
// The list endpoints return the raw backend DTOs. Field names mirror the
// Centrix owner portal's dashboard table (OwnerPortal.jsx:2236-2277) — note
// `orderStatus` / `appointmentStatus`, NOT `status`.

function customerNameOf(row: any): string {
  if (row.customerFirstName && row.customerLastName) {
    return `${row.customerFirstName} ${row.customerLastName}`;
  }
  return row.customerName || row.customer || 'Unknown Customer';
}

function toRecentOrder(row: any, index: number): RecentOrder {
  return {
    id: row.id ?? index,
    customerName: customerNameOf(row),
    orderNumber: row.orderNumber || `#${row.id ?? index}`,
    amount: Number(row.totalAmount ?? 0),
    status: row.orderStatus || 'PENDING',
    when: row.orderDate || row.createdAt || null,
  };
}

function serviceNameOf(row: any): string {
  const items = row.appointedServiceItemsWithDetails || row.appointedServiceItems || [];
  const first = items[0];
  if (first?.serviceName) return first.serviceName;
  const count = items.length;
  return count ? `${count} service${count === 1 ? '' : 's'}` : 'Appointment';
}

function toRecentAppointment(row: any, index: number): RecentAppointment {
  return {
    id: row.id ?? index,
    serviceName: serviceNameOf(row),
    customerName: customerNameOf(row),
    appointmentNumber: row.appointmentNumber || `#${row.id ?? index}`,
    status: row.appointmentStatus || 'PENDING',
    when: row.appointmentDateTime || row.appointmentDate || null,
  };
}

// ─── Stat mapping ───────────────────────────────────────────────────────────

function trendOf(metric: DashboardMetric | undefined, unavailable: boolean): StatTrend {
  if (unavailable) return 'unavailable';
  if (!metric || metric.changePct == null || metric.changePct === 0) return 'flat';
  return metric.trendUp ? 'up' : 'down';
}

function deltaOf(metric: DashboardMetric | undefined): string {
  if (!metric || metric.changePct == null) return '';
  return `${Math.abs(metric.changePct)}%`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { selectedModule, selectedBusiness } = useAppContext();

  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const restaurant = useRestaurant();

  // `selectedModule` holds the raw business-type key (PARLOUR / PHARMACY / …),
  // written by AppContext. Compare case-insensitively — the previous
  // implementation matched title-case ("Restaurant") and so always fell
  // through to Parlour.
  const moduleKey = (selectedModule || '').toUpperCase();
  const activeModule =
    moduleKey === 'RESTAURANT' ? restaurant
      : moduleKey === 'PHARMACY' ? pharmacy
        : parlour;

  const dashboard = useDashboard();

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  // No <StatusBar> here — OwnerTabNavigator sets one theme-aware bar for the whole portal.

  const [business, setBusiness] = useState<Business | null>(null);
  const [businessResolved, setBusinessResolved] = useState(false);
  const [listsLoading, setListsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const [apptsExpanded, setApptsExpanded] = useState(false);

  // ─── Load ─────────────────────────────────────────────────────────────────
  // `loadFor` takes the business explicitly rather than reading it off state:
  // handleRefresh resolves a fresh record and must act on THAT, not on the
  // value captured when the callback was created.

  const loadFor = useCallback(async (biz: Business | null) => {
    // A locked business gets no data calls — the backend would 403 them anyway.
    if (!biz?.id || biz.isPaymentVerified === false) {
      setListsLoading(false);
      return;
    }
    setListsLoading(true);
    await Promise.all([
      dashboard.reload(biz.id),
      activeModule.loadOrders(1, EXPANDED_LIMIT),
      activeModule.loadAppointments(1, EXPANDED_LIMIT),
    ]);
    setListsLoading(false);
    // `dashboard` and `activeModule` are rebuilt on every render by their hook
    // factories, but the callbacks we use off them (`reload`, `loadOrders`,
    // `loadAppointments`) are individually stable. Depending on the wrapper
    // objects here would re-create loadFor every render and loop the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveAndLoad = useCallback(async () => {
    const biz = await findBusiness(selectedModule, selectedBusiness);
    setBusiness(biz);
    setBusinessResolved(true);
    await loadFor(biz);
    return biz;
  }, [selectedModule, selectedBusiness, loadFor]);

  useEffect(() => {
    setBusinessResolved(false);
    resolveAndLoad();
  }, [resolveAndLoad]);

  const isLocked = business?.isPaymentVerified === false;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Pull the profile again first. The business record — and with it
    // `isPaymentVerified` — is cached at login, so without this the lock
    // panel's "Refresh Status" could never clear.
    await refreshBusinessProfile();
    await resolveAndLoad();
    setRefreshing(false);
  }, [resolveAndLoad]);

  const handleContactSupport = useCallback(() => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {});
  }, []);

  // ─── Derived view state ───────────────────────────────────────────────────

  const orders = useMemo(
    () => (activeModule.orders || []).slice(0, EXPANDED_LIMIT).map(toRecentOrder),
    [activeModule.orders],
  );
  const appointments = useMemo(
    () => (activeModule.appointments || []).slice(0, EXPANDED_LIMIT).map(toRecentAppointment),
    [activeModule.appointments],
  );

  // Collapsed shows RECENT_LIMIT; "See all" reveals the rest inline. The toggle
  // only appears when there are extra rows to reveal.
  const visibleOrders   = ordersExpanded ? orders : orders.slice(0, RECENT_LIMIT);
  const visibleAppts    = apptsExpanded  ? appointments : appointments.slice(0, RECENT_LIMIT);
  const ordersCanExpand = orders.length > RECENT_LIMIT;
  const apptsCanExpand  = appointments.length > RECENT_LIMIT;

  const stats = dashboard.summary?.stats;
  const hasError = !!dashboard.error;

  // Four distinct hues, all theme tokens so they stay legible in light mode.
  // The mockup's violet has no counterpart in the palette; amber stands in.
  const statCards = useMemo(() => [
    {
      key: 'revenue',
      label: 'Revenue',
      color: palette.success,
      metric: stats?.todaysRevenue,
      format: (v: number) => formatCompactCurrency(v),
      zero: '₹0',
    },
    {
      key: 'orders',
      label: 'Orders',
      color: colors.primary,
      metric: stats?.todaysOrders,
      format: (v: number) => String(v),
      zero: '0',
    },
    {
      key: 'appointments',
      label: 'Appointments',
      color: palette.info,
      metric: stats?.todaysAppointments,
      format: (v: number) => String(v),
      zero: '0',
    },
    {
      key: 'customers',
      label: 'Customers',
      color: palette.warning,
      metric: stats?.todaysActiveCustomers,
      format: (v: number) => String(v),
      zero: '0',
    },
  ], [stats, colors.primary, palette.success, palette.info, palette.warning]);

  const quickActions = useMemo(() => [
    { key: 'product', icon: PackagePlus, label: 'Product', color: colors.primary, tab: 'Products' },
    { key: 'order', icon: ShoppingCart, label: 'Order', color: palette.info, tab: 'Orders' },
    { key: 'booking', icon: CalendarPlus, label: 'Booking', color: palette.success, tab: 'Appointments' },
    { key: 'invoice', icon: ReceiptText, label: 'Invoice', color: palette.warning, tab: 'Billing' },
  ], [colors.primary, palette.info, palette.success, palette.warning]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const header = (
    <DashboardHeader
      businessName={selectedBusiness}
      businessType={selectedModule}
      onSwitchBusiness={openBusinessSheet}
    />
  );

  // 1. Activation Pending — the business exists but payment is unverified.
  if (isLocked) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.lockedTopBar}>
          <BusinessSwitcherChip
            businessName={selectedBusiness}
            businessType={selectedModule}
            onSwitchBusiness={openBusinessSheet}
          />
        </View>
        <ActivationPendingPanel
          businessName={selectedBusiness}
          refreshing={refreshing}
          onRefreshStatus={handleRefresh}
          onContactSupport={handleContactSupport}
        />
      </SafeAreaView>
    );
  }

  // 2. Loading — first paint, nothing cached to show yet.
  const isFirstLoad = !businessResolved || (listsLoading && !stats && !hasError);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {header}

        {isFirstLoad ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* 3. Error — stale numbers stay on screen behind an explicit banner. */}
            {hasError && <LiveDataBanner onRetry={handleRefresh} />}

            <View style={styles.statsRow}>
              {statCards.map(card => (
                <StatCard
                  key={card.key}
                  label={card.label}
                  valueColor={card.color}
                  // Zeroes go grey rather than coloured — a green "₹0" reads
                  // like a result, which is the mockup's empty-state point.
                  dimmed={hasError || !card.metric || card.metric.value === 0}
                  value={
                    hasError ? '—'
                      : card.metric ? card.format(card.metric.value)
                        : card.zero
                  }
                  trend={trendOf(card.metric, hasError)}
                  delta={deltaOf(card.metric)}
                />
              ))}
            </View>

            <View style={styles.section}>
              <SectionHead title="Quick Actions" />
              <View style={styles.actionsRow}>
                {quickActions.map(action => (
                  <QuickActionTile
                    key={action.key}
                    icon={action.icon}
                    label={action.label}
                    color={action.color}
                    onPress={() => navigation.navigate(action.tab)}
                  />
                ))}
              </View>
            </View>

            {hasError ? (
              /* The two recent sections collapse into one while data is down. */
              <View style={styles.section}>
                <SectionHead
                  title="Recent Activity"
                  meta={
                    dashboard.lastSyncedAt
                      ? `Last synced ${formatSyncTime(dashboard.lastSyncedAt)}`
                      : undefined
                  }
                />
                <DashboardErrorCard
                  code={dashboard.errorCode}
                  onRetry={handleRefresh}
                  onContactSupport={handleContactSupport}
                />
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <SectionHead
                    title="Recent Orders"
                    actionLabel={
                      ordersCanExpand
                        ? ordersExpanded ? 'Show less' : 'See all'
                        : undefined
                    }
                    expanded={ordersExpanded}
                    onAction={() => setOrdersExpanded(v => !v)}
                  />
                  {orders.length === 0 ? (
                    <SectionEmptyCard
                      icon={ReceiptText}
                      title="No data available"
                      message="No orders have been placed today. New orders will show up here as they come in."
                      actionIcon={Plus}
                      actionLabel="Create Order"
                      onAction={() => navigation.navigate('Orders')}
                    />
                  ) : (
                    <View style={styles.listCard}>
                      {visibleOrders.map((order, i) => (
                        <RecentOrderRow
                          key={order.id}
                          order={order}
                          divided={i < visibleOrders.length - 1}
                          onPress={() => navigation.navigate('Orders')}
                        />
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.section}>
                  <SectionHead
                    title="Recent Appointments"
                    actionLabel={
                      apptsCanExpand
                        ? apptsExpanded ? 'Show less' : 'See all'
                        : undefined
                    }
                    expanded={apptsExpanded}
                    onAction={() => setApptsExpanded(v => !v)}
                  />
                  {appointments.length === 0 ? (
                    <SectionEmptyCard
                      icon={CalendarX}
                      title="No data available"
                      message="Nothing on the books for today. Book an appointment to get started."
                      actionIcon={CalendarPlus}
                      actionLabel="New Booking"
                      onAction={() => navigation.navigate('Appointments')}
                    />
                  ) : (
                    <View style={styles.listCard}>
                      {visibleAppts.map((appt, i) => (
                        <RecentAppointmentRow
                          key={appt.id}
                          appointment={appt}
                          divided={i < visibleAppts.length - 1}
                          onPress={() => navigation.navigate('Appointments')}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        )}

        {/* Clears the floating bottom group nav. */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    lockedTopBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 6,
      paddingHorizontal: 24,
    },
    content: {
      flexGrow: 1,
      gap: 22,
      paddingTop: 6,
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    section: {
      gap: 12,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    listCard: {
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    bottomSpacer: {
      height: 90,
    },
  });
}
