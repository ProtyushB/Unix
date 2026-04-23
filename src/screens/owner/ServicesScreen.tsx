import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Layers, Scissors, Sparkles, Droplet, Palette } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListCard } from '../../components/list/ListCard';
import { ListGridTile } from '../../components/list/ListGridTile';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/formatters';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockService {
  id:       number;
  name:     string;
  category: 'HAIR' | 'SKIN' | 'NAILS' | 'MAKEUP';
  price:    number;
  duration: number; // minutes
  active:   boolean;
  icon:     LucideIcon;
}

const MOCK_SERVICES: MockService[] = [
  { id: 1,  name: 'Haircut',          category: 'HAIR',   price: 800,  duration: 45,  active: true,  icon: Scissors },
  { id: 2,  name: 'Hair Color',       category: 'HAIR',   price: 2800, duration: 120, active: true,  icon: Palette },
  { id: 3,  name: 'Hair Spa',         category: 'HAIR',   price: 1500, duration: 75,  active: true,  icon: Droplet },
  { id: 4,  name: 'Facial — Classic', category: 'SKIN',   price: 1200, duration: 60,  active: true,  icon: Sparkles },
  { id: 5,  name: 'Facial — Gold',    category: 'SKIN',   price: 3500, duration: 90,  active: true,  icon: Sparkles },
  { id: 6,  name: 'Threading',        category: 'SKIN',   price: 150,  duration: 15,  active: true,  icon: Layers },
  { id: 7,  name: 'Manicure',         category: 'NAILS',  price: 600,  duration: 40,  active: true,  icon: Sparkles },
  { id: 8,  name: 'Pedicure',         category: 'NAILS',  price: 800,  duration: 50,  active: true,  icon: Sparkles },
  { id: 9,  name: 'Bridal Makeup',    category: 'MAKEUP', price: 8500, duration: 180, active: true,  icon: Palette },
  { id: 10, name: 'Party Makeup',     category: 'MAKEUP', price: 2500, duration: 60,  active: false, icon: Palette },
];

const FILTERS = [
  { id: 'ALL',    label: 'All' },
  { id: 'HAIR',   label: 'Hair' },
  { id: 'SKIN',   label: 'Skin' },
  { id: 'NAILS',  label: 'Nails' },
  { id: 'MAKEUP', label: 'Makeup' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function ServicesScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [view, setView]     = useState<'list' | 'grid'>('grid');

  const visible = useMemo(() => {
    return MOCK_SERVICES.filter(s => {
      const matchCat   = filter === 'ALL' || s.category === filter;
      const q          = search.trim().toLowerCase();
      const matchQuery = !q || s.name.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Services"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search services..."
      view={view}
      onViewChange={setView}
      onAdd={() => { /* TODO */ }}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<Layers size={48} color={palette.muted} />}
          title="No services"
          message="No services match your filters"
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
              meta={`${item.duration} min${item.active ? '' : ' · Inactive'}`}
              statusKey={item.active ? 'COMPLETED' : 'CANCELLED'}
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
              subtitle={item.category}
              meta={`${item.duration} min`}
              amount={formatCurrency(item.price)}
              status={item.active ? 'ACTIVE' : 'INACTIVE'}
              statusKey={item.active ? 'COMPLETED' : 'CANCELLED'}
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
