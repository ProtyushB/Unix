import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListCard } from '../../components/list/ListCard';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { formatDate } from '../../utils/formatters';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockClaim {
  id:       number;
  product:  string;
  customer: string;
  issue:    string;
  status:   'PENDING' | 'APPROVED' | 'REJECTED' | 'RESOLVED';
  date:     string;
}

const MOCK_CLAIMS: MockClaim[] = [
  { id: 701, product: 'Hair Scissors Pro', customer: 'Priya Sharma', issue: 'Blade chipped',       status: 'APPROVED', date: '2026-04-22' },
  { id: 702, product: 'Styling Comb Set',  customer: 'Aman Kumar',   issue: 'Teeth broken',        status: 'RESOLVED', date: '2026-04-20' },
  { id: 703, product: 'Hair Scissors Pro', customer: 'Kabir Mehta',  issue: 'Screws loose',        status: 'PENDING',  date: '2026-04-19' },
  { id: 704, product: 'Electric Clipper',  customer: 'Neha Verma',   issue: 'Motor stopped',       status: 'APPROVED', date: '2026-04-18' },
  { id: 705, product: 'Hair Straightener', customer: 'Riya Singh',   issue: 'Plate not heating',   status: 'REJECTED', date: '2026-04-16' },
  { id: 706, product: 'Styling Comb Set',  customer: 'Arjun Rao',    issue: 'Handle cracked',      status: 'RESOLVED', date: '2026-04-14' },
];

const FILTERS = [
  { id: 'ALL',      label: 'All' },
  { id: 'PENDING',  label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'RESOLVED', label: 'Resolved' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function WarrantyClaimsScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    return MOCK_CLAIMS.filter(c => {
      const matchStatus = filter === 'ALL' || c.status === filter;
      const q           = search.trim().toLowerCase();
      const matchQuery  =
        !q ||
        c.product.toLowerCase().includes(q) ||
        c.customer.toLowerCase().includes(q) ||
        c.issue.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Warranty Claims"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search product, customer or issue..."
      onAdd={() => { /* TODO */ }}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={48} color={palette.muted} />}
          title="No claims"
          message="No claims match your filters"
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListCard
              title={`#${item.id}  ${item.product}`}
              subtitle={`${item.customer} · ${item.issue}`}
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
