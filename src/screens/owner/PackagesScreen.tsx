import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Gift, Sparkles, Crown, Heart, Package as PackageIcon } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListCard } from '../../components/list/ListCard';
import { ListGridTile } from '../../components/list/ListGridTile';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/formatters';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockPackage {
  id:          number;
  name:        string;
  tier:        'BASIC' | 'STANDARD' | 'PREMIUM';
  price:       number;
  itemCount:   number;
  validityDay: number;
  icon:        LucideIcon;
}

const MOCK_PACKAGES: MockPackage[] = [
  { id: 1, name: 'Bridal Glow',        tier: 'PREMIUM',  price: 18500, itemCount: 6, validityDay: 90,  icon: Crown },
  { id: 2, name: 'Spa Essentials',     tier: 'STANDARD', price: 6500,  itemCount: 4, validityDay: 60,  icon: Heart },
  { id: 3, name: 'Haircare Starter',   tier: 'BASIC',    price: 2500,  itemCount: 3, validityDay: 30,  icon: PackageIcon },
  { id: 4, name: 'Party Ready',        tier: 'STANDARD', price: 4200,  itemCount: 3, validityDay: 30,  icon: Sparkles },
  { id: 5, name: 'Monthly Unlimited',  tier: 'PREMIUM',  price: 12000, itemCount: 10, validityDay: 30, icon: Crown },
  { id: 6, name: 'Skin Refresh',       tier: 'STANDARD', price: 5800,  itemCount: 4, validityDay: 45,  icon: Sparkles },
  { id: 7, name: 'Festive Combo',      tier: 'BASIC',    price: 1800,  itemCount: 2, validityDay: 15,  icon: Gift },
  { id: 8, name: 'Groom Grooming',     tier: 'STANDARD', price: 5500,  itemCount: 5, validityDay: 60,  icon: PackageIcon },
];

const FILTERS = [
  { id: 'ALL',      label: 'All' },
  { id: 'BASIC',    label: 'Basic' },
  { id: 'STANDARD', label: 'Standard' },
  { id: 'PREMIUM',  label: 'Premium' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function PackagesScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [view, setView]     = useState<'list' | 'grid'>('grid');

  const visible = useMemo(() => {
    return MOCK_PACKAGES.filter(p => {
      const matchTier  = filter === 'ALL' || p.tier === filter;
      const q          = search.trim().toLowerCase();
      const matchQuery = !q || p.name.toLowerCase().includes(q);
      return matchTier && matchQuery;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Packages"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search packages..."
      view={view}
      onViewChange={setView}
      onAdd={() => { /* TODO */ }}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<Gift size={48} color={palette.muted} />}
          title="No packages"
          message="No packages match your filters"
        />
      ) : view === 'grid' ? (
        <FlatList
          key="grid"
          data={visible}
          keyExtractor={p => String(p.id)}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <ListGridTile
              title={item.name}
              price={formatCurrency(item.price)}
              meta={`${item.itemCount} items · ${item.validityDay}d`}
              icon={item.icon}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          key="list"
          data={visible}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ListCard
              title={item.name}
              subtitle={`${item.itemCount} items · valid ${item.validityDay} days`}
              meta={item.tier}
              amount={formatCurrency(item.price)}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ListShell>
  );
}

const styles = StyleSheet.create({
  gridContent: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 100 },
  gridRow:     { justifyContent: 'space-between' },
  listContent: { paddingTop: 8, paddingBottom: 100 },
});
