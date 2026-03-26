import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, FlatList, RefreshControl, TextInput, StyleSheet} from 'react-native';
import {Users} from 'lucide-react-native';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {TopTabBar} from '../../components/layout/TopTabBar';
import {PersonCard} from '../../components/list/PersonCard';
import {EmptyState} from '../../components/common/EmptyState';
import {LoadingSpinner} from '../../components/common/LoadingSpinner';
import {useAppContext} from '../../context/AppContext';
import {useParlour} from '../../backend/modules/parlour/hook/useParlour';
import {usePharmacy} from '../../backend/modules/pharmacy/hook/usePharmacy';
import {useRestaurant} from '../../backend/modules/restaurant/hook/useRestaurant';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

const TABS = [
  {key: 'employees', label: 'Employees'},
  {key: 'customers', label: 'Customers'},
];

export const PeopleScreen: React.FC = () => {
  const {selectedModule} = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const restaurant = useRestaurant();

  const activeModule =
    selectedModule?.toLowerCase().includes('restaurant') ? restaurant
    : selectedModule?.toLowerCase().includes('pharmacy') ? pharmacy
    : parlour;

  const [activeTab, setActiveTab] = useState('customers');
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    activeModule.loadCustomers?.();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await activeModule.loadCustomers?.();
    setRefreshing(false);
  }, []);

  const people: any[] = activeTab === 'customers'
    ? (activeModule.customers || [])
    : (activeModule.employees || []);

  const filtered = people.filter(p => {
    if (!searchText) return true;
    const full = `${p.firstName || ''} ${p.lastName || ''} ${p.phone || ''}`.toLowerCase();
    return full.includes(searchText.toLowerCase());
  });

  return (
    <ScreenWrapper scrollable={false}>
      <View style={styles.container}>
        <Text style={styles.title}>People</Text>

        <TopTabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search by name or phone..."
          placeholderTextColor={palette.muted}
        />

        {activeModule.loading && !refreshing ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={48} color={palette.muted} />}
            title={activeTab === 'customers' ? 'No customers' : 'No employees'}
            message={activeTab === 'customers' ? 'Customer records will appear here' : 'Employee records will appear here'}
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => String(item.id)}
            renderItem={({item}) => (
              <PersonCard
                person={{...item, role: activeTab === 'customers' ? 'Customer' : 'Employee'}}
                onPress={() => {}}
              />
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenWrapper>
  );
};

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {flex: 1, paddingHorizontal: 16},
    title: {fontSize: 28, fontWeight: '700', color: theme.palette.onBackground, marginTop: 16, marginBottom: 16},
    searchInput: {backgroundColor: theme.palette.surface + '99', borderWidth: 1, borderColor: theme.palette.divider, borderRadius: 12, padding: 12, color: theme.palette.onBackground, fontSize: 14, marginTop: 12, marginBottom: 4},
    listContent: {paddingBottom: 24, gap: 8, paddingTop: 8},
  });
}
