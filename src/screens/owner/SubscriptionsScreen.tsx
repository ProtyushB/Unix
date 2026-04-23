import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Repeat2, Crown, Star, Zap } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListCard } from '../../components/list/ListCard';
import { ListGridTile } from '../../components/list/ListGridTile';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/formatters';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockSubscription {
  id:           number;
  name:         string;
  interval:     'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  price:        number;
  activeCount:  number;
  icon:         LucideIcon;
}

const MOCK_SUBSCRIPTIONS: MockSubscription[] = [
  { id: 1, name: 'Glow Monthly',        interval: 'MONTHLY',   price: 2500,  activeCount: 42, icon: Star },
  { id: 2, name: 'Platinum Quarterly',  interval: 'QUARTERLY', price: 9500,  activeCount: 18, icon: Crown },
  { id: 3, name: 'Weekly Blowout',      interval: 'WEEKLY',    price: 800,   activeCount: 6,  icon: Zap },
  { id: 4, name: 'Annual All-Access',   interval: 'YEARLY',    price: 42000, activeCount: 11, icon: Crown },
  { id: 5, name: 'Mens Monthly',        interval: 'MONTHLY',   price: 1800,  activeCount: 27, icon: Star },
  { id: 6, name: 'Nail Care Monthly',   interval: 'MONTHLY',   price: 1200,  activeCount: 15, icon: Star },
];

const FILTERS = [
  { id: 'ALL',       label: 'All' },
  { id: 'WEEKLY',    label: 'Weekly' },
  { id: 'MONTHLY',   label: 'Monthly' },
  { id: 'QUARTERLY', label: 'Quarterly' },
  { id: 'YEARLY',    label: 'Yearly' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function SubscriptionsScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [view, setView]     = useState<'list' | 'grid'>('grid');

  const visible = useMemo(() => {
    return MOCK_SUBSCRIPTIONS.filter(s => {
      const matchInt  = filter === 'ALL' || s.interval === filter;
      const q         = search.trim().toLowerCase();
      const matchQ    = !q || s.name.toLowerCase().includes(q);
      return matchInt && matchQ;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Subscriptions"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search subscriptions..."
      view={view}
      onViewChange={setView}
      onAdd={() => { /* TODO */ }}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<Repeat2 size={48} color={palette.muted} />}
          title="No subscriptions"
          message="No subscriptions match your filters"
        />
      ) : view === 'grid' ? (
        <FlatList
          key="grid"
          data={visible}
          keyExtractor={s => String(s.id)}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <ListGridTile
              title={item.name}
              price={formatCurrency(item.price)}
              meta={`${item.interval} · ${item.activeCount} active`}
              icon={item.icon}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          key="list"
          data={visible}
          keyExtractor={s => String(s.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ListCard
              title={item.name}
              subtitle={`${item.interval} · ${item.activeCount} subscribers`}
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
