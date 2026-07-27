import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, Search, SlidersHorizontal, X } from 'lucide-react-native';

import { FAB } from '../../components/layout/FAB';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';
import { formatCurrency } from '../../utils/formatters';
import { DATE_PRESETS, rangeForPreset, type DatePresetId } from '../../utils/dateRange';

import { useAppContext } from '../../context/AppContext';
import { useParlour } from '../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../backend/modules/pharmacy/hook/usePharmacy';
import { useRestaurant } from '../../backend/modules/restaurant/hook/useRestaurant';
import type { OrderListOptions } from '../../backend/modules/shared/hook/useModuleService';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

// Chip order for the status row. A chip renders only when the summary reports a
// non-zero count for it, so e.g. Pending stays hidden until a pending order
// exists (business-portal orders are created CONFIRMED).
const STATUS_ORDER = ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REJECTED'] as const;

const STATUS_LABEL: Record<string, string> = {
  PENDING:    'Pending',
  CONFIRMED:  'Confirmed',
  PROCESSING: 'Processing',
  COMPLETED:  'Completed',
  CANCELLED:  'Cancelled',
  REJECTED:   'Rejected',
};

// Shown (without counts) when the active module has no summary endpoint.
const FALLBACK_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED'];

// ─── Row mapping ─────────────────────────────────────────────────────────────
// The list endpoint returns raw backend DTOs — field names mirror the owner
// portal (note `orderStatus` / `orderDate`, NOT `status` / `date`).

interface OrderRow {
  id:           number;
  customerName: string;
  orderNumber:  string;
  amount:       number;
  status:       string;
  when:         string | null;
}

function toOrderRow(raw: any, index: number): OrderRow {
  const name =
    raw?.customerFirstName && raw?.customerLastName
      ? `${raw.customerFirstName} ${raw.customerLastName}`
      : raw?.customerName || raw?.customer || 'Unknown Customer';
  return {
    id:           raw?.id ?? index,
    customerName: name,
    orderNumber:  raw?.orderNumber || `#${raw?.id ?? index}`,
    amount:       Number(raw?.totalAmount ?? 0),
    status:       raw?.orderStatus || 'PENDING',
    when:         raw?.orderDate || raw?.createdAt || null,
  };
}

/**
 * Card amounts read as whole rupees per the mockup (₹2,450, not ₹2,450.00), but
 * keep paise when an order actually carries them. Local to this screen —
 * formatCurrency's always-2-decimals contract is relied on elsewhere.
 */
function formatAmount(n: number): string {
  return formatCurrency(n).replace(/\.00$/, '');
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "2:30 PM" — the time half of the card's meta line. */
function timeOf(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const h24 = d.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = d.getMinutes();
  return `${h12}:${mm < 10 ? `0${mm}` : mm} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** Calendar-day key (local) used to bucket rows into sections. */
function dayKeyOf(iso: string | null): string {
  if (!iso) return 'undated';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'undated';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Section title: "TODAY · 22 APR", "YESTERDAY · 21 APR", else "22 APR". */
function dayLabelOf(iso: string | null): string {
  if (!iso) return 'UNDATED';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'UNDATED';
  const stamp = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return `TODAY · ${stamp}`;
  if (diff === -1) return `YESTERDAY · ${stamp}`;
  if (diff === 1) return `TOMORROW · ${stamp}`;
  return stamp;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function OrdersScreen() {
  const theme = useTheme();
  const { colors, palette } = theme;
  const styles = useThemedStyles(createStyles);

  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const restaurant = useRestaurant();

  // selectedModule holds the raw business-type key (PARLOUR / PHARMACY / …).
  const moduleKey = (selectedModule || '').toUpperCase();
  const activeModule =
    moduleKey === 'RESTAURANT' ? restaurant : moduleKey === 'PHARMACY' ? pharmacy : parlour;

  const [dateFilter, setDateFilter]   = useState<DatePresetId>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch]           = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rows, setRows]               = useState<OrderRow[]>([]);
  const [refreshing, setRefreshing]   = useState(false);

  const pageRef        = useRef(1);
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

  // Reload page 1 whenever the module or any filter changes.
  useEffect(() => {
    pageRef.current = 1;
    activeModule.loadOrders(1, PAGE_SIZE, listOpts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey, listOpts]);

  // Chip counts follow the date window only — independent of the selected
  // status and the search text, so they describe the whole window.
  useEffect(() => {
    activeModule.loadOrderSummary?.(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey, range]);

  // The hook replaces `orders` per page: page 1 resets, later pages append.
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
  const subtitle = summary ? `${summary.total} total` : `${rows.length} shown`;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/* Title */}
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {/* Search + filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={17} color={palette.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by customer or #..."
            placeholderTextColor={palette.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <X size={16} color={palette.muted} />
            </Pressable>
          )}
        </View>
        <Pressable style={styles.filterBtn} android_ripple={{ color: palette.divider }}>
          <SlidersHorizontal size={19} color={palette.muted} />
        </Pressable>
      </View>

      {/* Date presets */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.dateChipRow}
        keyboardShouldPersistTaps="handled"
      >
        {DATE_PRESETS.map(p => {
          const active = dateFilter === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setDateFilter(p.id)}
              android_ripple={{ color: palette.divider }}
              style={[styles.dateChip, active && { backgroundColor: colors.softBg, borderColor: colors.primary }]}
            >
              <Text style={[styles.dateChipLabel, active && styles.chipLabelActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Status chips with counts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.statusChipRow}
        keyboardShouldPersistTaps="handled"
      >
        {statusChips.map(c => {
          const active = statusFilter === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setStatusFilter(c.id)}
              android_ripple={{ color: palette.divider }}
              style={[styles.statusChip, active && { backgroundColor: colors.softBg, borderColor: colors.primary }]}
            >
              <Text style={[styles.statusChipLabel, active && styles.chipLabelActive]}>{c.label}</Text>
              {c.count != null && (
                <Text style={[styles.statusChipCount, active && styles.chipLabelActive]}>{c.count}</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* List */}
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
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>
                {section.data.length} order{section.data.length === 1 ? '' : 's'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const pair = theme.avatar.forName(item.customerName);
            const st = theme.status[item.status] ?? theme.status.FALLBACK;
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                android_ripple={{ color: palette.divider }}
              >
                <View style={[styles.avatar, { backgroundColor: pair.bg + '26' }]}>
                  <Text style={[styles.avatarText, { color: pair.bg }]}>
                    {initialsOf(item.customerName)}
                  </Text>
                </View>

                <View style={styles.cardMid}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.customerName}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item.orderNumber}{item.when ? ` · ${timeOf(item.when)}` : ''}
                  </Text>
                </View>

                <View style={styles.cardRight}>
                  <Text style={styles.cardAmount}>{formatAmount(item.amount)}</Text>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.badgeText, { color: st.text }]}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Text>
                  </View>
                </View>
              </Pressable>
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

      <FAB onPress={() => { /* TODO: navigate to order create */ }} />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex:            1,
      backgroundColor: theme.palette.background,
    },

    // Title
    titleBlock: {
      paddingHorizontal: 16,
      paddingTop:        12,
      gap:               4,
    },
    title: {
      fontSize:   27,
      fontWeight: '700',
      color:      theme.palette.onBackground,
    },
    subtitle: {
      fontSize: 13,
      color:    theme.palette.muted,
    },

    // Search
    searchRow: {
      flexDirection:     'row',
      alignItems:        'center',
      gap:               10,
      paddingHorizontal: 16,
      marginTop:         18,
    },
    searchBox: {
      flex:              1,
      height:            46,
      flexDirection:     'row',
      alignItems:        'center',
      gap:               10,
      paddingHorizontal: 14,
      borderRadius:      12,
      borderWidth:       1,
      backgroundColor:   theme.palette.surface,
      borderColor:       theme.palette.divider,
    },
    searchInput: {
      flex:     1,
      fontSize: 14,
      color:    theme.palette.onBackground,
      padding:  0,
    },
    filterBtn: {
      width:           46,
      height:          46,
      alignItems:      'center',
      justifyContent:  'center',
      borderRadius:    12,
      borderWidth:     1,
      backgroundColor: theme.palette.surface,
      borderColor:     theme.palette.divider,
    },

    // Chips
    chipScroll: {
      flexGrow:  0,
      marginTop: 18,
    },
    dateChipRow: {
      paddingHorizontal: 16,
      gap:               6,
      alignItems:        'center',
    },
    statusChipRow: {
      paddingHorizontal: 16,
      gap:               8,
      alignItems:        'center',
    },
    dateChip: {
      paddingHorizontal: 12,
      paddingVertical:   6,
      borderRadius:      999,
      borderWidth:       1,
      backgroundColor:   theme.palette.surface,
      borderColor:       theme.palette.divider,
    },
    dateChipLabel: {
      fontSize:   12,
      fontWeight: '500',
      color:      theme.palette.muted,
    },
    statusChip: {
      flexDirection:     'row',
      alignItems:        'center',
      gap:               6,
      paddingHorizontal: 13,
      paddingVertical:   7,
      borderRadius:      999,
      borderWidth:       1,
      backgroundColor:   theme.palette.surface,
      borderColor:       theme.palette.divider,
    },
    statusChipLabel: {
      fontSize:   13,
      fontWeight: '500',
      color:      theme.palette.muted,
    },
    statusChipCount: {
      fontSize:   12,
      fontWeight: '700',
      color:      theme.palette.muted,
    },
    chipLabelActive: {
      color:      theme.colors.primary,
      fontWeight: '600',
    },

    // List
    list: {
      paddingTop:    2,
      paddingBottom: 100,
    },
    sectionHeader: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: 18,
      paddingTop:        16,
      paddingBottom:     6,
      backgroundColor:   theme.palette.background,
    },
    sectionTitle: {
      fontSize:      11,
      fontWeight:    '600',
      letterSpacing: 1,
      color:         theme.palette.muted,
    },
    sectionCount: {
      fontSize:   11,
      fontWeight: '500',
      color:      theme.palette.muted,
    },

    // Card
    card: {
      flexDirection:     'row',
      alignItems:        'center',
      gap:               13,
      marginHorizontal:  16,
      marginBottom:      10,
      paddingHorizontal: 14,
      paddingVertical:   13,
      borderRadius:      16,
      borderWidth:       1,
      backgroundColor:   theme.palette.surface,
      borderColor:       theme.palette.divider,
    },
    cardPressed: {
      opacity: 0.7,
    },
    avatar: {
      width:          44,
      height:         44,
      borderRadius:   12,
      alignItems:     'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize:   14,
      fontWeight: '600',
    },
    cardMid: {
      flex: 1,
      gap:  4,
    },
    cardName: {
      fontSize:   15,
      fontWeight: '600',
      color:      theme.palette.onBackground,
    },
    cardMeta: {
      fontSize: 12,
      color:    theme.palette.muted,
    },
    cardRight: {
      alignItems: 'flex-end',
      gap:        6,
    },
    cardAmount: {
      fontSize:   16,
      fontWeight: '700',
      color:      theme.palette.onBackground,
    },
    badge: {
      paddingHorizontal: 9,
      paddingVertical:   3,
      borderRadius:      999,
    },
    badgeText: {
      fontSize:      10,
      fontWeight:    '700',
      letterSpacing: 0.3,
    },

    // States
    center: {
      flex:           1,
      alignItems:     'center',
      justifyContent: 'center',
    },
    footer: {
      paddingVertical: 16,
    },
  });
}
