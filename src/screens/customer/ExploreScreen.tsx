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
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {AppInput} from '../../components/common/AppInput';
import {BusinessCard} from '../../components/list/BusinessCard';
import {SectionHeader} from '../../components/common/SectionHeader';
import {EmptyState} from '../../components/common/EmptyState';
import {LoadingSpinner} from '../../components/common/LoadingSpinner';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

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

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

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
          leftIcon={<Text style={{ fontSize: 16, color: palette.muted }}>🔍</Text>}
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
            icon={<Text style={{ fontSize: 44 }}>🧭</Text>}
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
                tintColor={colors.primary}
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

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.palette.onBackground,
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
      backgroundColor: theme.palette.surface + '99',
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    categoryChipActive: {
      backgroundColor: theme.colors.softBg,
      borderColor: theme.colors.primary,
    },
    categoryText: {
      fontSize: 14,
      color: theme.palette.muted,
      fontWeight: '500',
    },
    categoryTextActive: {
      color: theme.colors.primary,
    },
    listContent: {
      paddingBottom: 24,
      gap: 12,
    },
  });
}
