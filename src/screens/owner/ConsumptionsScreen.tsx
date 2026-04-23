import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Beaker } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListCard } from '../../components/list/ListCard';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { formatDate } from '../../utils/formatters';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockConsumption {
  id:       number;
  product:  string;
  service:  string;
  quantity: string;
  status:   'RECORDED' | 'PENDING';
  date:     string;
}

const MOCK_CONSUMPTIONS: MockConsumption[] = [
  { id: 901, product: 'Herbal Shampoo',    service: 'Haircut',     quantity: '30 ml',  status: 'RECORDED', date: '2026-04-22' },
  { id: 902, product: 'Argan Oil',         service: 'Hair Spa',    quantity: '15 ml',  status: 'RECORDED', date: '2026-04-22' },
  { id: 903, product: 'Clay Face Mask',    service: 'Facial',      quantity: '1 unit', status: 'RECORDED', date: '2026-04-22' },
  { id: 904, product: 'Vitamin C Serum',   service: 'Facial',      quantity: '3 ml',   status: 'PENDING',  date: '2026-04-22' },
  { id: 905, product: 'Conditioner',       service: 'Haircut',     quantity: '25 ml',  status: 'RECORDED', date: '2026-04-21' },
  { id: 906, product: 'Rose Face Mist',    service: 'Facial',      quantity: '10 ml',  status: 'RECORDED', date: '2026-04-21' },
  { id: 907, product: 'Matte Lipstick',    service: 'Bridal',      quantity: '1 unit', status: 'PENDING',  date: '2026-04-20' },
  { id: 908, product: 'Kohl Eyeliner',     service: 'Bridal',      quantity: '1 unit', status: 'RECORDED', date: '2026-04-20' },
];

const FILTERS = [
  { id: 'ALL',      label: 'All' },
  { id: 'RECORDED', label: 'Recorded' },
  { id: 'PENDING',  label: 'Pending' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function ConsumptionsScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    return MOCK_CONSUMPTIONS.filter(c => {
      const matchStatus = filter === 'ALL' || c.status === filter;
      const q           = search.trim().toLowerCase();
      const matchQuery  = !q || c.product.toLowerCase().includes(q) || c.service.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Consumptions"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by product or service..."
      onAdd={() => { /* TODO */ }}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<Beaker size={48} color={palette.muted} />}
          title="No consumption records"
          message="No entries match your filters"
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListCard
              title={item.product}
              subtitle={`${item.service} · ${item.quantity}`}
              meta={formatDate(item.date)}
              status={item.status}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ListShell>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, paddingBottom: 100 },
});
