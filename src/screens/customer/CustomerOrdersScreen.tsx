import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, FlatList, RefreshControl, StyleSheet} from 'react-native';
import {ShoppingBag} from 'lucide-react-native';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {TopTabBar} from '../../components/layout/TopTabBar';
import {OrderCard} from '../../components/list/OrderCard';
import {EmptyState} from '../../components/common/EmptyState';
import {LoadingSpinner} from '../../components/common/LoadingSpinner';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TABS = [
  {key: 'active', label: 'Active'},
  {key: 'history', label: 'History'},
];

export const CustomerOrdersScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState('active');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [personId, setPersonId] = useState<number | null>(null);

  useEffect(() => {
    const loadPersonId = async () => {
      const userStr = await AsyncStorage.getItem('loggedInUser');
      if (userStr) {
        const user = JSON.parse(userStr);
        setPersonId(user.id);
      }
    };
    loadPersonId();
  }, []);

  const loadOrders = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    try {
      // TODO: call activeModule.loadOrdersByCustomer(personId, { status })
      // Active: PENDING,CONFIRMED
      // History: COMPLETED,CANCELLED
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [personId, activeTab]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  const filteredOrders = orders.filter(o => {
    if (activeTab === 'active') {
      return ['PENDING', 'CONFIRMED'].includes(o.status);
    }
    return ['COMPLETED', 'CANCELLED'].includes(o.status);
  });

  const handleOrderPress = (order: any) => {
    // TODO: navigate to order detail (read-only for customer)
  };

  return (
    <ScreenWrapper scrollable={false}>
      <View style={styles.container}>
        <Text style={styles.title}>My Orders</Text>

        <TopTabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {loading && !refreshing ? (
          <LoadingSpinner />
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag size={48} color="#64748b" />}
            title={
              activeTab === 'active' ? 'No active orders' : 'No order history'
            }
            message={
              activeTab === 'active'
                ? 'Your active orders will appear here'
                : 'Your completed orders will appear here'
            }
          />
        ) : (
          <FlatList
            data={filteredOrders}
            keyExtractor={item => String(item.id)}
            renderItem={({item}) => (
              <OrderCard
                order={item}
                onPress={() => handleOrderPress(item)}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#f97316"
              />
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 16,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
    paddingTop: 12,
  },
});
