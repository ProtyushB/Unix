import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import {Search, Compass} from 'lucide-react-native';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {AppInput} from '../../components/common/AppInput';
import {BusinessCard} from '../../components/list/BusinessCard';
import {SectionHeader} from '../../components/common/SectionHeader';
import {EmptyState} from '../../components/common/EmptyState';
import {LoadingSpinner} from '../../components/common/LoadingSpinner';

const CATEGORIES = [
  {key: 'All', label: 'All'},
  {key: 'Parlour', label: 'Parlour'},
  {key: 'Pharmacy', label: 'Pharmacy'},
  {key: 'Restaurant', label: 'Restaurant'},
  {key: 'Electronics', label: 'Electronics'},
];

export const ExploreScreen: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filteredBusinesses = businesses.filter(b => {
    const matchesSearch =
      !searchText ||
      b.businessName?.toLowerCase().includes(searchText.toLowerCase());
    const matchesCategory =
      activeCategory === 'All' || b.businessType === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: fetch businesses from API
    setRefreshing(false);
  }, []);

  const handleBusinessPress = (business: any) => {
    // TODO: navigate to business detail/booking
  };

  return (
    <ScreenWrapper scrollable={false}>
      <View style={styles.container}>
        <Text style={styles.title}>Explore</Text>

        <AppInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search businesses..."
          leftIcon={<Search size={18} color="#64748b" />}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryRow}
          contentContainerStyle={styles.categoryContent}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryChip,
                activeCategory === cat.key && styles.categoryChipActive,
              ]}
              onPress={() => setActiveCategory(cat.key)}>
              <Text
                style={[
                  styles.categoryText,
                  activeCategory === cat.key && styles.categoryTextActive,
                ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <LoadingSpinner />
        ) : filteredBusinesses.length === 0 ? (
          <EmptyState
            icon={<Compass size={48} color="#64748b" />}
            title="No businesses found"
            message="Try adjusting your search or category filter"
          />
        ) : (
          <FlatList
            data={filteredBusinesses}
            keyExtractor={item => String(item.id)}
            renderItem={({item}) => (
              <BusinessCard
                business={item}
                onPress={() => handleBusinessPress(item)}
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
  categoryRow: {
    marginTop: 12,
    marginBottom: 8,
    maxHeight: 44,
  },
  categoryContent: {
    gap: 8,
    paddingRight: 16,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(30,41,59,0.6)',
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryChipActive: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderColor: '#f97316',
  },
  categoryText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#f97316',
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
  },
});
