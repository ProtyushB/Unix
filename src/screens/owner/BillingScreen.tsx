import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Receipt } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListCard } from '../../components/list/ListCard';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency, formatDate } from '../../utils/formatters';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockBill {
  id:       number;
  customer: string;
  amount:   number;
  status:   'PAID' | 'UNPAID' | 'OVERDUE' | 'PARTIAL';
  date:     string;
}

const MOCK_BILLS: MockBill[] = [
  { id: 2041, customer: 'Priya Sharma', amount: 2450,  status: 'PAID',    date: '2026-04-22' },
  { id: 2040, customer: 'Aman Kumar',   amount: 8900,  status: 'PAID',    date: '2026-04-22' },
  { id: 2039, customer: 'Riya Singh',   amount: 1200,  status: 'UNPAID',  date: '2026-04-22' },
  { id: 2038, customer: 'Kabir Mehta',  amount: 4500,  status: 'PARTIAL', date: '2026-04-21' },
  { id: 2037, customer: 'Neha Verma',   amount: 12350, status: 'PAID',    date: '2026-04-21' },
  { id: 2036, customer: 'Rahul Yadav',  amount: 3600,  status: 'OVERDUE', date: '2026-04-15' },
  { id: 2035, customer: 'Ishita Das',   amount: 890,   status: 'PAID',    date: '2026-04-20' },
  { id: 2034, customer: 'Arjun Rao',    amount: 5420,  status: 'UNPAID',  date: '2026-04-20' },
];

const FILTERS = [
  { id: 'ALL',     label: 'All' },
  { id: 'PAID',    label: 'Paid' },
  { id: 'UNPAID',  label: 'Unpaid' },
  { id: 'OVERDUE', label: 'Overdue' },
  { id: 'PARTIAL', label: 'Partial' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function BillingScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    return MOCK_BILLS.filter(b => {
      const matchStatus = filter === 'ALL' || b.status === filter;
      const q           = search.trim().toLowerCase();
      const matchQuery  = !q || b.customer.toLowerCase().includes(q) || String(b.id).includes(q);
      return matchStatus && matchQuery;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Billing"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by customer or bill #..."
      onAdd={() => { /* TODO: navigate to bill create */ }}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<Receipt size={48} color={palette.muted} />}
          title="No bills"
          message="No bills match your filters"
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={b => String(b.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListCard
              title={`#${item.id}`}
              subtitle={item.customer}
              meta={formatDate(item.date)}
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

const styles = StyleSheet.create({
  list: { paddingTop: 8, paddingBottom: 100 },
});
