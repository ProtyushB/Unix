import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  BadgeCheck,
  Ban,
  Calendar,
  Check,
  CircleCheck,
  CircleDot,
  CircleX,
  Package,
  Phone,
  Plus,
  RotateCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react-native';

import { FAB } from '../../components/layout/FAB';
import { CollapsingHeader, AnimatedSectionList } from '../../components/layout/CollapsingHeader';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useCollapsingHeader } from '../../hooks/useCollapsingHeader';
import { useToast } from '../../hooks/useToast';
import { headerCollapses, type OrdersView } from './order.view';
import type { AppTheme } from '../../theme/theme.types';
import { formatCurrency } from '../../utils/formatters';
import { DATE_PRESETS, rangeForPreset, toYmd, type DatePresetId } from '../../utils/dateRange';

import { useAppContext } from '../../context/AppContext';
import { useParlour } from '../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../backend/modules/pharmacy/hook/usePharmacy';
import type { OrderListOptions } from '../../backend/modules/shared/hook/useModuleService';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

/**
 * Gap between the collapsing header and the first row — see the note by `sectionHeaderFirst`.
 * Lives on the header (`gapBelow`), not in the list's content padding, so it cannot scroll away.
 */
const LIST_TOP_PAD = 12;
/** FAB clearance, so the last card is never trapped under it. */
const LIST_BOTTOM_PAD = 100;

const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

const STATUS_ORDER = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
] as const;

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};

/** Statuses offered in the filter sheet (2×2 grid), per the mockup. */
const FILTER_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

/** Shown (without counts) when the active module has no summary endpoint. */
const FALLBACK_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED'];

/**
 * Quick Actions rows. The order's *current* status is filtered out at render time — offering
 * "Confirmed" on an already-confirmed order is meaningless. Orders carry no transition rules
 * (any status is reachable from any other), so this is purely a UI nicety.
 */
const QUICK_STATUSES: {
  status: string;
  label: string;
  sub?: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  /**
   * Palette role for the ICON, taken from the mockup. Deliberately independent of `danger`, which
   * tints the LABEL: the mockup draws "Rejected" with a red icon but primary-coloured text, and
   * only "Cancel order" turns its text red.
   */
  tint: 'success' | 'warning' | 'info' | 'error' | 'muted';
  danger?: boolean;
}[] = [
  { status: 'CONFIRMED', label: 'Confirmed', icon: BadgeCheck, tint: 'warning' },
  { status: 'PROCESSING', label: 'Processing', icon: CircleDot, tint: 'info' },
  {
    status: 'COMPLETED',
    label: 'Mark as completed',
    icon: CircleCheck,
    tint: 'success',
    sub: 'Also marks all items delivered',
  },
  { status: 'REJECTED', label: 'Rejected', icon: Ban, tint: 'error' },
  { status: 'CANCELLED', label: 'Cancel order', icon: CircleX, tint: 'error', danger: true },
];

// ─── Row mapping ─────────────────────────────────────────────────────────────
// The list endpoint returns raw backend DTOs — field names mirror the owner
// portal (note `orderStatus` / `orderDate`, NOT `status` / `date`).

interface OrderRow {
  id: number;
  customerName: string;
  orderNumber: string;
  amount: number;
  status: string;
  when: string | null;
  phone?: string;
  email?: string;
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
    phone: raw?.customerPhoneNumber || undefined,
    email: raw?.customerEmail || undefined,
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

// ─── Filter model ────────────────────────────────────────────────────────────
// ONE shared filter drives both the inline chip rows and the sheet: opening the
// sheet shows whatever is currently applied. `fromSheet` only decides which
// control is *rendered* (inline rows vs the applied-filters summary) — per the
// mockup, applying from the sheet collapses the rows into removable chips.

type DateSel = DatePresetId | 'CUSTOM';

interface OrderFilters {
  statuses: string[]; // empty = all
  date: DateSel;
  from?: string; // YYYY-MM-DD, only when date === 'CUSTOM'
  to?: string;
}

const NO_FILTERS: OrderFilters = { statuses: [], date: 'ALL' };

function rangeOf(f: OrderFilters): { fromDate?: string; toDate?: string } {
  if (f.date === 'CUSTOM') {
    return { ...(f.from ? { fromDate: f.from } : {}), ...(f.to ? { toDate: f.to } : {}) };
  }
  return rangeForPreset(f.date);
}

function isActive(f: OrderFilters): boolean {
  return f.statuses.length > 0 || f.date !== 'ALL';
}

function dateChipLabel(f: OrderFilters): string | null {
  if (f.date === 'ALL') return null;
  if (f.date === 'CUSTOM') return `${f.from ?? '…'} → ${f.to ?? '…'}`;
  return DATE_PRESETS.find((p) => p.id === f.date)?.label ?? null;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function OrdersScreen() {
  const theme = useTheme();
  const { colors, palette } = theme;
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();

  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();

  // selectedModule holds the raw business-type key (PARLOUR / PHARMACY / …).
  const moduleKey = (selectedModule || '').toUpperCase();
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;

  const [mode, setMode] = useState<'browse' | 'search'>('browse');
  const [filters, setFilters] = useState<OrderFilters>(NO_FILTERS);
  const [fromSheet, setFromSheet] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const [sheet, setSheet] = useState<null | 'filter' | 'actions'>(null);
  const [activeOrder, setActiveOrder] = useState<OrderRow | null>(null);
  // Cancel-blocked is a toast, not a dialog — see the mockup and the note in changeStatus.
  const [dialog, setDialog] = useState<null | 'cancelConfirm'>(null);

  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);

  // Debounce search → server round-trip.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const range = useMemo(() => rangeOf(filters), [filters]);

  const listOpts = useMemo<OrderListOptions>(
    () => ({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(filters.statuses.length ? { status: filters.statuses.join(',') } : {}),
      ...range,
    }),
    [debouncedSearch, filters.statuses, range],
  );

  const reload = useCallback(() => {
    pageRef.current = 1;
    activeModule.loadOrders(1, PAGE_SIZE, listOpts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listOpts, moduleKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Chip counts follow the date window only — independent of the selected
  // statuses and the search text, so they describe the whole window.
  useEffect(() => {
    activeModule.loadOrderSummary?.(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey, range]);

  // The hook replaces `orders` per page: page 1 resets, later pages append.
  useEffect(() => {
    const mapped = (activeModule.orders as any[]).map(toOrderRow);
    setRows((prev) => (pageRef.current <= 1 ? mapped : [...prev, ...mapped]));
    loadingMoreRef.current = false;
  }, [activeModule.orders]);

  /**
   * "The first load has finished" — the gate between LOADING and EMPTY/MAIN.
   *
   * It must track the loading true → false *transition*, not the flag itself:
   * `loading` is false on the very first render (before loadOrders flips it), so a
   * plain `if (!loading) setLoadedOnce(true)` marks the screen loaded before any
   * request exists and flashes EMPTY instead of the skeleton. A finished-but-failed
   * load still counts as loaded, so the Error state can take over.
   */
  const sawLoadingRef = useRef(false);
  useEffect(() => {
    if (activeModule.loading) {
      sawLoadingRef.current = true;
    } else if (sawLoadingRef.current) {
      sawLoadingRef.current = false;
      setLoadedOnce(true);
    }
  }, [activeModule.loading]);

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

  /**
   * "14 ORDERS" for the filtered list. The list response carries totalPages but no totalElements,
   * so the exact count comes from the summary (which is already scoped to the same date window):
   * sum the selected statuses, or take the window total when no status is selected. With a search
   * term the summary can't describe the result set, so fall back to "N+" once past page one.
   */
  const filteredCount = useMemo<string>(() => {
    const paged = (activeModule.ordersTotalPages || 1) > 1;
    if (!debouncedSearch && summary) {
      const n = filters.statuses.length
        ? filters.statuses.reduce((acc, s) => acc + (summary.byStatus?.[s] ?? 0), 0)
        : summary.total;
      return `${n} ORDER${n === 1 ? '' : 'S'}`;
    }
    return `${rows.length}${paged ? '+' : ''} ORDER${rows.length === 1 && !paged ? '' : 'S'}`;
  }, [debouncedSearch, summary, filters.statuses, rows.length, activeModule.ordersTotalPages]);

  const errored = !!activeModule.error && rows.length === 0 && loadedOnce;
  const searching = mode === 'search';

  type View = OrdersView;

  /**
   * `EMPTY` is the onboarding state — this business has no orders at all. When a
   * filter is what emptied the list, that copy would be a lie ("No orders yet" on a
   * business with 51 orders) and, worse, the empty state hides the filter controls,
   * leaving no way to undo the filter. So a filtered-empty result keeps the controls
   * on screen and says so instead.
   */
  const view: View = errored
    ? 'ERROR'
    : searching
      ? rows.length
        ? 'SEARCH'
        : debouncedSearch && loadedOnce
          ? 'NO_RESULTS'
          : 'SEARCH'
      : !loadedOnce
        ? 'LOADING'
        : rows.length === 0
          ? isActive(filters)
            ? 'FILTERED_EMPTY'
            : 'EMPTY'
          : fromSheet
            ? 'FILTERED'
            : 'MAIN';

  const showFab =
    view === 'MAIN' || view === 'FILTERED' || view === 'LOADING' || view === 'FILTERED_EMPTY';

  // ─── Actions ──────────────────────────────────────────────────────────────

  const applyFilters = useCallback((next: OrderFilters) => {
    setFilters(next);
    setFromSheet(isActive(next));
    setSheet(null);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(NO_FILTERS);
    setFromSheet(false);
  }, []);

  const removeStatus = useCallback((s: string) => {
    setFilters((prev) => {
      const next = { ...prev, statuses: prev.statuses.filter((x) => x !== s) };
      setFromSheet(isActive(next));
      return next;
    });
  }, []);

  const removeDate = useCallback(() => {
    setFilters((prev) => {
      const next: OrderFilters = { ...prev, date: 'ALL', from: undefined, to: undefined };
      setFromSheet(isActive(next));
      return next;
    });
  }, []);

  /** Inline chips write the same filter object — tapping one leaves "sheet mode". */
  const setInlineDate = useCallback((d: DatePresetId) => {
    setFilters((prev) => ({ ...prev, date: d, from: undefined, to: undefined }));
    setFromSheet(false);
  }, []);

  const setInlineStatus = useCallback((id: string) => {
    setFilters((prev) => ({ ...prev, statuses: id === 'ALL' ? [] : [id] }));
    setFromSheet(false);
  }, []);

  const changeStatus = useCallback(
    async (order: OrderRow, status: string) => {
      const res = await activeModule.updateOrderStatus?.(order.id, status);
      if (res?.success) {
        setSheet(null);
        setActiveOrder(null);
        setDialog(null);
        reload();
        return;
      }
      // Dismiss the sheet and dialog BEFORE reporting. The action was refused, so leaving the
      // sheet up just invites a retry loop against a lock that will not clear from here.
      setSheet(null);
      setActiveOrder(null);
      setDialog(null);

      // Title follows the action the user actually took — a failed "Processing" must not
      // say "Couldn't cancel order".
      const cancelling = status === 'CANCELLED';

      // A finalized bill freezes the order's status — that reason is worth showing verbatim.
      // Anything else gets a friendly line: raw server text ("No static resource …") is noise.
      showToast(
        (res as any)?.code === 'ORDER_LOCKED'
          ? `This order has a finalized bill. Void the bill before it can be ${cancelling ? 'cancelled' : 'updated'}.`
          : 'Something went wrong while updating this order. Please try again.',
        'error',
        {
          title: cancelling ? "Couldn't cancel order" : "Couldn't update order",
          // Longer than the 3500ms default: the bill-lock message runs to two lines and tells
          // the user to go do something else first.
          duration: 5000,
        },
      );
    },
    [activeModule, reload, showToast],
  );

  const contactCustomer = useCallback((order: OrderRow) => {
    const target = order.phone
      ? `tel:${order.phone}`
      : order.email
        ? `mailto:${order.email}`
        : null;
    if (target) Linking.openURL(target).catch(() => {});
  }, []);

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderRow = useCallback(
    (item: OrderRow) => {
      const pair = theme.avatar.forName(item.customerName);
      const st = theme.status[item.status] ?? theme.status.FALLBACK;
      return (
        <Pressable
          onPress={() => {
            setActiveOrder(item);
            setSheet('actions');
          }}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          android_ripple={{ color: palette.divider }}
        >
          <View style={[styles.avatar, { backgroundColor: pair.bg + '26' }]}>
            <Text style={[styles.avatarText, { color: pair.bg }]}>
              {initialsOf(item.customerName)}
            </Text>
          </View>

          <View style={styles.cardMid}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.customerName}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.orderNumber}
              {item.when ? ` · ${timeOf(item.when)}` : ''}
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
    },
    [theme, styles, palette.divider],
  );

  const { headerProps, listProps, headerHeight } = useCollapsingHeader({
    pinned: !headerCollapses(view),
    refreshing,
    contentBottomPadding: LIST_BOTTOM_PAD,
  });
  const bodyInset = useMemo(() => ({ paddingTop: headerHeight }), [headerHeight]);

  // Pagination is `onEndReached` alone — the list keeps refilling itself as you scroll, with no
  // manual step. The mockup briefly carried a "Load older orders" pill here, but auto-load always
  // won the race to the footer (onEndReachedThreshold fires well before it scrolls into view), so
  // the button was unreachable in practice. It was dropped from the design rather than kept as
  // dead furniture.

  const list = (
    <AnimatedSectionList
      {...listProps}
      sections={sections}
      keyExtractor={(item: OrderRow) => String(item.id)}
      // Explicit, and load-bearing: the default is true on iOS, which would pin these opaque
      // headers at scroll-view y=0 — behind the overlay header — then pop them into view the
      // moment it collapses. The mockup shows them inline mid-list.
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }: { section: (typeof sections)[number] }) =>
        view === 'SEARCH' || view === 'FILTERED' ? null : (
          // The first header drops its top padding. That padding exists to separate
          // one day group from the previous one, and above the first group there is
          // no previous group — only the filter chips, whose spacing is owned by
          // list.paddingTop. Leaving it on stacked the two and pushed the list
          // 24px below the chips while every other gap in the header was 8.
          <View
            style={[styles.sectionHeader, section === sections[0] && styles.sectionHeaderFirst]}
          >
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>
              {section.data.length} order{section.data.length === 1 ? '' : 's'}
            </Text>
          </View>
        )
      }
      renderItem={({ item }: { item: OrderRow }) => renderRow(item)}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
          // Or the spinner turns behind the opaque header instead of below it.
          progressViewOffset={headerHeight}
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
  );

  // ─── Body per state ───────────────────────────────────────────────────────

  let body: React.ReactNode;
  if (view === 'LOADING') {
    body = (
      <View style={bodyInset}>
        <View style={styles.chipRowStatic}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skelChip} />
          ))}
        </View>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonRow key={i} styles={styles} />
        ))}
      </View>
    );
  } else if (view === 'ERROR') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<CircleX size={40} color={palette.muted} />}
        headline="Couldn't load orders"
        subtext="Something went wrong while loading. Check your connection and try again."
        ctaLabel="Retry"
        ctaIcon={<RotateCw size={18} color="#ffffff" />}
        onCta={reload}
      />
    );
  } else if (view === 'EMPTY') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<Package size={40} color={palette.muted} />}
        headline="No orders yet"
        subtext="New orders from customers will appear here as they come in."
        ctaLabel="Create Order"
        ctaIcon={<Plus size={18} color="#ffffff" />}
        onCta={() => {
          /* TODO: navigate to order create */
        }}
      />
    );
  } else if (view === 'NO_RESULTS') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<Search size={40} color={palette.muted} />}
        headline="No orders found"
        subtext={`No orders match '${debouncedSearch}'. Try a different name or order number.`}
      />
    );
  } else if (view === 'FILTERED_EMPTY') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<SlidersHorizontal size={40} color={palette.muted} />}
        headline="No orders match these filters"
        subtext="Nothing here for the selected status or date. Try widening the range."
        ctaLabel="Clear filters"
        ctaIcon={<X size={18} color="#ffffff" />}
        onCta={clearFilters}
      />
    );
  } else {
    body = list;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  // Overlay, rendered AFTER the body so Android's paint order agrees with its zIndex. It
  // translates off-screen on a downward scroll and back on an upward one; see CollapsingHeader
  // for why it is absolute rather than laid out above the list.
  const header = (
    <CollapsingHeader {...headerProps} backgroundColor={palette.background} gapBelow={LIST_TOP_PAD}>
      {searching ? (
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, styles.searchBoxFocused]}>
            <Search size={18} color={palette.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by customer or #..."
              placeholderTextColor={palette.muted}
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
            />
            {!!search && (
              <Pressable onPress={() => setSearch('')} hitSlop={10}>
                <X size={18} color={palette.muted} />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => {
              setMode('browse');
              setSearch('');
            }}
            hitSlop={8}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Orders</Text>
            {/* A space, not null, while loading: the count is genuinely unknown until the
                first page lands, and rendering "0 orders" over a screenful of skeletons
                states something false. Keeping a blank line reserves the height so the
                search row does not jump down when the real count arrives. */}
            <Text style={styles.subtitle}>
              {view === 'LOADING'
                ? ' '
                : summary
                  ? `${summary.total} total`
                  : `${rows.length} orders`}
            </Text>
          </View>

          {view !== 'EMPTY' && view !== 'ERROR' && (
            <View style={styles.searchRow}>
              <Pressable style={styles.searchBox} onPress={() => setMode('search')}>
                <Search size={17} color={palette.muted} />
                <Text style={styles.searchPlaceholder}>Search by customer or #...</Text>
              </Pressable>
              <Pressable
                style={styles.filterBtn}
                onPress={() => setSheet('filter')}
                android_ripple={{ color: palette.divider }}
              >
                <SlidersHorizontal size={19} color={palette.muted} />
              </Pressable>
            </View>
          )}
        </>
      )}

      {/* Filter controls — inline chip rows, or the applied-filters summary */}
      {/* Filter controls stay on screen for FILTERED_EMPTY — they are the only way out of it. */}
      {!searching &&
        view !== 'EMPTY' &&
        view !== 'ERROR' &&
        view !== 'LOADING' &&
        (fromSheet ? (
          <View style={styles.appliedRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.appliedChips}
            >
              {filters.statuses.map((s) => (
                <Pressable key={s} style={styles.appliedChip} onPress={() => removeStatus(s)}>
                  <Text style={styles.appliedChipText}>{STATUS_LABEL[s] ?? s}</Text>
                  <X size={13} color={colors.primary} />
                </Pressable>
              ))}
              {dateChipLabel(filters) && (
                <Pressable style={styles.appliedChip} onPress={removeDate}>
                  <Text style={styles.appliedChipText}>{dateChipLabel(filters)}</Text>
                  <X size={13} color={colors.primary} />
                </Pressable>
              )}
            </ScrollView>
            <Pressable onPress={clearFilters} hitSlop={8}>
              <Text style={styles.clearAll}>Clear all</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.dateChipRow}
              keyboardShouldPersistTaps="handled"
            >
              {DATE_PRESETS.map((p) => {
                const active = filters.date === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setInlineDate(p.id)}
                    android_ripple={{ color: palette.divider }}
                    style={[
                      styles.dateChip,
                      active && { backgroundColor: colors.softBg, borderColor: colors.primary },
                    ]}
                  >
                    <Text style={[styles.dateChipLabel, active && styles.chipLabelActive]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScrollTight}
              contentContainerStyle={styles.statusChipRow}
              keyboardShouldPersistTaps="handled"
            >
              {statusChips.map((c) => {
                const active =
                  c.id === 'ALL' ? filters.statuses.length === 0 : filters.statuses.includes(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setInlineStatus(c.id)}
                    android_ripple={{ color: palette.divider }}
                    style={[
                      styles.statusChip,
                      active && { backgroundColor: colors.softBg, borderColor: colors.primary },
                    ]}
                  >
                    <Text style={[styles.statusChipLabel, active && styles.chipLabelActive]}>
                      {c.label}
                    </Text>
                    {c.count != null && (
                      <Text style={[styles.statusChipCount, active && styles.chipLabelActive]}>
                        {c.count}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ))}

      {/* Result count line.
          SEARCH additionally requires a non-empty query: opening the search box shows the
          full list until something is typed, and the line rendered "20 results for ''" —
          a result count attributed to a search nobody performed, with empty quotes. */}
      {(view === 'FILTERED' || (view === 'SEARCH' && !!debouncedSearch)) && (
        <Text style={view === 'SEARCH' ? styles.searchResultLine : styles.filterCountLine}>
          {view === 'SEARCH'
            ? `${rows.length} result${rows.length === 1 ? '' : 's'} for '${debouncedSearch}'`
            : filteredCount}
        </Text>
      )}
    </CollapsingHeader>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {body}

      {header}

      {showFab && (
        <FAB
          onPress={() => {
            /* TODO: navigate to order create */
          }}
        />
      )}

      {/*
        Each overlay is gated on its own state rather than relying on Modal's `visible` prop alone.
        react-native-web keeps a Modal's portal mounted after `visible` flips to false (its exit
        animation never completes here), which leaves stale sheets stacked on screen. Unmounting the
        Modal outright is correct on both web and native.
      */}
      {sheet === 'filter' && (
        <FilterSheet
          initial={filters}
          styles={styles}
          theme={theme}
          onClose={() => setSheet(null)}
          onApply={applyFilters}
        />
      )}

      {sheet === 'actions' && activeOrder && (
        <ActionsSheet
          order={activeOrder}
          styles={styles}
          theme={theme}
          onClose={() => {
            setSheet(null);
            setActiveOrder(null);
          }}
          onPickStatus={(s) => {
            if (s === 'CANCELLED') {
              setDialog('cancelConfirm');
              return;
            }
            changeStatus(activeOrder, s);
          }}
          onContact={() => contactCustomer(activeOrder)}
        />
      )}

      {dialog === 'cancelConfirm' && activeOrder && (
        <ConfirmDialog
          visible
          title="Cancel this order?"
          message={`Order ${activeOrder.orderNumber} · ${activeOrder.customerName} will be cancelled and all items restocked to inventory. This can't be undone.`}
          confirmLabel="Cancel order"
          cancelLabel="Keep order"
          danger
          onConfirm={() => changeStatus(activeOrder, 'CANCELLED')}
          onCancel={() => setDialog(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Skeleton row ────────────────────────────────────────────────────────────
// Shares the real card's shell style so the loading → loaded transition doesn't jump.

function SkeletonRow({ styles }: { styles: any }) {
  return (
    <View style={styles.card}>
      <View style={styles.skelAvatar} />
      <View style={styles.cardMid}>
        <View style={[styles.skelBar, { width: 120, height: 13 }]} />
        <View style={[styles.skelBar, { width: 100, height: 11 }]} />
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.skelBar, { width: 54, height: 13 }]} />
        <View style={[styles.skelBar, { width: 62, height: 16, borderRadius: 999 }]} />
      </View>
    </View>
  );
}

// ─── Hero block (empty / error / no-results) ─────────────────────────────────

function HeroBlock({
  styles,
  style,
  icon,
  headline,
  subtext,
  ctaLabel,
  ctaIcon,
  onCta,
}: {
  styles: any;
  /** Reserves the overlay header's height so the block centres in the visible region. */
  style?: StyleProp<ViewStyle>;
  icon: React.ReactNode;
  headline: string;
  subtext: string;
  ctaLabel?: string;
  ctaIcon?: React.ReactNode;
  onCta?: () => void;
}) {
  return (
    <View style={[styles.hero, style]}>
      <View style={styles.heroCircle}>{icon}</View>
      <View style={styles.heroText}>
        <Text style={styles.heroHeadline}>{headline}</Text>
        <Text style={styles.heroSub}>{subtext}</Text>
      </View>
      {ctaLabel && onCta && (
        <Pressable style={styles.heroCta} onPress={onCta}>
          {ctaIcon}
          <Text style={styles.heroCtaLabel}>{ctaLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Filter sheet ────────────────────────────────────────────────────────────

function FilterSheet({
  initial,
  styles,
  theme,
  onClose,
  onApply,
}: {
  initial: OrderFilters;
  styles: any;
  theme: AppTheme;
  onClose: () => void;
  onApply: (f: OrderFilters) => void;
}) {
  // Mounted only while open, so seeding from `initial` once is enough — the sheet
  // always opens reflecting whatever filter is currently applied.
  const [draft, setDraft] = useState<OrderFilters>(initial);
  const [picking, setPicking] = useState<null | 'from' | 'to'>(null);
  // The screen's SafeAreaView deliberately omits the bottom edge (the tab bar owns
  // it), and a Modal renders outside that view anyway — so a sheet gets no bottom
  // inset from anywhere. Without this, Android's navigation bar sliced the Apply
  // Filters button in half on a 3-button device.
  const insets = useSafeAreaInsets();

  const toggleStatus = (s: string) =>
    setDraft((d) => ({
      ...d,
      statuses: d.statuses.includes(s) ? d.statuses.filter((x) => x !== s) : [...d.statuses, s],
    }));

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetOverlay} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 28 + insets.bottom }]}>
        <View style={styles.grabberWrap}>
          <View style={styles.grabber} />
        </View>

        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Filters</Text>
          <Pressable onPress={() => setDraft(NO_FILTERS)} hitSlop={8}>
            <Text style={styles.sheetReset}>Reset</Text>
          </Pressable>
        </View>

        <View style={styles.sheetSection}>
          <Text style={styles.sheetLabel}>Order Status</Text>
          <View style={styles.pillGrid}>
            {FILTER_STATUSES.map((s) => {
              const on = draft.statuses.includes(s);
              return (
                <Pressable
                  key={s}
                  onPress={() => toggleStatus(s)}
                  style={[
                    styles.pill,
                    on && {
                      backgroundColor: theme.colors.softBg,
                      borderColor: theme.colors.primary,
                    },
                  ]}
                >
                  {on && <Check size={15} color={theme.colors.primary} />}
                  <Text
                    style={[
                      styles.pillLabel,
                      on && { color: theme.colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {STATUS_LABEL[s] ?? s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.sheetSection}>
          <Text style={styles.sheetLabel}>Date Range</Text>
          <View style={styles.presetWrap}>
            {DATE_PRESETS.map((p) => {
              const on = draft.date === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() =>
                    setDraft((d) => ({ ...d, date: p.id, from: undefined, to: undefined }))
                  }
                  style={[
                    styles.preset,
                    on && {
                      backgroundColor: theme.colors.softBg,
                      borderColor: theme.colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.presetLabel,
                      on && { color: theme.colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.customRow}>
            {(['from', 'to'] as const).map((which) => (
              <Pressable key={which} style={styles.dateField} onPress={() => setPicking(which)}>
                <Calendar size={16} color={theme.palette.muted} />
                <Text
                  style={[
                    styles.dateFieldText,
                    draft[which] && { color: theme.palette.onBackground },
                  ]}
                >
                  {draft[which] ?? (which === 'from' ? 'From' : 'To')}
                </Text>
              </Pressable>
            ))}
          </View>

          {picking && (
            <DateTimePicker
              value={draft[picking] ? new Date(draft[picking] as string) : new Date()}
              mode="date"
              onChange={(_e: unknown, d?: Date) => {
                setPicking(null);
                if (d)
                  setDraft((prev) => ({ ...prev, date: 'CUSTOM', [which(picking)]: toYmd(d) }));
              }}
            />
          )}
        </View>

        <Pressable style={styles.applyBtn} onPress={() => onApply(draft)}>
          <Text style={styles.applyLabel}>Apply Filters</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

/** Narrows the picker target to the OrderFilters key it writes. */
function which(p: 'from' | 'to'): 'from' | 'to' {
  return p;
}

// ─── Quick actions sheet ─────────────────────────────────────────────────────

function ActionsSheet({
  order,
  styles,
  theme,
  onClose,
  onPickStatus,
  onContact,
}: {
  order: OrderRow;
  styles: any;
  theme: AppTheme;
  onClose: () => void;
  onPickStatus: (status: string) => void;
  onContact: () => void;
}) {
  // Same bottom-inset problem as FilterSheet — see the note there.
  const insets = useSafeAreaInsets();
  const pair = theme.avatar.forName(order.customerName);
  const st = theme.status[order.status] ?? theme.status.FALLBACK;
  // Offering the status the order already has is meaningless — drop that row.
  const actions = QUICK_STATUSES.filter((a) => a.status !== order.status);

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetOverlay} onPress={onClose} />
      <View style={[styles.sheetTight, { paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.grabberWrap}>
          <View style={styles.grabber} />
        </View>

        <View style={styles.summaryWrap}>
          <View style={[styles.summaryAvatar, { backgroundColor: pair.bg + '26' }]}>
            <Text style={[styles.avatarText, { color: pair.bg }]}>
              {initialsOf(order.customerName)}
            </Text>
          </View>
          <View style={styles.cardMid}>
            <Text style={styles.cardName} numberOfLines={1}>
              {order.customerName}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {order.orderNumber} · {formatAmount(order.amount)}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.text }]}>
              {STATUS_LABEL[order.status] ?? order.status}
            </Text>
          </View>
        </View>

        <View style={styles.sheetDivider} />
        <Text style={styles.actionsHeader}>CHANGE STATUS</Text>

        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Pressable
              key={a.status}
              style={styles.actionRow}
              onPress={() => onPickStatus(a.status)}
              android_ripple={{ color: theme.palette.divider }}
            >
              <Icon size={19} color={theme.palette[a.tint]} />
              <View style={styles.actionMid}>
                <Text style={[styles.actionLabel, a.danger && { color: theme.palette.error }]}>
                  {a.label}
                </Text>
                {a.sub && <Text style={styles.actionSub}>{a.sub}</Text>}
              </View>
            </Pressable>
          );
        })}

        <View style={styles.sheetDivider} />

        <Pressable
          style={styles.actionRow}
          onPress={onContact}
          android_ripple={{ color: theme.palette.divider }}
        >
          <Phone size={19} color={theme.palette.muted} />
          <View style={styles.actionMid}>
            <Text style={styles.actionLabel}>Contact customer</Text>
            <Text style={styles.actionSub}>Call or email</Text>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  /**
   * Tertiary text tier. The mockup uses two greys — `#94A0B4` for secondary text
   * (subtitle, chip labels) and a dimmer `#586073` for section headers, card meta,
   * the search placeholder and chip counts. The palette only carries the first
   * (`muted`), so the dim tier is derived from it: muted at ~54% over the dark
   * background resolves to exactly #586073, and it stays theme-correct everywhere
   * else rather than hardcoding the Midnight value.
   */
  const dim = theme.palette.muted + '8A';

  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.palette.background },

    // Title
    titleBlock: { paddingHorizontal: 16, paddingTop: 12, gap: 4 },
    title: { fontSize: 27, fontWeight: '700', color: theme.palette.onBackground },
    subtitle: { fontSize: 13, color: theme.palette.muted },

    // Search
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      marginTop: 18,
    },
    searchBox: {
      flex: 1,
      height: 46,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: theme.palette.surface,
      borderColor: theme.palette.divider,
    },
    searchBoxFocused: { borderWidth: 1.5, borderColor: theme.colors.primary },
    searchInput: { flex: 1, fontSize: 15, color: theme.palette.onBackground, padding: 0 },
    searchPlaceholder: { flex: 1, fontSize: 14, color: dim },
    cancelText: { fontSize: 15, fontWeight: '500', color: theme.colors.primary },
    filterBtn: {
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: theme.palette.surface,
      borderColor: theme.palette.divider,
    },

    // Chips
    // flexShrink: 0 is load-bearing, not defensive. This header sits in a
    // height-constrained flex column, and a horizontal ScrollView is a flexible
    // child: flexGrow: 0 alone stops it expanding but still lets it be CRUSHED,
    // which is what happened — the 30px chips were squeezed into a ~8px row and
    // rendered as sliced-off text. The row must keep its content height and let
    // the order list take whatever is left.
    // Two rows, two different gaps. chipScroll separates the chip GROUP from the
    // search box above it; chipScrollTight separates the status row from the date
    // row, which belong together and read as one block. Both previously used 18,
    // so the two related rows sat as far apart as they did from a different
    // control entirely, and the whole header looked airy and loose.
    // One rhythm for the whole header stack: search → 8 → date chips → 8 → status
    // chips → 8 → list. The two styles are kept separate only because the second
    // row previously needed its own value; they are equal by intent, not accident.
    chipScroll: { flexGrow: 0, flexShrink: 0, marginTop: 8 },
    chipScrollTight: { flexGrow: 0, flexShrink: 0, marginTop: 8 },
    // marginTop matches chipScroll so the skeleton row and the real chip row sit at
    // the same y — otherwise the header nudges when the first page lands.
    chipRowStatic: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
    },
    dateChipRow: { paddingHorizontal: 16, gap: 6, alignItems: 'center' },
    statusChipRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
    dateChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: theme.palette.surface,
      borderColor: theme.palette.divider,
    },
    dateChipLabel: { fontSize: 12, fontWeight: '500', color: theme.palette.muted },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 13,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: theme.palette.surface,
      borderColor: theme.palette.divider,
    },
    statusChipLabel: { fontSize: 13, fontWeight: '500', color: theme.palette.muted },
    statusChipCount: { fontSize: 12, fontWeight: '700', color: dim },
    chipLabelActive: { color: theme.colors.primary, fontWeight: '600' },

    // Applied filters
    appliedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 16,
      marginTop: 18,
    },
    appliedChips: { gap: 8, alignItems: 'center' },
    appliedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: theme.colors.softBg,
      borderColor: theme.colors.primary,
    },
    appliedChipText: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },
    clearAll: { fontSize: 12, fontWeight: '600', color: theme.palette.muted },

    // The two count lines are styled differently in the mockup: search reads as a
    // sentence (13px medium, secondary grey), the filtered count as a section label
    // (11px semibold, 1px tracking, dim grey).
    searchResultLine: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.palette.muted,
      paddingHorizontal: 16,
      marginTop: 16,
    },
    filterCountLine: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1,
      color: dim,
      paddingHorizontal: 18,
      marginTop: 16,
    },

    // List
    // The header stack is an even 8 (search → dates → statuses); this last gap is
    // deliberately a touch wider so the chips stay grouped with the search box and
    // the list reads as the start of a new block rather than a fourth chip row.
    // Owned solely by this value — the first section header zeroes its own top
    // padding (see sectionHeaderFirst), so nothing else contributes here. It now lives as
    // LIST_TOP_PAD, carried as the header's own paddingBottom so it cannot scroll away.
    // 2, not 12, because the preceding card already contributes its own 10px
    // marginBottom — the two stack, so 2 + 10 lands on the same 12 the chips-to-list
    // gap uses. Changing the card margin will silently change this gap too.
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 2,
      paddingBottom: 6,
      backgroundColor: theme.palette.background,
    },
    sectionHeaderFirst: { paddingTop: 0 },
    sectionTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 1, color: dim },
    sectionCount: { fontSize: 11, fontWeight: '500', color: dim },

    // Card
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      marginHorizontal: 16,
      marginBottom: 10,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderRadius: 16,
      borderWidth: 1,
      backgroundColor: theme.palette.surface,
      borderColor: theme.palette.divider,
    },
    cardPressed: { opacity: 0.7 },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 14, fontWeight: '600' },
    cardMid: { flex: 1, gap: 4 },
    cardName: { fontSize: 15, fontWeight: '600', color: theme.palette.onBackground },
    cardMeta: { fontSize: 12, color: dim },
    cardRight: { alignItems: 'flex-end', gap: 6 },
    cardAmount: { fontSize: 16, fontWeight: '700', color: theme.palette.onBackground },
    badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
    badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

    // Skeleton
    skelChip: { width: 50, height: 32, borderRadius: 999, backgroundColor: theme.palette.divider },
    skelAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.palette.divider },
    skelBar: { borderRadius: 8, backgroundColor: theme.palette.divider },

    // Hero (empty / error / no results)
    hero: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 22,
      paddingHorizontal: 40,
    },
    heroCircle: {
      width: 96,
      height: 96,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    heroText: { gap: 8, alignItems: 'center' },
    heroHeadline: {
      fontSize: 19,
      fontWeight: '700',
      color: theme.palette.onBackground,
      textAlign: 'center',
    },
    heroSub: { fontSize: 13, lineHeight: 18, color: theme.palette.muted, textAlign: 'center' },
    heroCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
    },
    heroCtaLabel: { fontSize: 14, fontWeight: '600', color: '#ffffff' },

    // Sheets
    sheetOverlay: { flex: 1, backgroundColor: theme.palette.overlay ?? '#00000088' },
    sheet: {
      backgroundColor: theme.palette.surfaceElevated ?? theme.palette.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      borderColor: theme.palette.divider,
      paddingTop: 12,
      paddingHorizontal: 20,
      paddingBottom: 28,
      gap: 20,
    },
    sheetTight: {
      backgroundColor: theme.palette.surfaceElevated ?? theme.palette.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      borderColor: theme.palette.divider,
      paddingTop: 10,
      paddingBottom: 24,
      gap: 4,
    },
    grabberWrap: { alignItems: 'center', paddingBottom: 6 },
    grabber: { width: 40, height: 4, borderRadius: 999, backgroundColor: theme.palette.divider },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sheetTitle: { fontSize: 17, fontWeight: '700', color: theme.palette.onBackground },
    sheetReset: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
    sheetSection: { gap: 12 },
    sheetLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3, color: theme.palette.muted },

    pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    pill: {
      flexGrow: 1,
      flexBasis: '45%',
      height: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: theme.palette.surface,
      borderColor: theme.palette.divider,
    },
    pillLabel: { fontSize: 13, fontWeight: '500', color: theme.palette.muted },

    presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    preset: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: theme.palette.surface,
      borderColor: theme.palette.divider,
    },
    presetLabel: { fontSize: 13, fontWeight: '500', color: theme.palette.muted },

    customRow: { flexDirection: 'row', gap: 10 },
    dateField: {
      flex: 1,
      height: 46,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: theme.palette.surface,
      borderColor: theme.palette.divider,
    },
    dateFieldText: { flex: 1, fontSize: 14, color: theme.palette.muted },

    applyBtn: {
      height: 50,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    applyLabel: { fontSize: 15, fontWeight: '700', color: '#ffffff' },

    // Actions sheet
    summaryWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    summaryAvatar: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetDivider: { height: 1, backgroundColor: theme.palette.divider },
    actionsHeader: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: theme.palette.muted,
      paddingHorizontal: 22,
      paddingTop: 10,
      paddingBottom: 4,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 22,
      paddingVertical: 14,
    },
    actionMid: { flex: 1, gap: 2 },
    actionLabel: { fontSize: 15, fontWeight: '500', color: theme.palette.onBackground },
    actionSub: { fontSize: 12, color: theme.palette.muted },

    footer: { paddingVertical: 16 },
  });
}
