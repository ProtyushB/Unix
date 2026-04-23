import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { ArrowLeftRight } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListCard } from '../../components/list/ListCard';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { formatDate } from '../../utils/formatters';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockTransfer {
  id:        number;
  from:      string;
  to:        string;
  itemCount: number;
  status:    'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED';
  date:      string;
}

const MOCK_TRANSFERS: MockTransfer[] = [
  { id: 501, from: 'Mumbai · Andheri',  to: 'Mumbai · Bandra',  itemCount: 12, status: 'RECEIVED',   date: '2026-04-22' },
  { id: 502, from: 'Mumbai · Bandra',   to: 'Pune · Koregaon',  itemCount: 8,  status: 'IN_TRANSIT', date: '2026-04-22' },
  { id: 503, from: 'Main Warehouse',    to: 'Mumbai · Andheri', itemCount: 45, status: 'RECEIVED',   date: '2026-04-21' },
  { id: 504, from: 'Pune · Koregaon',   to: 'Pune · Baner',     itemCount: 6,  status: 'PENDING',    date: '2026-04-21' },
  { id: 505, from: 'Main Warehouse',    to: 'Delhi · CP',       itemCount: 22, status: 'IN_TRANSIT', date: '2026-04-20' },
  { id: 506, from: 'Delhi · CP',        to: 'Delhi · Saket',    itemCount: 4,  status: 'REJECTED',   date: '2026-04-19' },
];

const FILTERS = [
  { id: 'ALL',        label: 'All' },
  { id: 'PENDING',    label: 'Pending' },
  { id: 'IN_TRANSIT', label: 'In transit' },
  { id: 'RECEIVED',   label: 'Received' },
  { id: 'REJECTED',   label: 'Rejected' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function StockTransfersScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    return MOCK_TRANSFERS.filter(t => {
      const matchStatus = filter === 'ALL' || t.status === filter;
      const q           = search.trim().toLowerCase();
      const matchQuery  = !q || t.from.toLowerCase().includes(q) || t.to.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Stock Transfers"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by location..."
      onAdd={() => { /* TODO */ }}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight size={48} color={palette.muted} />}
          title="No transfers"
          message="No transfers match your filters"
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={t => String(t.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListCard
              title={`#${item.id}  ${item.from} → ${item.to}`}
              subtitle={`${item.itemCount} items`}
              meta={formatDate(item.date)}
              status={item.status.replace('_', ' ')}
              statusKey={item.status}
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
