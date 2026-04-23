import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { BarChart3 } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListRowDense } from '../../components/list/ListRowDense';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency, formatDate } from '../../utils/formatters';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockReport {
  id:     number;
  title:  string;
  period: string;
  kind:   'DAILY' | 'WEEKLY' | 'MONTHLY';
  value:  number;
  date:   string;
}

const MOCK_REPORTS: MockReport[] = [
  { id: 1,  title: 'Daily Sales',           period: 'Apr 22',        kind: 'DAILY',   value: 48200,  date: '2026-04-22' },
  { id: 2,  title: 'Daily Sales',           period: 'Apr 21',        kind: 'DAILY',   value: 36100,  date: '2026-04-21' },
  { id: 3,  title: 'Daily Sales',           period: 'Apr 20',        kind: 'DAILY',   value: 52400,  date: '2026-04-20' },
  { id: 4,  title: 'Daily Sales',           period: 'Apr 19',        kind: 'DAILY',   value: 29800,  date: '2026-04-19' },
  { id: 5,  title: 'Weekly Summary',        period: 'Apr 13 – 19',   kind: 'WEEKLY',  value: 241200, date: '2026-04-19' },
  { id: 6,  title: 'Top Products',          period: 'Apr 13 – 19',   kind: 'WEEKLY',  value: 94600,  date: '2026-04-19' },
  { id: 7,  title: 'Service Utilisation',   period: 'Apr 13 – 19',   kind: 'WEEKLY',  value: 73,     date: '2026-04-19' },
  { id: 8,  title: 'Monthly Sales',         period: 'March',         kind: 'MONTHLY', value: 964300, date: '2026-03-31' },
  { id: 9,  title: 'Monthly Sales',         period: 'February',      kind: 'MONTHLY', value: 812500, date: '2026-02-28' },
  { id: 10, title: 'Monthly Sales',         period: 'January',       kind: 'MONTHLY', value: 755900, date: '2026-01-31' },
  { id: 11, title: 'Customer Retention',    period: 'Q1',            kind: 'MONTHLY', value: 68,     date: '2026-03-31' },
  { id: 12, title: 'Avg. Bill Value',       period: 'Q1',            kind: 'MONTHLY', value: 1820,   date: '2026-03-31' },
];

const FILTERS = [
  { id: 'ALL',     label: 'All' },
  { id: 'DAILY',   label: 'Daily' },
  { id: 'WEEKLY',  label: 'Weekly' },
  { id: 'MONTHLY', label: 'Monthly' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function ReportsScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    return MOCK_REPORTS.filter(r => {
      const matchKind  = filter === 'ALL' || r.kind === filter;
      const q          = search.trim().toLowerCase();
      const matchQuery = !q || r.title.toLowerCase().includes(q) || r.period.toLowerCase().includes(q);
      return matchKind && matchQuery;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Reports"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search reports..."
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<BarChart3 size={48} color={palette.muted} />}
          title="No reports"
          message="No reports match your filters"
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={r => String(r.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListRowDense
              title={item.title}
              subtitle={`${item.period} · ${item.kind}`}
              trailing={
                item.title.includes('Retention') || item.title.includes('Utilisation')
                  ? `${item.value}%`
                  : formatCurrency(item.value)
              }
              sub={formatDate(item.date)}
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
    paddingBottom: 40,
  },
});
