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
          placeholderTextColor="#64748b"
        />

        {activeModule.loading && !refreshing ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={48} color="#64748b" />}
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, paddingHorizontal: 16},
  title: {fontSize: 28, fontWeight: '700', color: '#f8fafc', marginTop: 16, marginBottom: 16},
  searchInput: {backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 12, color: '#f8fafc', fontSize: 14, marginTop: 12, marginBottom: 4},
  listContent: {paddingBottom: 24, gap: 8, paddingTop: 8},
});
