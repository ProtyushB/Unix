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
import { Plus, Search, Package, Scissors } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppInput } from '../../components/common/AppInput';
import { AppCard } from '../../components/common/AppCard';
import { useParlour } from '../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../backend/modules/pharmacy/hook/usePharmacy';
import { useRestaurant } from '../../backend/modules/restaurant/hook/useRestaurant';
import { useAppContext } from '../../context/AppContext';
import { getBusinessTypeMap, type Business } from '../../storage/session.storage';
import { formatCurrency } from '../../utils/formatters';
import { getStatusColor } from '../../utils/statusColors';
import type { CatalogStackParamList } from '../../navigation/OwnerTabNavigator';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<CatalogStackParamList, 'CatalogScreen'>;

type TabKey = 'products' | 'services';

// ─── Component ──────────────────────────────────────────────────────────────

export default function CatalogScreen({ navigation }: Props) {
  const { selectedModule, selectedBusiness } = useAppContext();

  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const restaurant = useRestaurant();

  const activeModule = selectedModule?.includes('Restaurant')
    ? restaurant
    : selectedModule?.includes('Pharmacy')
      ? pharmacy
      : parlour;

  const [activeTab, setActiveTab] = useState<TabKey>('products');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Resolve business ID from stable string
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
    if (activeTab === 'products') {
      activeModule.loadProducts(1, 20);
    } else {
      activeModule.loadServices(1, 20);
    }
    setPage(1);
  }, [selectedBusinessId, activeTab]);

  const products = activeModule?.products || [];
  const services = activeModule?.services || [];
  const loading = activeModule?.loading ?? false;

  // Client-side search filter
  const filteredProducts = products.filter((p: any) => {
    const text = searchText.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(text) ||
      (p.brand || '').toLowerCase().includes(text)
    );
  });

  const filteredServices = services.filter((s: any) => {
    const text = searchText.toLowerCase();
    return (s.name || '').toLowerCase().includes(text);
  });

  const handleRefresh = useCallback(async () => {
    if (!activeModule) return;
    setRefreshing(true);
    setPage(1);
    if (activeTab === 'products') {
      await activeModule.loadProducts(1, 20);
    } else {
      await activeModule.loadServices(1, 20);
    }
    setRefreshing(false);
  }, [activeTab, activeModule]);

  const handleEndReached = useCallback(() => {
    if (!activeModule || loading) return;
    const nextPage = page + 1;
    if (activeTab === 'products' && nextPage <= (activeModule.productsTotalPages || 1)) {
      activeModule.loadProducts(nextPage, 20);
      setPage(nextPage);
    } else if (activeTab === 'services' && nextPage <= (activeModule.servicesTotalPages || 1)) {
      activeModule.loadServices(nextPage, 20);
      setPage(nextPage);
    }
  }, [activeTab, page, loading, activeModule]);

  const handleFAB = useCallback(() => {
    if (activeTab === 'products') {
      navigation.navigate('ProductDetailScreen', { productId: 0, mode: 'add' } as any);
    } else {
      navigation.navigate('ServiceDetailScreen', { serviceId: 0, mode: 'add' } as any);
    }
  }, [activeTab, navigation]);

  // ─── Render Helpers ─────────────────────────────────────────────────────────

  const renderProductItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.itemRow}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('ProductDetailScreen', { productId: item.id, mode: 'view' } as any)}
    >
      <View style={styles.itemIcon}>
        <Package size={20} color={colors.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name || 'Unnamed'}</Text>
        <Text style={styles.itemMeta}>
          {item.brand ? `${item.brand} · ` : ''}{formatCurrency(item.price || 0)}
        </Text>
      </View>
      <View style={styles.itemRight}>
        {item.status && (
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
        )}
        <Text style={styles.itemStock}>Stock: {item.stock ?? '-'}</Text>
      </View>
    </TouchableOpacity>
  ), [navigation, colors.primary]);

  const renderServiceItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.itemRow}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('ServiceDetailScreen', { serviceId: item.id, mode: 'view' } as any)}
    >
      <View style={styles.itemIcon}>
        <Scissors size={20} color="#8b5cf6" />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name || 'Unnamed'}</Text>
        <Text style={styles.itemMeta}>
          {item.duration ? `${item.duration} min · ` : ''}{formatCurrency(item.price || 0)}
        </Text>
      </View>
      {item.status && (
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
      )}
    </TouchableOpacity>
  ), [navigation]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>
          {activeTab === 'products' ? 'No products found' : 'No services found'}
        </Text>
        <Text style={styles.emptySubtitle}>
          Tap the + button to add your first {activeTab === 'products' ? 'product' : 'service'}
        </Text>
      </View>
    );
  }, [activeTab, loading]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Catalog</Text>
      </View>

      {/* Top Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.tabActive]}
          onPress={() => { setActiveTab('products'); setSearchText(''); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>
            Products
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'services' && styles.tabActive]}
          onPress={() => { setActiveTab('services'); setSearchText(''); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'services' && styles.tabTextActive]}>
            Services
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <AppInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder={`Search ${activeTab}...`}
          leftIcon={<Search size={18} color={palette.muted} />}
          style={styles.searchInput}
        />
      </View>

      {/* List */}
      {loading && page === 1 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : activeTab === 'products' ? (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={renderProductItem}
          ListEmptyComponent={renderEmpty}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        />
      ) : (
        <FlatList
          data={filteredServices}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={renderServiceItem}
          ListEmptyComponent={renderEmpty}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
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

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.palette.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: theme.palette.background,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.palette.onBackground,
    },
    tabBar: {
      flexDirection: 'row',
      marginHorizontal: 16,
      backgroundColor: theme.palette.surface,
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
      backgroundColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.palette.muted,
    },
    tabTextActive: {
      color: '#ffffff',
    },
    searchContainer: {
      paddingHorizontal: 16,
      marginBottom: 4,
    },
    searchInput: {
      marginBottom: 8,
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
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginBottom: 10,
    },
    itemIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: theme.colors.primary + '14',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    itemContent: {
      flex: 1,
      marginRight: 8,
    },
    itemName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.palette.onBackground,
      marginBottom: 3,
    },
    itemMeta: {
      fontSize: 12,
      color: theme.palette.muted,
    },
    itemRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    itemStock: {
      fontSize: 11,
      color: theme.palette.muted,
      fontWeight: '500',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingTop: 60,
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.palette.muted,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.palette.muted,
      textAlign: 'center',
    },
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
  });
}
