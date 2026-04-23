import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Users } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListAvatarRow } from '../../components/list/ListAvatarRow';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/formatters';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockCustomer {
  id:        number;
  name:      string;
  phone:     string;
  totalSpend: number;
  segment:   'REGULAR' | 'VIP' | 'NEW';
}

const MOCK_CUSTOMERS: MockCustomer[] = [
  { id:  1, name: 'Priya Sharma',  phone: '+91 98200 11001', totalSpend:  48200, segment: 'VIP' },
  { id:  2, name: 'Aman Kumar',    phone: '+91 98200 11002', totalSpend:  28400, segment: 'REGULAR' },
  { id:  3, name: 'Riya Singh',    phone: '+91 98200 11003', totalSpend:  12800, segment: 'REGULAR' },
  { id:  4, name: 'Kabir Mehta',   phone: '+91 98200 11004', totalSpend:   3200, segment: 'NEW' },
  { id:  5, name: 'Neha Verma',    phone: '+91 98200 11005', totalSpend:  62100, segment: 'VIP' },
  { id:  6, name: 'Rahul Yadav',   phone: '+91 98200 11006', totalSpend:  18500, segment: 'REGULAR' },
  { id:  7, name: 'Ishita Das',    phone: '+91 98200 11007', totalSpend:   1900, segment: 'NEW' },
  { id:  8, name: 'Arjun Rao',     phone: '+91 98200 11008', totalSpend:  35700, segment: 'REGULAR' },
  { id:  9, name: 'Meera Pillai',  phone: '+91 98200 11009', totalSpend:   8900, segment: 'REGULAR' },
  { id: 10, name: 'Sana Ali',      phone: '+91 98200 11010', totalSpend:  52400, segment: 'VIP' },
  { id: 11, name: 'Vikram Iyer',   phone: '+91 98200 11011', totalSpend:   6200, segment: 'REGULAR' },
  { id: 12, name: 'Tara Banerjee', phone: '+91 98200 11012', totalSpend:  14300, segment: 'REGULAR' },
];

const FILTERS = [
  { id: 'ALL',     label: 'All' },
  { id: 'VIP',     label: 'VIP' },
  { id: 'REGULAR', label: 'Regular' },
  { id: 'NEW',     label: 'New' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function CustomersScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    return MOCK_CUSTOMERS.filter(c => {
      const matchSegment = filter === 'ALL' || c.segment === filter;
      const q            = search.trim().toLowerCase();
      const matchQuery   =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q);
      return matchSegment && matchQuery;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Customers"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by name or phone..."
      onAdd={() => { /* TODO: navigate to customer create */ }}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<Users size={48} color={palette.muted} />}
          title="No customers"
          message="No customers match your filters"
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListAvatarRow
              name={item.name}
              subtitle={`${item.phone} · ${item.segment}`}
              trailing={formatCurrency(item.totalSpend)}
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
    paddingTop:    4,
    paddingBottom: 100,
  },
});
