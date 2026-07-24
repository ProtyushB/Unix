import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Package } from 'lucide-react-native';

import { ListShell } from '../../components/list/ListShell';
import { ListCard } from '../../components/list/ListCard';
import { ListSectionHeader } from '../../components/list/ListSectionHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';
import { formatCurrency, formatTimeParts } from '../../utils/formatters';
import { DATE_PRESETS, rangeForPreset, type DatePresetId } from '../../utils/dateRange';

import { useAppContext } from '../../context/AppContext';
import { useParlour } from '../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../backend/modules/pharmacy/hook/usePharmacy';
import { useRestaurant } from '../../backend/modules/restaurant/hook/useRestaurant';
import type { OrderListOptions } from '../../backend/modules/shared/hook/useModuleService';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

// Canonical chip order + labels. The chip for a status renders only when the
// summary reports a non-zero count for it, so e.g. Pending stays hidden until a
// pending order exists (business-portal orders are created CONFIRMED).
const STATUS_ORDER = ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REJECTED'] as const;
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};
// Fallback status chips when no summary is available (module without the endpoint).
const FALLBACK_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED'];

// ─── Row mapping ────────────────────────────────────────────────────────────
// The list endpoint returns raw backend DTOs — field names mirror the owner
// portal (note `orderStatus`/`orderDate`, NOT `status`/`date`).

interface OrderRow {
  id: number;
  customerName: string;
  orderNumber: string;
  amount: number;
  status: string;
  when: string | null;
}

function toOrderRow(raw: any, index: number): OrderRow {
  const name =
    raw?.customerFirstName && raw?.customerLastName
      ? `${raw.customerFirstName} ${raw.customerLastName}`
      : raw?.customerName || raw?.customer || 'Unknown Customer';
  return {
    id: raw?.id ?? index,
    customerName: name,
    orderNumber: raw?.orderNumber || `#${raw?.id ?? index}`,
    amount: Number(raw?.totalAmount ?? 0),
    status: raw?.orderStatus || 'PENDING',
    when: raw?.orderDate || raw?.createdAt || null,
  };
}

/** Calendar-day key (local) used to bucket rows into date sections. */
function dayKeyOf(iso: string | null): string {
  if (!iso) return 'undated';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'undated';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Section title: TODAY / YESTERDAY / TOMORROW, else "22 APR". */
function dayLabelOf(iso: string | null): string {
  if (!iso) return 'UNDATED';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'UNDATED';
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((day.getTime() - t0.getTime()) / 86400000);
  if (diff === 0) return 'TODAY';
  if (diff === -1) return 'YESTERDAY';
  if (diff === 1) return 'TOMORROW';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function OrdersScreen() {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const restaurant = useRestaurant();

  // selectedModule holds the raw business-type key (PARLOUR / PHARMACY / …).
  const moduleKey = (selectedModule || '').toUpperCase();
  const activeModule =
    moduleKey === 'RESTAURANT' ? restaurant : moduleKey === 'PHARMACY' ? pharmacy : parlour;

  const [dateFilter, setDateFilter] = useState<DatePresetId>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);

  // Debounce search → server round-trip.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const range = useMemo(() => rangeForPreset(dateFilter), [dateFilter]);

  const listOpts = useMemo<OrderListOptions>(
    () => ({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
      ...range,
    }),
    [debouncedSearch, statusFilter, range],
  );

  // Reload the list (page 1) whenever the module or any filter changes.
  useEffect(() => {
    pageRef.current = 1;
    activeModule.loadOrders(1, PAGE_SIZE, listOpts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey, listOpts]);

  // Reload the status-chip counts — scoped to the date window only (independent
  // of the selected status and search), so counts describe the whole window.
  useEffect(() => {
    activeModule.loadOrderSummary?.(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey, range]);

  // Sync the hook's (page-replacing) orders into the accumulated local list:
  // page 1 replaces, later pages append.
  useEffect(() => {
    const mapped = (activeModule.orders as any[]).map(toOrderRow);
    setRows(prev => (pageRef.current <= 1 ? mapped : [...prev, ...mapped]));
    loadingMoreRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule.orders]);

  const onEndReached = useCallback(() => {
    if (loadingMoreRef.current || activeModule.loading) return;
    if (pageRef.current >= (activeModule.ordersTotalPages || 1)) return;
    loadingMoreRef.current = true;
    pageRef.current += 1;
    activeModule.loadOrders(pageRef.current, PAGE_SIZE, listOpts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listOpts, activeModule.loading, activeModule.ordersTotalPages]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    pageRef.current = 1;
    await Promise.all([
      activeModule.loadOrders(1, PAGE_SIZE, listOpts),
      activeModule.loadOrderSummary?.(range) ?? Promise.resolve(),
    ]);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listOpts, range]);

  const summary = activeModule.orderSummary;

  // Status chips: All + each present status (count > 0). Falls back to a static
  // set (no counts) when the module has no summary endpoint.
  const statusChips = useMemo(() => {
    const chips: { id: string; label: string; count?: number }[] = [
      { id: 'ALL', label: 'All', count: summary?.total },
    ];
    if (summary) {
      for (const s of STATUS_ORDER) {
        const c = summary.byStatus?.[s];
        if (c && c > 0) chips.push({ id: s, label: STATUS_LABEL[s] ?? s, count: c });
      }
    } else {
      for (const s of FALLBACK_STATUSES) chips.push({ id: s, label: STATUS_LABEL[s] });
    }
    return chips;
  }, [summary]);

  const sections = useMemo(() => {
    const map = new Map<string, { title: string; data: OrderRow[] }>();
    for (const r of rows) {
      const key = dayKeyOf(r.when);
      let bucket = map.get(key);
      if (!bucket) {
        bucket = { title: dayLabelOf(r.when), data: [] };
        map.set(key, bucket);
      }
      bucket.data.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  const initialLoading = activeModule.loading && rows.length === 0;

  return (
    <ListShell
      title="Orders"
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by customer or #..."
      onAdd={() => {
        /* TODO: navigate to order create */
      }}
    >
      <View style={styles.filters}>
        {/* Date range presets */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          {DATE_PRESETS.map(p => (
            <Chip
              key={p.id}
              label={p.label}
              active={dateFilter === p.id}
              accent={colors.primary}
              palette={palette}
              onPress={() => setDateFilter(p.id)}
            />
          ))}
        </ScrollView>

        {/* Status chips with counts */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          {statusChips.map(c => (
            <Chip
              key={c.id}
              label={c.label}
              count={c.count}
              active={statusFilter === c.id}
              accent={colors.primary}
              palette={palette}
              onPress={() => setStatusFilter(c.id)}
            />
          ))}
        </ScrollView>
      </View>

      {initialLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : sections.length === 0 ? (
        <EmptyState
          icon={<Package size={48} color={palette.muted} />}
          title="No orders"
          message={activeModule.error || 'No orders match your filters'}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => String(item.id)}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <ListSectionHeader title={section.title} count={section.data.length} />
          )}
          renderItem={({ item }) => {
            const tp = formatTimeParts(item.when);
            return (
              <ListCard
                title={item.customerName}
                status={STATUS_LABEL[item.status] ?? item.status}
                statusKey={item.status}
                subtitle={item.orderNumber}
                meta={tp ? `${tp.time} ${tp.meridiem}` : ''}
                amount={formatCurrency(item.amount)}
              />
            );
          }}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListFooterComponent={
            activeModule.loading && rows.length > 0 ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </ListShell>
  );
}

// ─── Chip ──────────────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  count?: number;
  active: boolean;
  accent: string;
  palette: AppTheme['palette'];
  onPress: () => void;
}

function Chip({ label, count, active, accent, palette, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: palette.divider }}
      style={[
        chipStyles.chip,
        { backgroundColor: palette.surface, borderColor: palette.divider },
        active && { backgroundColor: accent + '22', borderColor: accent },
      ]}
    >
      <Text style={[chipStyles.label, { color: active ? accent : palette.muted }]}>{label}</Text>
      {count != null && (
        <Text style={[chipStyles.count, { color: active ? accent : palette.muted }]}>{count}</Text>
      )}
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  count: {
    fontSize: 12,
    fontWeight: '700',
  },
});

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    filters: {
      gap: 8,
      paddingBottom: 6,
    },
    chipRow: {
      paddingHorizontal: 16,
      gap: 8,
      alignItems: 'center',
    },
    list: {
      paddingTop: 4,
      paddingBottom: 100,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footer: {
      paddingVertical: 16,
    },
  });
}
