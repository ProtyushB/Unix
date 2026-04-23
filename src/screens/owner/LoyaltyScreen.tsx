import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListRowDense } from '../../components/list/ListRowDense';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { formatDate } from '../../utils/formatters';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockLoyaltyEntry {
  id:       number;
  customer: string;
  kind:     'EARNED' | 'REDEEMED' | 'ADJUSTED' | 'EXPIRED';
  points:   number;
  reason:   string;
  date:     string;
}

const MOCK_LOYALTY: MockLoyaltyEntry[] = [
  { id:  1, customer: 'Priya Sharma', kind: 'EARNED',   points:  245, reason: 'Bill #2041',          date: '2026-04-22' },
  { id:  2, customer: 'Aman Kumar',   kind: 'EARNED',   points:  890, reason: 'Bill #2040',          date: '2026-04-22' },
  { id:  3, customer: 'Riya Singh',   kind: 'REDEEMED', points: -500, reason: 'Facial discount',     date: '2026-04-22' },
  { id:  4, customer: 'Neha Verma',   kind: 'EARNED',   points: 1235, reason: 'Bill #2037',          date: '2026-04-21' },
  { id:  5, customer: 'Kabir Mehta',  kind: 'ADJUSTED', points:  200, reason: 'Birthday bonus',      date: '2026-04-21' },
  { id:  6, customer: 'Rahul Yadav',  kind: 'EARNED',   points:  360, reason: 'Bill #2036',          date: '2026-04-20' },
  { id:  7, customer: 'Priya Sharma', kind: 'REDEEMED', points:-1000, reason: 'Package discount',    date: '2026-04-20' },
  { id:  8, customer: 'Ishita Das',   kind: 'EARNED',   points:   89, reason: 'Bill #2035',          date: '2026-04-20' },
  { id:  9, customer: 'Arjun Rao',    kind: 'EARNED',   points:  542, reason: 'Bill #2034',          date: '2026-04-19' },
  { id: 10, customer: 'Meera Pillai', kind: 'EXPIRED',  points: -150, reason: 'Points expired',      date: '2026-04-18' },
  { id: 11, customer: 'Sana Ali',     kind: 'EARNED',   points:  780, reason: 'Bill #2028',          date: '2026-04-17' },
  { id: 12, customer: 'Vikram Iyer',  kind: 'REDEEMED', points: -250, reason: 'Service discount',    date: '2026-04-16' },
];

const FILTERS = [
  { id: 'ALL',      label: 'All' },
  { id: 'EARNED',   label: 'Earned' },
  { id: 'REDEEMED', label: 'Redeemed' },
  { id: 'ADJUSTED', label: 'Adjusted' },
  { id: 'EXPIRED',  label: 'Expired' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function LoyaltyScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    return MOCK_LOYALTY.filter(e => {
      const matchKind = filter === 'ALL' || e.kind === filter;
      const q         = search.trim().toLowerCase();
      const matchQ    = !q || e.customer.toLowerCase().includes(q) || e.reason.toLowerCase().includes(q);
      return matchKind && matchQ;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Loyalty"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search customer or reason..."
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<Star size={48} color={palette.muted} />}
          title="No loyalty entries"
          message="No entries match your filters"
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={e => String(e.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListRowDense
              title={item.customer}
              subtitle={`${item.reason} · ${item.kind}`}
              trailing={item.points > 0 ? `+${item.points}` : String(item.points)}
              sub={formatDate(item.date)}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ListShell>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 4, paddingBottom: 40 },
});
