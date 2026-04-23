import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListCard } from '../../components/list/ListCard';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency, formatDate } from '../../utils/formatters';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockWastage {
  id:       number;
  product:  string;
  quantity: string;
  reason:   string;
  cost:     number;
  status:   'PENDING' | 'APPROVED' | 'REJECTED';
  date:     string;
}

const MOCK_WASTAGE: MockWastage[] = [
  { id: 301, product: 'Vitamin C Serum',  quantity: '2 units',   reason: 'Expired',       cost: 2400, status: 'APPROVED', date: '2026-04-22' },
  { id: 302, product: 'Herbal Shampoo',   quantity: '1 unit',    reason: 'Damaged',       cost: 250,  status: 'PENDING',  date: '2026-04-22' },
  { id: 303, product: 'Clay Face Mask',   quantity: '4 units',   reason: 'Expired',       cost: 1280, status: 'APPROVED', date: '2026-04-21' },
  { id: 304, product: 'Matte Lipstick',   quantity: '1 unit',    reason: 'Customer return', cost: 450, status: 'REJECTED', date: '2026-04-20' },
  { id: 305, product: 'Argan Oil',        quantity: '250 ml',    reason: 'Spillage',      cost: 680,  status: 'APPROVED', date: '2026-04-19' },
  { id: 306, product: 'Rose Face Mist',   quantity: '2 units',   reason: 'Expired',       cost: 820,  status: 'PENDING',  date: '2026-04-18' },
];

const FILTERS = [
  { id: 'ALL',      label: 'All' },
  { id: 'PENDING',  label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function WastageScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    return MOCK_WASTAGE.filter(w => {
      const matchStatus = filter === 'ALL' || w.status === filter;
      const q           = search.trim().toLowerCase();
      const matchQuery  = !q || w.product.toLowerCase().includes(q) || w.reason.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Wastage"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by product or reason..."
      onAdd={() => { /* TODO */ }}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle size={48} color={palette.muted} />}
          title="No wastage"
          message="No entries match your filters"
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={w => String(w.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListCard
              title={item.product}
              subtitle={`${item.quantity} · ${item.reason}`}
              meta={formatDate(item.date)}
              amount={formatCurrency(item.cost)}
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
