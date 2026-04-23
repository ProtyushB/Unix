import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { CalendarClock, Scissors, Sparkles, Droplet } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListCard } from '../../components/list/ListCard';
import { ListGridTile } from '../../components/list/ListGridTile';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/formatters';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockPlan {
  id:       number;
  name:     string;
  category: 'HAIR' | 'SKIN' | 'NAILS';
  sessions: number;
  price:    number;
  validity: number; // months
  icon:     LucideIcon;
}

const MOCK_PLANS: MockPlan[] = [
  { id: 1, name: 'Haircut · 6 Pack',       category: 'HAIR',  sessions: 6,  price: 4200,  validity: 6,  icon: Scissors },
  { id: 2, name: 'Hair Spa Quarterly',     category: 'HAIR',  sessions: 3,  price: 3800,  validity: 3,  icon: Droplet },
  { id: 3, name: 'Facial Annual',          category: 'SKIN',  sessions: 12, price: 11800, validity: 12, icon: Sparkles },
  { id: 4, name: 'Mani-Pedi Combo · 10',   category: 'NAILS', sessions: 10, price: 9500,  validity: 12, icon: Sparkles },
  { id: 5, name: 'Hair Color Triple',      category: 'HAIR',  sessions: 3,  price: 7200,  validity: 6,  icon: Droplet },
  { id: 6, name: 'Skin Glow · 5 Session',  category: 'SKIN',  sessions: 5,  price: 5400,  validity: 6,  icon: Sparkles },
];

const FILTERS = [
  { id: 'ALL',   label: 'All' },
  { id: 'HAIR',  label: 'Hair' },
  { id: 'SKIN',  label: 'Skin' },
  { id: 'NAILS', label: 'Nails' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function ServicePlansScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [view, setView]     = useState<'list' | 'grid'>('grid');

  const visible = useMemo(() => {
    return MOCK_PLANS.filter(p => {
      const matchCat = filter === 'ALL' || p.category === filter;
      const q        = search.trim().toLowerCase();
      const matchQ   = !q || p.name.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Service Plans"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search plans..."
      view={view}
      onViewChange={setView}
      onAdd={() => { /* TODO */ }}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<CalendarClock size={48} color={palette.muted} />}
          title="No plans"
          message="No plans match your filters"
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
              meta={`${item.sessions} sessions · ${item.validity}mo`}
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
              subtitle={`${item.sessions} sessions · ${item.validity} months validity`}
              meta={item.category}
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
