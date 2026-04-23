import React, { useMemo, useState } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { Package } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListCard } from '../../components/list/ListCard';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency, formatDate } from '../../utils/formatters';

// ─── Mock Data ───────────────────────────────────────────────────────────────
// Placeholder data until the real hook lands. Shapes mirror
// parlour/pharmacy/restaurant order rows.

interface MockOrder {
  id:           number;
  customerName: string;
  itemCount:    number;
  amount:       number;
  status:       'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  date:         string;
}

const MOCK_ORDERS: MockOrder[] = [
  { id: 1023, customerName: 'Priya Sharma', itemCount: 2, amount: 2450,  status: 'PENDING',   date: '2026-04-22' },
  { id: 1022, customerName: 'Aman Kumar',   itemCount: 5, amount: 8900,  status: 'COMPLETED', date: '2026-04-22' },
  { id: 1021, customerName: 'Riya Singh',   itemCount: 3, amount: 1200,  status: 'COMPLETED', date: '2026-04-22' },
  { id: 1020, customerName: 'Kabir Mehta',  itemCount: 1, amount:  450,  status: 'CANCELLED', date: '2026-04-21' },
  { id: 1019, customerName: 'Neha Verma',   itemCount: 7, amount: 12350, status: 'CONFIRMED', date: '2026-04-21' },
  { id: 1018, customerName: 'Rahul Yadav',  itemCount: 4, amount: 3600,  status: 'COMPLETED', date: '2026-04-21' },
  { id: 1017, customerName: 'Ishita Das',   itemCount: 2, amount:  890,  status: 'PENDING',   date: '2026-04-20' },
  { id: 1016, customerName: 'Arjun Rao',    itemCount: 6, amount: 5420,  status: 'COMPLETED', date: '2026-04-20' },
];

const FILTERS = [
  { id: 'ALL',       label: 'All' },
  { id: 'PENDING',   label: 'Pending' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function OrdersScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    return MOCK_ORDERS.filter(o => {
      const matchStatus = filter === 'ALL' || o.status === filter;
      const q           = search.trim().toLowerCase();
      const matchQuery  =
        !q ||
        o.customerName.toLowerCase().includes(q) ||
        String(o.id).includes(q);
      return matchStatus && matchQuery;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Orders"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by customer or #..."
      onAdd={() => { /* TODO: navigate to order create */ }}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<Package size={48} color={palette.muted} />}
          title="No orders"
          message="Try adjusting your filters or search terms"
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={o => String(o.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListCard
              title={`#${item.id}`}
              subtitle={item.customerName}
              meta={`${item.itemCount} items · ${formatDate(item.date)}`}
              amount={formatCurrency(item.amount)}
              status={item.status}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ListShell>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  list: {
    paddingTop:    8,
    paddingBottom: 100,
  },
});
