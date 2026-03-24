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
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Resolve business ID from stable string
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const map = await getBusinessTypeMap();
      setBusinessTypeMap(map);
      if (map && selectedModule) {
        const businesses = map[selectedModule] || [];
        const biz = businesses.find((b: Business) => b.name === selectedBusiness);
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
    setSelectedType(null);
    setSheetVisible(true);
  }, []);

  const selectModuleType = useCallback((type: string) => {
    setSelectedType(type);
  }, []);

  const selectBusiness = useCallback((biz: Business, type: string) => {
    setSelectedModule(type);
    setSelectedBusiness(biz.name);
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
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>⊞</Text>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.businessSelector} onPress={openSheet} activeOpacity={0.7}>
          <Text style={styles.businessSelectorText} numberOfLines={1}>
            {selectedModule ? `${getBusinessTypeLabel(selectedModule)}` : 'Select Business'}
            {selectedBusiness ? ` / ${selectedBusiness}` : ''}
          </Text>
          <Text style={styles.chevronIcon}>▾</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f97316" />
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

            {!selectedType ? (
              <View style={styles.sheetBody}>
                <Text style={styles.sheetSubtitle}>Business Type</Text>
                {businessTypeMap && Object.keys(businessTypeMap).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.sheetRow}
                    onPress={() => selectModuleType(type)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sheetRowText}>{getBusinessTypeLabel(type)}</Text>
                    <Text style={styles.chevronIcon}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.sheetBody}>
                <TouchableOpacity onPress={() => setSelectedType(null)} style={styles.sheetBackBtn}>
                  <Text style={styles.sheetBackText}>Back to types</Text>
                </TouchableOpacity>
                <Text style={styles.sheetSubtitle}>{getBusinessTypeLabel(selectedType)}</Text>
                {(businessTypeMap?.[selectedType] || []).map((biz: Business) => (
                  <TouchableOpacity
                    key={biz.id}
                    style={[
                      styles.sheetRow,
                      selectedBusiness === biz.name && styles.sheetRowActive,
                    ]}
                    onPress={() => selectBusiness(biz, selectedType)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.sheetRowText,
                      selectedBusiness === biz.name && styles.sheetRowTextActive,
                    ]}>
                      {biz.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  businessSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 200,
    gap: 6,
  },
  businessSelectorText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#f8fafc',
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
    color: '#94a3b8',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
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
    color: '#f97316',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
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
    color: '#94a3b8',
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
    color: '#f8fafc',
    marginBottom: 2,
  },
  listItemSub: {
    fontSize: 12,
    color: '#94a3b8',
  },
  listItemAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f8fafc',
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
    backgroundColor: '#334155',
    marginHorizontal: 16,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
  },
  bottomSpacer: {
    height: 32,
  },
  // ─── Bottom Sheet ───────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#475569',
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
    borderBottomColor: '#334155',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
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
    backgroundColor: '#f9731615',
    borderWidth: 1,
    borderColor: '#f9731640',
  },
  sheetRowText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#f8fafc',
  },
  sheetRowTextActive: {
    color: '#f97316',
    fontWeight: '600',
  },
  sheetBackBtn: {
    marginBottom: 12,
  },
  sheetBackText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f97316',
  },
  headerIcon: {
    fontSize: 22,
    color: '#f97316',
  },
  chevronIcon: {
    fontSize: 18,
    color: '#94a3b8',
  },
  closeIcon: {
    fontSize: 22,
    color: '#94a3b8',
  },
  quickActionIconText: {
    fontSize: 22,
    marginBottom: 2,
  },
});
