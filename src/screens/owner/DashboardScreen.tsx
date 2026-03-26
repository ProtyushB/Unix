import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Modal,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { useParlour } from '../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../backend/modules/pharmacy/hook/usePharmacy';
import { useRestaurant } from '../../backend/modules/restaurant/hook/useRestaurant';
import { useAppContext } from '../../context/AppContext';
import { getBusinessTypeMap, type BusinessTypeMap, type Business } from '../../storage/session.storage';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getStatusColor } from '../../utils/statusColors';
import { getBusinessTypeLabel } from '../../utils/businessTypes';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StatItem {
  label: string;
  value: string;
  color: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { selectedModule, selectedBusiness, setSelectedModule, setSelectedBusiness } = useAppContext();

  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const restaurant = useRestaurant();

  const activeModule = selectedModule?.includes('Restaurant')
    ? restaurant
    : selectedModule?.includes('Pharmacy')
      ? pharmacy
      : parlour;

  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [businessTypeMap, setBusinessTypeMap] = useState<BusinessTypeMap | null>(null);

  // Resolve business ID from stable string
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    (async () => {
      const map = await getBusinessTypeMap();
      setBusinessTypeMap(map);
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

  const openSheet = useCallback(async () => {
    const map = await getBusinessTypeMap();
    setBusinessTypeMap(map);
    setSheetVisible(true);
  }, []);

  const selectBusiness = useCallback((biz: Business, type: string) => {
    setSelectedModule(type);
    setSelectedBusiness((biz as any).businessName || biz.name);
    setSheetVisible(false);
  }, [setSelectedModule, setSelectedBusiness]);

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
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>⊞</Text>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.businessSelector} onPress={openSheet} activeOpacity={0.7}>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow}>
            {stats.map((stat) => (
              <AppCard key={stat.label} style={styles.statCard}>
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </AppCard>
            ))}
          </ScrollView>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            {[
              { key: 'product', icon: '📦', label: 'Product' },
              { key: 'order', icon: '🛒', label: 'Order' },
              { key: 'appointment', icon: '📅', label: 'Appointment' },
              { key: 'invoice', icon: '🧾', label: 'Invoice' },
            ].map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.quickActionBtn}
                onPress={() => handleQuickAction(action.key)}
                activeOpacity={0.7}
              >
                <View style={styles.quickActionIcon}>
                  <Text style={styles.quickActionIconText}>{action.icon}</Text>
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
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
            <AppCard style={styles.listCard}>
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
            <AppCard style={styles.listCard}>
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

      {/* Business Switcher Sheet */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSheetVisible(false)}>
          <Pressable style={styles.bottomSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Business</Text>
              <TouchableOpacity onPress={() => setSheetVisible(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              {businessTypeMap && Object.keys(businessTypeMap).map((type) => (
                <View key={type} style={styles.sheetSection}>
                  <Text style={styles.sheetSubtitle}>{getBusinessTypeLabel(type)}</Text>
                  {(businessTypeMap[type] || []).map((biz: Business) => (
                    <TouchableOpacity
                      key={biz.id}
                      style={[
                        styles.sheetRow,
                        selectedBusiness === ((biz as any).businessName || biz.name) && selectedModule === type && styles.sheetRowActive,
                      ]}
                      onPress={() => selectBusiness(biz, type)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.sheetRowText,
                        selectedBusiness === ((biz as any).businessName || biz.name) && selectedModule === type && styles.sheetRowTextActive,
                      ]}>
                        {(biz as any).businessName || biz.name}
                      </Text>
                      {selectedBusiness === ((biz as any).businessName || biz.name) && selectedModule === type && (
                        <Text style={styles.activeCheckIcon}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
      marginBottom: 20,
    },
    statCard: {
      minWidth: 120,
      marginRight: 12,
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
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
      alignItems: 'center',
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      borderRadius: 14,
      paddingVertical: 14,
      marginHorizontal: 4,
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
    // ─── Bottom Sheet ───────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.palette.overlay,
      justifyContent: 'flex-end',
    },
    bottomSheet: {
      backgroundColor: theme.palette.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
      paddingBottom: 32,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.palette.muted,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.palette.onBackground,
    },
    sheetBody: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    sheetSubtitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.palette.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    sheetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginBottom: 4,
    },
    sheetRowActive: {
      backgroundColor: theme.colors.softBg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sheetRowText: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.palette.onBackground,
    },
    sheetRowTextActive: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    sheetSection: {
      marginBottom: 20,
    },
    activeCheckIcon: {
      fontSize: 16,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    headerIcon: {
      fontSize: 22,
      color: theme.colors.primary,
    },
    chevronIcon: {
      fontSize: 18,
      color: theme.palette.muted,
    },
    closeIcon: {
      fontSize: 22,
      color: theme.palette.muted,
    },
    quickActionIconText: {
      fontSize: 22,
      marginBottom: 2,
    },
  });
}
