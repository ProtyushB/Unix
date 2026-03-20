import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  StatusBar,
} from 'react-native';
import {
  Plus,
  ShoppingCart,
  CalendarClock,
  Receipt,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppCard } from '../../components/common/AppCard';
import { useParlour } from '../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../backend/modules/pharmacy/hook/usePharmacy';
import { useRestaurant } from '../../backend/modules/restaurant/hook/useRestaurant';
import { useAppContext } from '../../context/AppContext';
import { getBusinessTypeMap, type Business } from '../../storage/session.storage';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { getStatusColor } from '../../utils/statusColors';
import type { OperationsStackParamList } from '../../navigation/OwnerTabNavigator';

// ─── Types ──────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<OperationsStackParamList, 'OperationsScreen'>;

type TabKey = 'orders' | 'appointments' | 'bills';

// ─── Component ──────────────────────────────────────────────────────────────

export default function OperationsScreen({ navigation }: Props) {
  const { selectedModule, selectedBusiness } = useAppContext();

  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const restaurant = useRestaurant();

  const activeModule = selectedModule?.includes('Restaurant')
    ? restaurant
    : selectedModule?.includes('Pharmacy')
      ? pharmacy
      : parlour;

  const [activeTab, setActiveTab] = useState<TabKey>('orders');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);

  // Resolve business ID
  useEffect(() => {
    (async () => {
      const map = await getBusinessTypeMap();
      if (map && selectedModule) {
        const businesses = map[selectedModule] || [];
        const biz = businesses.find((b: Business) => b.name === selectedBusiness);
        setSelectedBusinessId(biz?.id ?? null);
      }
    })();
  }, [selectedBusiness, selectedModule]);

  // Load data — ONLY depends on selectedBusinessId
  useEffect(() => {
    if (!activeModule || !selectedBusinessId) return;
    setPage(1);
    switch (activeTab) {
      case 'orders':
        activeModule.loadOrders(1, 20);
        break;
      case 'appointments':
        activeModule.loadAppointments(1, 20);
        break;
      case 'bills':
        activeModule.loadBills();
        break;
    }
  }, [selectedBusinessId, activeTab]);

  const orders = activeModule?.orders || [];
  const appointments = activeModule?.appointments || [];
  const bills = activeModule?.bills || [];
  const loading = activeModule?.loading ?? false;

  const handleRefresh = useCallback(async () => {
    if (!activeModule) return;
    setRefreshing(true);
    setPage(1);
    switch (activeTab) {
      case 'orders':
        await activeModule.loadOrders(1, 20);
        break;
      case 'appointments':
        await activeModule.loadAppointments(1, 20);
        break;
      case 'bills':
        await activeModule.loadBills();
        break;
    }
    setRefreshing(false);
  }, [activeTab, activeModule]);

  const handleEndReached = useCallback(() => {
    if (!activeModule || loading) return;
    const nextPage = page + 1;
    if (activeTab === 'orders' && nextPage <= (activeModule.ordersTotalPages || 1)) {
      activeModule.loadOrders(nextPage, 20);
      setPage(nextPage);
    }
  }, [activeTab, page, loading, activeModule]);

  const handleFAB = useCallback(() => {
    switch (activeTab) {
      case 'orders':
        navigation.navigate('OrderDetailScreen', { orderId: -1 } as any);
        break;
      case 'appointments':
        navigation.navigate('AppointmentDetailScreen', { appointmentId: -1 } as any);
        break;
      case 'bills':
        navigation.navigate('BillingDetailScreen', { billId: -1 } as any);
        break;
    }
  }, [activeTab, navigation]);

  // ─── Render Helpers ─────────────────────────────────────────────────────────

  const renderOrderItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.itemRow}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('OrderDetailScreen', { orderId: item.id })}
    >
      <View style={styles.itemIconWrap}>
        <ShoppingCart size={18} color="#f97316" />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>Order #{item.id}</Text>
        <Text style={styles.itemSub}>
          {item.customerName || 'Customer'} {item.orderDate ? `- ${formatDate(item.orderDate)}` : ''}
        </Text>
      </View>
      <View style={styles.itemRight}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status || 'PENDING') + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status || 'PENDING') }]}>
            {item.status || 'PENDING'}
          </Text>
        </View>
        <Text style={styles.itemAmount}>{formatCurrency(item.totalAmount || 0)}</Text>
      </View>
    </TouchableOpacity>
  ), [navigation]);

  const renderAppointmentItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.itemRow}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('AppointmentDetailScreen', { appointmentId: item.id })}
    >
      <View style={[styles.itemIconWrap, { backgroundColor: '#8b5cf615' }]}>
        <CalendarClock size={18} color="#8b5cf6" />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{item.customerName || 'Customer'}</Text>
        <Text style={styles.itemSub}>
          {item.serviceName || 'Service'}
          {item.appointmentDateTime ? ` - ${formatDateTime(item.appointmentDateTime)}` : ''}
        </Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status || 'SCHEDULED') + '20' }]}>
        <Text style={[styles.statusText, { color: getStatusColor(item.status || 'SCHEDULED') }]}>
          {item.status || 'SCHEDULED'}
        </Text>
      </View>
    </TouchableOpacity>
  ), [navigation]);

  const renderBillItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.itemRow}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('BillingDetailScreen', { billId: item.id })}
    >
      <View style={[styles.itemIconWrap, { backgroundColor: '#10b98115' }]}>
        <Receipt size={18} color="#10b981" />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>Bill #{item.id}</Text>
        <Text style={styles.itemSub}>
          {item.customerName || 'Customer'} {item.billDate ? `- ${formatDate(item.billDate)}` : ''}
        </Text>
      </View>
      <View style={styles.itemRight}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.paymentStatus || 'UNPAID') + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.paymentStatus || 'UNPAID') }]}>
            {item.paymentStatus || 'UNPAID'}
          </Text>
        </View>
        <Text style={styles.itemAmount}>{formatCurrency(item.totalAmount || 0)}</Text>
      </View>
    </TouchableOpacity>
  ), [navigation]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    const labels: Record<TabKey, string> = {
      orders: 'No orders found',
      appointments: 'No appointments found',
      bills: 'No bills found',
    };
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>{labels[activeTab]}</Text>
        <Text style={styles.emptySubtitle}>Tap the + button to create one</Text>
      </View>
    );
  }, [activeTab, loading]);

  const getData = () => {
    switch (activeTab) {
      case 'orders': return orders;
      case 'appointments': return appointments;
      case 'bills': return bills;
    }
  };

  const getRenderer = () => {
    switch (activeTab) {
      case 'orders': return renderOrderItem;
      case 'appointments': return renderAppointmentItem;
      case 'bills': return renderBillItem;
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Operations</Text>
      </View>

      {/* Top Tab Bar */}
      <View style={styles.tabBar}>
        {(['orders', 'appointments', 'bills'] as TabKey[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading && page === 1 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : (
        <FlatList
          data={getData()}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={getRenderer()}
          ListEmptyComponent={renderEmpty}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#f97316" />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleFAB} activeOpacity={0.8}>
        <Plus size={24} color="#ffffff" />
      </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#f97316',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  itemIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f9731615',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 3,
  },
  itemSub: {
    fontSize: 12,
    color: '#94a3b8',
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  itemAmount: {
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
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
