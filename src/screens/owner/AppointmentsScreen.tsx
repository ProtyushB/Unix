import React, { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListRowDense } from '../../components/list/ListRowDense';
import { ListSectionHeader } from '../../components/list/ListSectionHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockAppointment {
  id:          number;
  time:        string;
  customer:    string;
  service:     string;
  status:      'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  dateSection: string;
}

const MOCK_APPOINTMENTS: MockAppointment[] = [
  { id: 101, time: '10:00', customer: 'Priya Sharma', service: 'Haircut',    status: 'CONFIRMED', dateSection: 'TODAY · APR 23' },
  { id: 102, time: '11:30', customer: 'Riya Singh',   service: 'Facial',     status: 'CONFIRMED', dateSection: 'TODAY · APR 23' },
  { id: 103, time: '14:00', customer: 'Aman Kumar',   service: 'Massage',    status: 'SCHEDULED', dateSection: 'TODAY · APR 23' },
  { id: 104, time: '16:00', customer: 'Neha Verma',   service: 'Manicure',   status: 'SCHEDULED', dateSection: 'TODAY · APR 23' },
  { id: 105, time: '09:00', customer: 'Meera P',      service: 'Threading',  status: 'SCHEDULED', dateSection: 'TOMORROW · APR 24' },
  { id: 106, time: '11:00', customer: 'Ishita Das',   service: 'Hair Color', status: 'SCHEDULED', dateSection: 'TOMORROW · APR 24' },
  { id: 107, time: '13:00', customer: 'Kabir Mehta',  service: 'Beard Trim', status: 'SCHEDULED', dateSection: 'TOMORROW · APR 24' },
  { id: 108, time: '15:30', customer: 'Arjun Rao',    service: 'Spa',        status: 'SCHEDULED', dateSection: 'TOMORROW · APR 24' },
  { id: 109, time: '10:30', customer: 'Rahul Yadav',  service: 'Haircut',    status: 'SCHEDULED', dateSection: 'FRI · APR 25' },
  { id: 110, time: '12:00', customer: 'Sana Ali',     service: 'Facial',     status: 'SCHEDULED', dateSection: 'FRI · APR 25' },
];

const FILTERS = [
  { id: 'ALL',       label: 'All' },
  { id: 'SCHEDULED', label: 'Scheduled' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'COMPLETED', label: 'Completed' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function AppointmentsScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = MOCK_APPOINTMENTS.filter(a => {
      const matchStatus = filter === 'ALL' || a.status === filter;
      const matchQuery  =
        !q ||
        a.customer.toLowerCase().includes(q) ||
        a.service.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });

    const byDate = new Map<string, MockAppointment[]>();
    filtered.forEach(a => {
      const bucket = byDate.get(a.dateSection) ?? [];
      bucket.push(a);
      byDate.set(a.dateSection, bucket);
    });

    return Array.from(byDate.entries()).map(([title, data]) => ({ title, data }));
  }, [filter, search]);

  const total = sections.reduce((n, s) => n + s.data.length, 0);

  return (
    <ListShell
      title="Appointments"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search customer or service..."
      onAdd={() => { /* TODO: navigate to appointment create */ }}
    >
      {total === 0 ? (
        <EmptyState
          icon={<Calendar size={48} color={palette.muted} />}
          title="No appointments"
          message="No appointments match your filters"
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={a => String(a.id)}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <ListSectionHeader title={section.title} count={section.data.length} />
          )}
          renderItem={({ item }) => (
            <ListRowDense
              title={`${item.time}  ${item.customer}`}
              subtitle={item.service}
              trailing={item.status}
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
    paddingBottom: 100,
  },
});
