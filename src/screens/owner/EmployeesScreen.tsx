import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Users } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListAvatarRow } from '../../components/list/ListAvatarRow';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockEmployee {
  id:       number;
  name:     string;
  role:     string;
  location: string;
  status:   'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
  phone:    string;
}

const MOCK_EMPLOYEES: MockEmployee[] = [
  { id:  1, name: 'Priya Nair',     role: 'Stylist',      location: 'Mumbai · Andheri', status: 'ACTIVE',   phone: '+91 98200 20001' },
  { id:  2, name: 'Rohit Agarwal',  role: 'Manager',      location: 'Mumbai · Andheri', status: 'ACTIVE',   phone: '+91 98200 20002' },
  { id:  3, name: 'Kavya Reddy',    role: 'Receptionist', location: 'Mumbai · Bandra',  status: 'ACTIVE',   phone: '+91 98200 20003' },
  { id:  4, name: 'Farhan Khan',    role: 'Stylist',      location: 'Mumbai · Bandra',  status: 'ON_LEAVE', phone: '+91 98200 20004' },
  { id:  5, name: 'Anjali Singh',   role: 'Therapist',    location: 'Pune · Koregaon',  status: 'ACTIVE',   phone: '+91 98200 20005' },
  { id:  6, name: 'Dev Kapoor',     role: 'Stylist',      location: 'Pune · Koregaon',  status: 'ACTIVE',   phone: '+91 98200 20006' },
  { id:  7, name: 'Sneha Menon',    role: 'Manager',      location: 'Delhi · CP',       status: 'ACTIVE',   phone: '+91 98200 20007' },
  { id:  8, name: 'Tarun Bhatt',    role: 'Stylist',      location: 'Delhi · CP',       status: 'INACTIVE', phone: '+91 98200 20008' },
  { id:  9, name: 'Maya Joshi',     role: 'Therapist',    location: 'Delhi · Saket',    status: 'ACTIVE',   phone: '+91 98200 20009' },
  { id: 10, name: 'Suresh Pillai',  role: 'Receptionist', location: 'Delhi · Saket',    status: 'ACTIVE',   phone: '+91 98200 20010' },
];

const FILTERS = [
  { id: 'ALL',      label: 'All' },
  { id: 'ACTIVE',   label: 'Active' },
  { id: 'ON_LEAVE', label: 'On leave' },
  { id: 'INACTIVE', label: 'Inactive' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function EmployeesScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    return MOCK_EMPLOYEES.filter(e => {
      const matchStatus = filter === 'ALL' || e.status === filter;
      const q           = search.trim().toLowerCase();
      const matchQ      =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q);
      return matchStatus && matchQ;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Employees"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by name, role or location..."
      onAdd={() => { /* TODO */ }}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<Users size={48} color={palette.muted} />}
          title="No employees"
          message="No employees match your filters"
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={e => String(e.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListAvatarRow
              name={item.name}
              subtitle={`${item.role} · ${item.location}`}
              trailing={item.status === 'ACTIVE' ? '' : item.status.replace('_', ' ')}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ListShell>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 4, paddingBottom: 100 },
});
