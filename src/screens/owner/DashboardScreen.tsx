import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AppCard } from '../../components/common/AppCard';
import { useParlour } from '../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../backend/modules/pharmacy/hook/usePharmacy';
import { useRestaurant } from '../../backend/modules/restaurant/hook/useRestaurant';
import { useAppContext } from '../../context/AppContext';
import { getBusinessTypeMap, type Business } from '../../storage/session.storage';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getStatusColor } from '../../utils/statusColors';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';
import { openBusinessSheet } from '../../navigation/businessSheetState';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StatItem {
  label: string;
  value: string;
  color: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { selectedModule, selectedBusiness } = useAppContext();

  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const restaurant = useRestaurant();

  const activeModule = selectedModule?.includes('Restaurant')
    ? restaurant
    : selectedModule?.includes('Pharmacy')
      ? pharmacy
      : parlour;

  const [loading, setLoading] = useState(true);

  // Resolve business ID from stable string
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    (async () => {
      const map = await getBusinessTypeMap();
      if (map && selectedModule) {
        const businesses = map[selectedModule] || [];
        const biz = businesses.find((b: Business) => ((b as any).businessName || b.name) === selectedBusiness);
        setSelectedBusinessId(biz?.id ?? null);
      }
    })();
  }, [selectedBusiness, selectedModule]);

  // Load data on selectedBusinessId change — NOT activeModule
  useEffect(() => {
    if (!activeModule || !selectedBusinessId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      activeModule.loadOrders(1, 5),
      activeModule.loadAppointments(1, 5),
    ]).finally(() => setLoading(false));
  }, [selectedBusinessId]);

  const orders = activeModule?.orders || [];
  const appointments = activeModule?.appointments || [];

  const stats: StatItem[] = [
    { label: 'Revenue', value: formatCurrency(orders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0)), color: '#10b981' },
    { label: 'Orders', value: String(orders.length), color: '#f97316' },
    { label: 'Appointments', value: String(appointments.length), color: '#8b5cf6' },
    { label: 'Customers', value: String(new Set([...orders.map((o: any) => o.customerId), ...appointments.map((a: any) => a.customerId)]).size), color: '#0ea5e9' },
  ];

  const handleQuickAction = useCallback((action: string) => {
    switch (action) {
      case 'product':
        navigation.navigate('Catalog', {
          screen: 'ProductDetailScreen',
          params: { mode: 'add' },
        });
        break;
      case 'order':
        navigation.navigate('Operations', {
          screen: 'OrderDetailScreen',
          params: { orderId: -1 },
        });
        break;
      case 'appointment':
        navigation.navigate('Operations', {
          screen: 'AppointmentDetailScreen',
          params: { appointmentId: -1 },
        });
        break;
      case 'invoice':
        navigation.navigate('Operations', {
          screen: 'BillingDetailScreen',
          params: { billId: -1 },
        });
        break;
    }
  }, [navigation]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const renderOrderItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.listItem}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('Operations', {
        screen: 'OrderDetailScreen',
        params: { orderId: item.id },
      })}
    >
      <View style={styles.listItemLeft}>
        <Text style={styles.listItemTitle}>Order #{item.id}</Text>
        <Text style={styles.listItemSub}>
          {item.customerName || 'Customer'} {item.orderDate ? `- ${formatDate(item.orderDate)}` : ''}
        </Text>
      </View>
      <View style={styles.listItemRight}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status || 'PENDING') + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status || 'PENDING') }]}>
            {item.status || 'PENDING'}
          </Text>
        </View>
        <Text style={styles.listItemAmount}>{formatCurrency(item.totalAmount || 0)}</Text>
      </View>
    </TouchableOpacity>
  ), [navigation]);

  const renderAppointmentItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.listItem}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('Operations', {
        screen: 'AppointmentDetailScreen',
        params: { appointmentId: item.id },
      })}
    >
      <View style={styles.listItemLeft}>
        <Text style={styles.listItemTitle}>{item.customerName || 'Customer'}</Text>
        <Text style={styles.listItemSub}>
          {item.serviceName || 'Service'} {item.appointmentDateTime ? `- ${formatDate(item.appointmentDateTime)}` : ''}
        </Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status || 'SCHEDULED') + '20' }]}>
        <Text style={[styles.statusText, { color: getStatusColor(item.status || 'SCHEDULED') }]}>
          {item.status || 'SCHEDULED'}
        </Text>
      </View>
    </TouchableOpacity>
  ), [navigation]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>⊞</Text>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.businessSelector} onPress={openBusinessSheet} activeOpacity={0.7}>
          <Text style={styles.businessSelectorText} numberOfLines={1}>
            {selectedBusiness || 'Select Business'}
          </Text>
          <Text style={styles.chevronIcon}>▾</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats Row */}
          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <AppCard
                key={stat.label}
                style={styles.statCard}
                contentStyle={styles.statCardContent}
              >
                <Text
                  style={[styles.statValue, { color: stat.color }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {stat.value}
                </Text>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {stat.label}
                </Text>
              </AppCard>
            ))}
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            {[
              { key: 'product', icon: '📦', label: 'Product' },
              { key: 'order', icon: '🛒', label: 'Order' },
              { key: 'appointment', icon: '📅', label: 'Appointment' },
              { key: 'invoice', icon: '🧾', label: 'Invoice' },
            ].map((action) => (
              <AppCard
                key={action.key}
                style={styles.quickActionBtn}
                contentStyle={styles.quickActionContent}
                onPress={() => handleQuickAction(action.key)}
              >
                <View style={styles.quickActionIcon}>
                  <Text style={styles.quickActionIconText}>{action.icon}</Text>
                </View>
                <Text
                  style={styles.quickActionLabel}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {action.label}
                </Text>
              </AppCard>
            ))}
          </View>

          {/* Recent Orders */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Operations')} activeOpacity={0.7}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {orders.length === 0 ? (
            <AppCard style={styles.emptyCard}>
              <Text style={styles.emptyText}>No recent orders</Text>
            </AppCard>
          ) : (
            <AppCard style={styles.listCard} contentStyle={styles.listContent}>
              {orders.slice(0, 5).map((order: any, idx: number) => (
                <React.Fragment key={order.id || idx}>
                  {renderOrderItem({ item: order })}
                  {idx < Math.min(orders.length, 5) - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </AppCard>
          )}

          {/* Upcoming Appointments */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Operations')} activeOpacity={0.7}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {appointments.length === 0 ? (
            <AppCard style={styles.emptyCard}>
              <Text style={styles.emptyText}>No upcoming appointments</Text>
            </AppCard>
          ) : (
            <AppCard style={styles.listCard} contentStyle={styles.listContent}>
              {appointments.slice(0, 5).map((appt: any, idx: number) => (
                <React.Fragment key={appt.id || idx}>
                  {renderAppointmentItem({ item: appt })}
                  {idx < Math.min(appointments.length, 5) - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </AppCard>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.palette.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: theme.palette.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.palette.onBackground,
    },
    businessSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      maxWidth: 200,
      gap: 6,
    },
    businessSelectorText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.palette.onBackground,
      flexShrink: 1,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      marginHorizontal: 4,
    },
    statCardContent: {
      paddingVertical: 22,
      paddingHorizontal: 2,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 6,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '500',
      color: theme.palette.muted,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.palette.onBackground,
      marginBottom: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      marginTop: 8,
    },
    seeAll: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.primary,
    },
    quickActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    quickActionBtn: {
      flex: 1,
      marginHorizontal: 4,
    },
    quickActionContent: {
      paddingVertical: 14,
      paddingHorizontal: 6,
    },
    quickActionIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginBottom: 6,
    },
    quickActionLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.palette.muted,
    },
    listCard: {
      marginBottom: 16,
      padding: 0,
    },
    listContent: {
      padding: 0,
      alignItems: 'stretch',
      justifyContent: 'flex-start',
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    listItemLeft: {
      flex: 1,
      marginRight: 12,
    },
    listItemRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    listItemTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.palette.onBackground,
      marginBottom: 2,
    },
    listItemSub: {
      fontSize: 12,
      color: theme.palette.muted,
    },
    listItemAmount: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.palette.onBackground,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    divider: {
      height: 1,
      backgroundColor: theme.palette.divider,
      marginHorizontal: 16,
    },
    emptyCard: {
      alignItems: 'center',
      paddingVertical: 24,
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 14,
      color: theme.palette.muted,
    },
    bottomSpacer: {
      height: 32,
    },
    headerIcon: {
      fontSize: 22,
      color: theme.colors.primary,
    },
    chevronIcon: {
      fontSize: 18,
      color: theme.palette.muted,
    },
    quickActionIconText: {
      fontSize: 22,
      marginBottom: 2,
    },
  });
}
