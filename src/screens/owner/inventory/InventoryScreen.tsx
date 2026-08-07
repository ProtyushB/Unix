import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  Boxes,
  Calendar,
  CircleX,
  FileText,
  Leaf,
  Lock,
  Package,
  Plus,
  RotateCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react-native';

import { FAB } from '../../../components/layout/FAB';
import { CollapsingHeader, AnimatedFlatList } from '../../../components/layout/CollapsingHeader';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { useTheme } from '../../../hooks/useTheme';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { useCollapsingHeader } from '../../../hooks/useCollapsingHeader';
import { useToast } from '../../../hooks/useToast';
import { useIsTabEnabled } from '../../../backend/tab-config';
import { useAppContext } from '../../../context/AppContext';
import { useParlour } from '../../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../../backend/modules/pharmacy/hook/usePharmacy';
import { getSelectedBusinessId } from '../../../backend/modules/shared/hook/useModuleService';
import type {
  InventoryStatus,
  InventoryStatusCounts,
} from '../../../backend/modules/shared/inventory.types';
import { INVENTORY_STATUSES } from '../../../backend/modules/shared/inventory.types';
import type { AppTheme } from '../../../theme/theme.types';
import { listSubtitle, toBatchRow, type BatchDto, type BatchRow } from './batch.model';
import {
  DEFAULT_FILTERS,
  appliedFilterChips,
  deriveInventoryView,
  hasActiveFilters,
  headerCollapses,
  quickActionsFor,
  showsFab,
  statusLabel,
  toQuery,
  type ExpiryFilter,
  type InventoryFilters,
} from './batch.view';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const LIST_BOTTOM_PAD = 100;

/**
 * The design's spacing scale for this screen, lifted from the mockup rather than inherited from
 * the Orders template.
 *
 * `SECTION_GAP` is the Content column's gap — title / search / filters / list all sit 18 apart.
 * `FILTER_GAP` is the tighter 12 INSIDE the filters block, which is what visually binds the type
 * toggle to its status chips instead of leaving three equally-spaced strips.
 */
const SECTION_GAP = 18;
const FILTER_GAP = 12;
const CARD_GAP = 12;
const LIST_TOP_PAD = SECTION_GAP;

/**
 * The screen's side gutter — the design's Content column is inset 16 on both edges.
 *
 * Applied PER ELEMENT rather than on a wrapper, which is the convention every sibling list screen
 * follows and is not arbitrary: the chip rows are horizontal ScrollViews, so their 16 belongs on
 * the contentContainerStyle. Put it on a container and the chips stop 16 short of the edge instead
 * of scrolling under it.
 */
const SIDE_PAD = 16;

interface InventoryScreenProps {
  /** Optional so the screen can also be mounted standalone in the web preview. */
  navigation?: {
    navigate?: (screen: string, params?: Record<string, unknown>) => void;
    addListener?: (event: string, cb: () => void) => (() => void) | undefined;
  };
}

/**
 * Inventory — the batch list.
 *
 * Same shape as `OrdersScreen`: collapsing header, chip rows, a filter sheet, a long-press actions
 * sheet and a FAB. Every decision it makes — which view, which actions, what the filters mean —
 * lives in `batch.view.ts` / `batch.model.ts`, which are `.ts` and therefore covered by jest.
 *
 * Filtering, sorting, searching and paging are ALL server-side. Nothing here narrows a loaded page
 * client-side: with infinite scroll that would filter only what happens to be loaded, so the list
 * would grow as you scrolled and never be authoritative. Centrix removed exactly that.
 */
export function InventoryScreen({ navigation }: InventoryScreenProps = {}) {
  const theme = useTheme();
  const { colors, palette } = theme;
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const moduleKey = (selectedModule || '').toUpperCase();
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;

  /**
   * Read unconditionally, never behind `&&`.
   *
   * A hook behind a condition changes hook ORDER the moment the flag flips, which crashes React.
   * Wastage gates Dispose only — it is a different tab from Inventory, and Inventory-on with
   * Wastage-off is a legal configuration.
   */
  const wastageEnabled = useIsTabEnabled('WASTAGE');

  const [businessId, setBusinessId] = useState<number | null>(null);
  const [mode, setMode] = useState<'browse' | 'search'>('browse');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<InventoryFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<InventoryFilters>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [counts, setCounts] = useState<InventoryStatusCounts | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  /** The pool the toggle is NOT on, so its half can show a count too. */
  const [otherPoolTotal, setOtherPoolTotal] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  // Every sheet is gated on STATE, never on a Modal's `visible` prop: on react-native-web a
  // dismissed Modal's portal stays mounted and swallows taps meant for the screen beneath it.
  const [sheet, setSheet] = useState<null | 'filter' | 'actions' | 'status'>(null);
  const [activeBatch, setActiveBatch] = useState<BatchDto | null>(null);
  const [dialog, setDialog] = useState<null | 'delete' | 'dispose'>(null);

  const [transitions, setTransitions] = useState<InventoryStatus[] | null>(null);
  const [transitionsError, setTransitionsError] = useState(false);

  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let alive = true;
    void getSelectedBusinessId().then((id) => {
      if (alive) setBusinessId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  /**
   * The one query object.
   *
   * Page 2 MUST ride the same filters as page 1 — the server filters and sorts, so a page fetched
   * under a different query is not the continuation of the previous one and the rows interleave.
   */
  const query = useMemo(
    () => ({ ...toQuery(filters), search: debouncedSearch || null }),
    [filters, debouncedSearch],
  );

  const load = useCallback(
    (page: number, append: boolean) => {
      if (businessId == null) return;
      pageRef.current = page;
      void activeModule.loadInventoryByBusiness(businessId, query, page, PAGE_SIZE, append);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [businessId, query, moduleKey],
  );

  const reload = useCallback(() => load(1, false), [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  /**
   * Chip counts, fetched alongside the list.
   *
   * They deliberately IGNORE the selected status — the endpoint groups by it — so every chip shows
   * its own total rather than "the one you picked, and zero for everything else".
   */
  const refreshCounts = useCallback(() => {
    if (businessId == null) return;
    type CountsRes = { success: boolean; data?: unknown; totalElements?: number };

    // The ACTIVE pool: drives the status chips and its own toggle count.
    void activeModule.getInventoryStatusCounts(businessId, query).then((res: CountsRes) => {
      if (!res?.success) return;
      setCounts((res.data as InventoryStatusCounts) ?? null);
      setTotal(typeof res.totalElements === 'number' ? res.totalElements : null);
    });

    // The OTHER pool, for the toggle's other half. A second call rather than one unfiltered one,
    // because the toggle needs the two totals SEPARATELY and an unscoped total cannot be split.
    // Both are indexed counts against a single business.
    const otherType =
      query.inventoryType === 'RAW_INVENTORY' ? 'PRODUCT_INVENTORY' : 'RAW_INVENTORY';
    void activeModule
      .getInventoryStatusCounts(businessId, { ...query, inventoryType: otherType })
      .then((res: CountsRes) => {
        if (!res?.success) return;
        setOtherPoolTotal(typeof res.totalElements === 'number' ? res.totalElements : null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, query, moduleKey]);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  // Refetch on RETURN from the detail screen. Skips the FIRST focus — the effects above already
  // fetched on mount, and firing both races two identical requests.
  const hasFocusedRef = useRef(false);
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        return;
      }
      reload();
      refreshCounts();
    });
    return unsubscribe;
  }, [navigation, reload, refreshCounts]);

  const baseUnit = 'unit';
  useEffect(() => {
    const mapped = (activeModule.inventory as BatchDto[]).map((b) => toBatchRow(b, baseUnit));
    setRows(mapped);
    loadingMoreRef.current = false;
  }, [activeModule.inventory]);

  /**
   * "The first load has finished" — the gate between LOADING and EMPTY.
   *
   * Tracks the loading true → false TRANSITION, not the flag: `loading` is false on the very first
   * render, so a plain `!loading` marks the screen loaded before any request exists and flashes the
   * empty hero at someone who has 128 batches.
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
    if (pageRef.current >= (activeModule.inventoryTotalPages || 1)) return;
    loadingMoreRef.current = true;
    load(pageRef.current + 1, true);
  }, [activeModule.loading, activeModule.inventoryTotalPages, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    reload();
    refreshCounts();
    setRefreshing(false);
  }, [reload, refreshCounts]);

  const filtered = hasActiveFilters(filters);
  const searching = mode === 'search';

  const view = deriveInventoryView({
    mode,
    query: debouncedSearch,
    rowCount: rows.length,
    loadedOnce,
    hasError: !!activeModule.error && rows.length === 0,
    filtered,
  });

  const { headerProps, listProps, headerHeight } = useCollapsingHeader({
    pinned: !headerCollapses(view),
    refreshing,
    contentBottomPadding: insets.bottom + LIST_BOTTOM_PAD,
  });

  // ─── Actions ──────────────────────────────────────────────────────────────

  const openDetail = useCallback(
    (batch: BatchDto) => {
      // Close BEFORE navigating — a Modal left mounted over a screen transition eats the taps on
      // the screen you land on.
      setSheet(null);
      navigation?.navigate?.('InventoryDetail', { batchId: batch.id, mode: 'view' });
    },
    [navigation],
  );

  const openActions = useCallback((batch: BatchDto) => {
    setActiveBatch(batch);
    setSheet('actions');
  }, []);

  /**
   * Load the moves THIS batch may make.
   *
   * Fails closed: on an error the sheet shows a message and a Retry and renders ZERO buttons.
   * Guessing from the status alone would offer transitions the server refuses — an ACTIVE batch
   * past its expiry matches the raw matrix but is rejected by the expiry guard.
   */
  const openStatusSheet = useCallback(
    (batch: BatchDto) => {
      setActiveBatch(batch);
      setTransitions(null);
      setTransitionsError(false);
      setSheet('status');
      if (batch.id == null) return;
      void activeModule
        .getAllowedTransitions(batch.id)
        .then((res: { success: boolean; data?: unknown }) => {
          if (res?.success) setTransitions((res.data as InventoryStatus[]) ?? []);
          else setTransitionsError(true);
        })
        .catch(() => setTransitionsError(true));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moduleKey],
  );

  const changeStatus = useCallback(
    async (next: InventoryStatus) => {
      if (!activeBatch?.id) return;
      setSheet(null);
      const res = await activeModule.updateBatchStatus(activeBatch.id, next);
      if (!res?.success) {
        showToast(res?.error || 'Could not change the status', 'error');
        return;
      }
      showToast(`Batch moved to ${statusLabel(next)}`, 'success');
      // A status change can re-sort the row or drop it out of the active filter, so reload rather
      // than patching in place.
      reload();
      refreshCounts();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeBatch, moduleKey, reload, refreshCounts, showToast],
  );

  const confirmDelete = useCallback(async () => {
    setDialog(null);
    if (!activeBatch?.id) return;
    const res = await activeModule.deleteInventoryBatch(activeBatch.id);
    if (!res?.success) {
      showToast(res?.error || 'Could not delete this batch', 'error');
      return;
    }
    showToast('Batch deleted', 'success');
    reload();
    refreshCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBatch, moduleKey, reload, refreshCounts, showToast]);

  const confirmDispose = useCallback(async () => {
    setDialog(null);
    if (!activeBatch?.id) return;
    const res = await activeModule.disposeBatch(activeBatch.id);
    if (!res?.success) {
      showToast(res?.error || 'Could not dispose this batch', 'error');
      return;
    }
    showToast('Remaining stock written off', 'success');
    reload();
    refreshCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBatch, moduleKey, reload, refreshCounts, showToast]);

  const openAdd = useCallback(() => {
    setSheet(null);
    navigation?.navigate?.('InventoryDetail', { mode: 'add' });
  }, [navigation]);

  const clearFilters = useCallback(() => {
    setFilters((prev) => ({ ...DEFAULT_FILTERS, type: prev.type }));
  }, []);

  // ─── Body ─────────────────────────────────────────────────────────────────

  const bodyInset: StyleProp<ViewStyle> = { paddingTop: headerHeight + LIST_TOP_PAD };

  const list = (
    <AnimatedFlatList
      {...listProps}
      // On react-native-web this maps to `scrollbar-width`. Without it the list keeps a 15px
      // scrollbar gutter that the header (an absolute overlay) does not, so every card sits
      // narrower than the search box above it and the whole screen reads as misaligned.
      showsVerticalScrollIndicator={false}
      data={rows}
      keyExtractor={(item: BatchRow, index: number) => String(item.id ?? index)}
      renderItem={({ item, index }: { item: BatchRow; index: number }) => (
        <BatchCard
          row={item}
          styles={styles}
          theme={theme}
          onPress={() => openDetail(activeModule.inventory[index] as BatchDto)}
          onLongPress={() => openActions(activeModule.inventory[index] as BatchDto)}
        />
      )}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          progressViewOffset={headerHeight}
          tintColor={colors.primary}
        />
      }
      ListFooterComponent={
        activeModule.loading && rows.length > 0 ? (
          <ActivityIndicator style={styles.footerSpinner} color={colors.primary} />
        ) : null
      }
    />
  );

  let body: React.ReactNode;
  if (view === 'LOADING') {
    body = (
      <View style={[styles.skeletonWrap, bodyInset]}>
        {[0, 1, 2, 3, 4].map((i) => (
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
        headline="Couldn’t load inventory"
        subtext="Something went wrong while loading your batches. Check your connection and try again."
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
        headline="No batches yet"
        subtext="Add your first inventory batch to start tracking stock levels and expiry."
        ctaLabel="Add Batch"
        ctaIcon={<Plus size={18} color="#ffffff" />}
        onCta={openAdd}
      />
    );
  } else if (view === 'SEARCH_IDLE') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<Search size={40} color={palette.muted} />}
        headline="Search inventory"
        subtext="Find a batch by product, batch number or supplier."
      />
    );
  } else if (view === 'SEARCHING') {
    body = (
      <View style={[styles.skeletonWrap, bodyInset]}>
        {[0, 1, 2].map((i) => (
          <SkeletonRow key={i} styles={styles} />
        ))}
      </View>
    );
  } else if (view === 'NO_RESULTS') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<Search size={40} color={palette.muted} />}
        headline="No batches found"
        subtext={`No results for “${debouncedSearch}”. Try a different product, batch number or supplier.`}
        ctaLabel="Clear search"
        ctaIcon={<X size={18} color="#ffffff" />}
        onCta={() => setSearch('')}
      />
    );
  } else if (view === 'FILTERED_EMPTY') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<SlidersHorizontal size={40} color={palette.muted} />}
        headline="No batches match these filters"
        subtext="Nothing here for the selected status or expiry window. Try widening it."
        ctaLabel="Clear filters"
        ctaIcon={<X size={18} color="#ffffff" />}
        onCta={clearFilters}
      />
    );
  } else {
    body = list;
  }

  // ─── Header ───────────────────────────────────────────────────────────────

  const header = (
    <CollapsingHeader {...headerProps} backgroundColor={palette.background} gapBelow={LIST_TOP_PAD}>
      {searching ? (
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, styles.searchBoxFocused]}>
            <Search size={18} color={palette.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search product, batch or supplier…"
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
            <View style={styles.titleRow}>
              <Text style={styles.title}>Inventory</Text>
              <View style={styles.modulePill}>
                <Text style={styles.modulePillText}>
                  {moduleKey === 'PHARMACY' ? 'Pharmacy' : 'Parlour'}
                </Text>
              </View>
            </View>
            <Text style={styles.subtitle}>{listSubtitle(total, filtered)}</Text>
          </View>

          <View style={styles.searchRow}>
            <Pressable style={styles.searchBox} onPress={() => setMode('search')}>
              <Search size={18} color={palette.muted} />
              <Text style={styles.searchPlaceholder}>Search product, batch or supplier…</Text>
            </Pressable>
            <Pressable
              style={[styles.filterButton, filtered && styles.filterButtonActive]}
              onPress={() => {
                setDraftFilters(filters);
                setSheet('filter');
              }}
              accessibilityRole="button"
              accessibilityLabel="Filters"
            >
              <SlidersHorizontal size={19} color={filtered ? colors.primary : palette.muted} />
            </Pressable>
          </View>

          {/* Product | Raw — the POOL, not a filter. Exactly one is always selected. */}
          <View style={styles.typeToggle}>
            {(
              [
                { key: 'PRODUCT_INVENTORY', label: 'Product', Icon: Package },
                { key: 'RAW_INVENTORY', label: 'Raw', Icon: Leaf },
              ] as const
            ).map(({ key, label, Icon }) => {
              const active = filters.type === key;
              const count = active ? total : otherPoolTotal;
              return (
                <Pressable
                  key={key}
                  onPress={() => setFilters((p) => ({ ...p, type: key }))}
                  style={[styles.typeSeg, active && styles.typeSegActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Icon size={15} color={active ? colors.primary : palette.muted} />
                  <Text style={[styles.typeSegLabel, active && styles.typeSegLabelActive]}>
                    {label}
                  </Text>
                  {count !== null && count !== undefined ? (
                    <Text style={[styles.typeSegCount, active && styles.typeSegCountActive]}>
                      {count}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {filtered ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
            >
              {appliedFilterChips(filters).map((chip) => (
                <Pressable
                  key={chip.id}
                  style={styles.appliedChip}
                  onPress={() =>
                    setFilters((p) =>
                      chip.id === 'status' ? { ...p, status: 'ALL' } : { ...p, expiry: 'ANY' },
                    )
                  }
                >
                  <Text style={styles.appliedChipText}>{chip.label}</Text>
                  <X size={12} color={colors.primary} />
                </Pressable>
              ))}
              <Pressable onPress={clearFilters} hitSlop={8}>
                <Text style={styles.clearAll}>Clear all</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
            >
              {(['ALL', ...INVENTORY_STATUSES] as const).map((s) => {
                const active = filters.status === s;
                const count =
                  s === 'ALL' ? total : counts ? counts[s as InventoryStatus] : undefined;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setFilters((p) => ({ ...p, status: s }))}
                    style={[styles.chip, active && styles.chipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                      {statusLabel(s)}
                    </Text>
                    {count !== undefined && count !== null ? (
                      <Text style={[styles.chipCount, active && styles.chipCountActive]}>
                        {count}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </>
      )}
    </CollapsingHeader>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {body}
      {header}

      {showsFab(view) ? (
        <FAB onPress={openAdd} accessibilityLabel="Add batch" icon={<Plus size={26} />} />
      ) : null}

      {sheet === 'filter' ? (
        <FilterSheet
          value={draftFilters}
          counts={counts}
          total={total}
          styles={styles}
          onChange={setDraftFilters}
          onReset={() => setDraftFilters({ ...DEFAULT_FILTERS, type: draftFilters.type })}
          onApply={() => {
            setFilters(draftFilters);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'actions' && activeBatch ? (
        <ActionsSheet
          batch={activeBatch}
          wastageEnabled={wastageEnabled}
          styles={styles}
          theme={theme}
          onClose={() => setSheet(null)}
          onAction={(id) => {
            if (id === 'view') return openDetail(activeBatch);
            if (id === 'status') return openStatusSheet(activeBatch);
            setSheet(null);
            if (id === 'dispose') setDialog('dispose');
            if (id === 'delete') setDialog('delete');
          }}
        />
      ) : null}

      {sheet === 'status' && activeBatch ? (
        <StatusSheet
          transitions={transitions}
          hasError={transitionsError}
          styles={styles}
          theme={theme}
          onRetry={() => openStatusSheet(activeBatch)}
          onPick={changeStatus}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {dialog === 'delete' ? (
        <ConfirmDialog
          visible
          title="Delete this batch?"
          message="This cannot be undone. Only batches that have never been drawn from can be deleted."
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'dispose' ? (
        <ConfirmDialog
          visible
          title="Write off remaining stock?"
          message="The remaining quantity is recorded as wastage and the batch is left at zero."
          confirmLabel="Dispose"
          danger
          onConfirm={confirmDispose}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof createStyles>;

function BatchCard({
  row,
  styles,
  theme,
  onPress,
  onLongPress,
}: {
  row: BatchRow;
  styles: Styles;
  theme: AppTheme;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const st = theme.status[row.status] ?? theme.status.FALLBACK;
  const fillTint = {
    healthy: theme.palette.success,
    low: theme.palette.warning,
    critical: theme.palette.error,
    none: theme.palette.muted,
  }[row.remaining];
  const expiryTint = {
    expired: theme.palette.error,
    near: theme.palette.warning,
    fresh: theme.palette.muted,
    none: theme.palette.muted,
  }[row.expiry];

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.remainingText} ${row.ofText}`}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardTopLeft}>
          <Text style={styles.cardName} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {[row.batchNumber, row.supplier].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: st.bg, borderColor: st.border }]}>
          <Text style={[styles.statusPillText, { color: st.text }]}>{statusLabel(row.status)}</Text>
        </View>
      </View>

      {/* The remaining figure carries the health colour itself — it is one of the row's three
          independent cues (status pill, remaining, expiry), and merging it into the "/ 50 boxes"
          string would leave that cue living only in the progress bar. */}
      {/* Quantity and its track are ONE band, tighter than the gap between bands — the bar belongs
          to the figure above it, not to the expiry line below. */}
      <View style={styles.stockBand}>
        <View style={styles.qtyRow}>
          <Text style={[styles.qtyRemaining, { color: fillTint }]}>{row.remainingText}</Text>
          <Text style={styles.qtyOf}>{row.ofText}</Text>
          {row.baseEquivalence ? <Text style={styles.qtyBase}>{row.baseEquivalence}</Text> : null}
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.trackFill,
              { width: `${Math.round(row.fill * 100)}%`, backgroundColor: fillTint },
            ]}
          />
        </View>
      </View>

      {row.expiryLabel ? (
        <View style={styles.expiryRow}>
          {/* Tinted to match the text, as the mockup draws it — amber on a near-expiry row, red
              on an expired one. */}
          <Calendar size={13} color={expiryTint} />
          <Text
            style={[
              styles.expiryText,
              { color: expiryTint },
              row.expiry === 'expired' && styles.expiryStruck,
            ]}
          >
            {row.expiryLabel}
          </Text>
          {row.expiryCountdown ? (
            <Text style={[styles.expiryCountdown, { color: expiryTint }]}>
              · {row.expiryCountdown}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── Sheets ──────────────────────────────────────────────────────────────────

function SheetShell({
  children,
  styles,
  onClose,
}: {
  children: React.ReactNode;
  styles: Styles;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    // A Modal renders OUTSIDE SafeAreaView, so it applies the bottom inset itself.
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grabber} />
        {children}
      </View>
    </Modal>
  );
}

function FilterSheet({
  value,
  counts,
  total,
  styles,
  onChange,
  onReset,
  onApply,
  onClose,
}: {
  value: InventoryFilters;
  counts: InventoryStatusCounts | null;
  total: number | null;
  styles: Styles;
  onChange: (next: InventoryFilters) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
}) {
  // The Apply button's count is the SELECTED status's count, or the whole filtered total when no
  // status is picked — the same number the list will show.
  const applyCount = value.status === 'ALL' ? total : counts?.[value.status];

  const row = (label: string, selected: boolean, onPress: () => void, key: string) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[styles.sheetChip, selected && styles.sheetChipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.sheetChipText, selected && styles.sheetChipTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <SheetShell styles={styles} onClose={onClose}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Filters</Text>
        <Pressable onPress={onReset} hitSlop={8}>
          <Text style={styles.sheetReset}>Reset</Text>
        </Pressable>
      </View>

      <Text style={styles.sheetLabel}>Status</Text>
      <View style={styles.sheetChipWrap}>
        {(['ALL', ...INVENTORY_STATUSES] as const).map((s) =>
          row(statusLabel(s), value.status === s, () => onChange({ ...value, status: s }), s),
        )}
      </View>

      <Text style={styles.sheetLabel}>Type</Text>
      <View style={styles.sheetChipWrap}>
        {(
          [
            ['PRODUCT_INVENTORY', 'Product'],
            ['RAW_INVENTORY', 'Raw'],
          ] as const
        ).map(([k, label]) =>
          row(label, value.type === k, () => onChange({ ...value, type: k }), k),
        )}
      </View>

      <Text style={styles.sheetLabel}>Expiry</Text>
      <View style={styles.sheetChipWrap}>
        {(
          [
            ['ANY', 'Any'],
            ['EXPIRING_30', 'Expiring ≤30d'],
            ['EXPIRED', 'Expired'],
          ] as [ExpiryFilter, string][]
        ).map(([k, label]) =>
          row(label, value.expiry === k, () => onChange({ ...value, expiry: k }), k),
        )}
      </View>

      <Pressable style={styles.applyButton} onPress={onApply} accessibilityRole="button">
        <Text style={styles.applyLabel}>
          {applyCount === undefined || applyCount === null
            ? 'Apply'
            : `Apply · ${applyCount} ${applyCount === 1 ? 'batch' : 'batches'}`}
        </Text>
      </Pressable>
      <View style={styles.sheetTail} />
    </SheetShell>
  );
}

function ActionsSheet({
  batch,
  wastageEnabled,
  styles,
  theme,
  onAction,
  onClose,
}: {
  batch: BatchDto;
  wastageEnabled: boolean;
  styles: Styles;
  theme: AppTheme;
  onAction: (id: 'view' | 'status' | 'dispose' | 'delete') => void;
  onClose: () => void;
}) {
  const actions = quickActionsFor(batch, { wastageEnabled });
  const icons = {
    status: <ShieldAlert size={20} color={theme.palette.onSurface} />,
    view: <FileText size={20} color={theme.palette.onSurface} />,
    dispose: <CircleX size={20} color={theme.palette.error} />,
    delete: <Trash2 size={20} color={theme.palette.error} />,
  };

  return (
    <SheetShell styles={styles} onClose={onClose}>
      <View style={styles.sheetSummary}>
        <View style={styles.sheetAvatar}>
          <Boxes size={19} color={theme.colors.primary} />
        </View>
        <View style={styles.sheetSummaryMid}>
          <Text style={styles.sheetSummaryName} numberOfLines={1}>
            {batch.itemName || 'Batch'}
          </Text>
          <Text style={styles.sheetSummaryMeta} numberOfLines={1}>
            {batch.batchNumber}
          </Text>
        </View>
      </View>

      {actions.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => !a.disabled && onAction(a.id)}
          disabled={a.disabled}
          style={[styles.actionRow, a.disabled && styles.actionRowDisabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!a.disabled }}
        >
          {icons[a.id]}
          <View style={styles.actionMid}>
            <Text style={[styles.actionLabel, a.destructive && styles.actionLabelDestructive]}>
              {a.label}
            </Text>
            {a.sub ? <Text style={styles.actionSub}>{a.sub}</Text> : null}
          </View>
        </Pressable>
      ))}
    </SheetShell>
  );
}

/**
 * The status sheet, driven entirely by `allowedTransitions`.
 *
 * Three distinct states, and the error one is the point: on a failed fetch it renders NO buttons.
 * Falling back to a hardcoded matrix would offer moves the server refuses.
 */
function StatusSheet({
  transitions,
  hasError,
  styles,
  theme,
  onRetry,
  onPick,
  onClose,
}: {
  transitions: InventoryStatus[] | null;
  hasError: boolean;
  styles: Styles;
  theme: AppTheme;
  onRetry: () => void;
  onPick: (s: InventoryStatus) => void;
  onClose: () => void;
}) {
  const icons: Partial<Record<InventoryStatus, React.ReactNode>> = {
    ON_HOLD: <Lock size={20} color={theme.palette.warning} />,
    QUARANTINED: <ShieldAlert size={20} color={theme.colors.primary} />,
  };

  return (
    <SheetShell styles={styles} onClose={onClose}>
      <Text style={styles.sheetTitle}>Change status</Text>

      {hasError ? (
        <View style={styles.sheetNotice}>
          <Text style={styles.sheetNoticeText}>Couldn’t load the available status changes.</Text>
          <Pressable onPress={onRetry} style={styles.retryButton} accessibilityRole="button">
            <RotateCw size={15} color={theme.colors.primary} />
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : transitions === null ? (
        <View style={styles.sheetNotice}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.sheetNoticeText}>Checking allowed transitions…</Text>
        </View>
      ) : transitions.length === 0 ? (
        <View style={styles.sheetNotice}>
          <Text style={styles.sheetNoticeText}>
            No status change is available for this batch right now.
          </Text>
        </View>
      ) : (
        transitions.map((s) => (
          <Pressable
            key={s}
            onPress={() => onPick(s)}
            style={styles.actionRow}
            accessibilityRole="button"
          >
            {icons[s] ?? <Boxes size={20} color={theme.palette.onSurface} />}
            <View style={styles.actionMid}>
              <Text style={styles.actionLabel}>{statusLabel(s)}</Text>
            </View>
          </Pressable>
        ))
      )}
    </SheetShell>
  );
}

// ─── Hero / skeleton ─────────────────────────────────────────────────────────

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
  styles: Styles;
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
      <View style={styles.heroIcon}>{icon}</View>
      <Text style={styles.heroHeadline}>{headline}</Text>
      <Text style={styles.heroSub}>{subtext}</Text>
      {ctaLabel && onCta ? (
        <Pressable onPress={onCta} style={styles.heroCta} accessibilityRole="button">
          {ctaIcon}
          <Text style={styles.heroCtaLabel}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Shares the real card's shell so the list does not jump when the data lands. */
function SkeletonRow({ styles }: { styles: Styles }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardTopLeft}>
          <View style={[styles.sk, styles.skName]} />
          <View style={[styles.sk, styles.skMeta]} />
        </View>
        <View style={[styles.sk, styles.skPill]} />
      </View>
      <View style={[styles.sk, styles.skTrack]} />
      <View style={[styles.sk, styles.skExpiry]} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  const { colors, palette } = theme;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },

    /*
     * Spacing is the mockup's, not the Orders screen's.
     *
     * The design's Content column runs on an 18 gap between its four sections (title, search,
     * filters, list), with a tighter 12 INSIDE the filters block and 12 between cards. Built off
     * the Orders template these were all 10, which is what made the screen read as cramped
     * compared to the design.
     */
    titleBlock: { gap: 5, marginBottom: SECTION_GAP, paddingHorizontal: SIDE_PAD },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    title: { fontSize: 26, fontWeight: '800', color: palette.onBackground },
    // Outlined, not just tinted — the mockup draws a visible accent border around it.
    modulePill: {
      paddingVertical: 3,
      paddingHorizontal: 9,
      borderRadius: 999,
      backgroundColor: colors.softBg,
      borderWidth: 1,
      borderColor: colors.primary + '55',
    },
    modulePillText: { fontSize: 11, fontWeight: '700', color: colors.primary },
    subtitle: { fontSize: 12.5, color: palette.muted },

    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: SECTION_GAP,
      paddingHorizontal: SIDE_PAD,
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 46,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    searchBoxFocused: { borderColor: colors.primary },
    searchPlaceholder: { flex: 1, fontSize: 14, color: palette.muted },
    searchInput: { flex: 1, fontSize: 14, color: palette.onSurface, padding: 0 },
    cancelText: { fontSize: 14, fontWeight: '600', color: colors.primary },
    filterButton: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    filterButtonActive: { borderColor: colors.primary, backgroundColor: colors.softBg },

    typeToggle: {
      flexDirection: 'row',
      // 3 inside the pill, 12 down to the chips — the design's own "filters" block.
      gap: 3,
      padding: 3,
      borderRadius: 12,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
      marginBottom: FILTER_GAP,
      // margin, not padding — this one is a bordered pill, so the gutter must sit outside it.
      marginHorizontal: SIDE_PAD,
    },
    typeSeg: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
    },
    typeSegActive: { backgroundColor: colors.softBg },
    typeSegLabel: { fontSize: 13, fontWeight: '600', color: palette.muted },
    typeSegLabelActive: { color: colors.primary },
    typeSegCount: { fontSize: 12, fontWeight: '600', color: palette.muted },
    typeSegCountActive: { color: colors.primary },

    // flexShrink:0 is load-bearing — without it the row collapses inside the header column.
    chipScroll: { flexShrink: 0 },
    // No trailing padding — the header's gapBelow already carries the 18 down to the list.
    // The gutter is horizontal PADDING on the scroll content, so chips scroll under the edge.
    chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: SIDE_PAD },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    chipActive: { backgroundColor: colors.softBg, borderColor: colors.primary },
    chipLabel: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
    chipLabelActive: { color: colors.primary },
    chipCount: { fontSize: 11.5, fontWeight: '700', color: palette.muted },
    chipCountActive: { color: colors.primary },

    appliedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 5,
      paddingHorizontal: 11,
      borderRadius: 999,
      backgroundColor: colors.softBg,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    appliedChipText: { fontSize: 12, fontWeight: '600', color: colors.primary },
    clearAll: { fontSize: 12.5, fontWeight: '600', color: palette.muted, paddingHorizontal: 4 },

    // ── Card ──
    card: {
      // 11 between the card's three bands (identity, stock, expiry); 13/14 padding; 12 apart.
      gap: 11,
      paddingVertical: 13,
      paddingHorizontal: 14,
      marginBottom: CARD_GAP,
      // The list itself is full-bleed (so its scrollbar and overscroll reach the edge); the gutter
      // lives on the row.
      marginHorizontal: SIDE_PAD,
      borderRadius: 16,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    cardTopLeft: { flex: 1, gap: 3 },
    // 15/600 and 11.5 — the mockup's values. The name is semibold, not bold: at 700 it competes
    // with the remaining figure, which is the row's actual headline.
    cardName: { fontSize: 15, fontWeight: '600', color: palette.onSurface },
    cardMeta: { fontSize: 11.5, color: palette.muted },
    statusPill: {
      paddingVertical: 3,
      paddingHorizontal: 9,
      borderRadius: 999,
      borderWidth: 1,
    },
    statusPillText: { fontSize: 10, fontWeight: '700' },

    stockBand: { gap: 6 },
    qtyRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    // 15/700, tinted at the call site by the health state.
    qtyRemaining: { fontSize: 15, fontWeight: '700' },
    qtyOf: { fontSize: 12.5, color: palette.muted },
    // Pushed to the far right, as the mockup draws it.
    qtyBase: { flex: 1, fontSize: 12, color: palette.muted, textAlign: 'right' },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: palette.surfaceElevated,
      overflow: 'hidden',
    },
    trackFill: { height: '100%', borderRadius: 3 },

    expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    expiryText: { fontSize: 12 },
    expiryStruck: { textDecorationLine: 'line-through' },
    expiryCountdown: { fontSize: 12, fontWeight: '600' },

    footerSpinner: { paddingVertical: 18 },

    // ── Hero / skeleton ──
    hero: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 10,
    },
    heroIcon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
      marginBottom: 4,
    },
    heroHeadline: { fontSize: 17, fontWeight: '700', color: palette.onBackground },
    heroSub: { fontSize: 13, color: palette.muted, textAlign: 'center', lineHeight: 19 },
    heroCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      paddingVertical: 11,
      paddingHorizontal: 18,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    heroCtaLabel: { fontSize: 14, fontWeight: '700', color: colors.onAccent ?? '#FFFFFF' },

    // No gutter here: the skeleton rows reuse `card`, which already carries its own margin. Adding
    // it in both places insets them to 32 and the placeholders sit narrower than the real rows.
    skeletonWrap: { flex: 1 },
    // Sized to the real card's parts so the list does not jump when the data lands.
    sk: { borderRadius: 6, backgroundColor: palette.surfaceElevated },
    skName: { width: 150, height: 13 },
    skMeta: { width: 110, height: 10, marginTop: 6 },
    skPill: { width: 58, height: 18 },
    skTrack: { height: 6, marginTop: 12 },
    skExpiry: { width: 130, height: 11, marginTop: 10 },

    // ── Sheets ──
    scrim: { flex: 1, backgroundColor: palette.overlay },
    sheet: {
      backgroundColor: palette.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 8,
      gap: 6,
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: palette.divider,
      marginBottom: 10,
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: palette.onBackground },
    sheetReset: { fontSize: 13.5, fontWeight: '600', color: colors.primary },
    sheetLabel: {
      fontSize: 12.5,
      fontWeight: '700',
      color: palette.muted,
      marginTop: 12,
      marginBottom: 2,
    },
    sheetChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    sheetChip: {
      paddingVertical: 7,
      paddingHorizontal: 13,
      borderRadius: 999,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    sheetChipActive: { backgroundColor: colors.softBg, borderColor: colors.primary },
    sheetChipText: { fontSize: 13, fontWeight: '600', color: palette.muted },
    sheetChipTextActive: { color: colors.primary },

    applyButton: {
      marginTop: 18,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    applyLabel: { fontSize: 14.5, fontWeight: '700', color: colors.onAccent ?? '#FFFFFF' },

    sheetSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: palette.surface,
      marginBottom: 8,
    },
    sheetAvatar: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.softBg,
    },
    sheetSummaryMid: { flex: 1, gap: 2 },
    sheetSummaryName: { fontSize: 14.5, fontWeight: '700', color: palette.onSurface },
    sheetSummaryMeta: { fontSize: 12, color: palette.muted },

    actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
    actionRowDisabled: { opacity: 0.45 },
    actionMid: { flex: 1, gap: 2 },
    actionLabel: { fontSize: 14.5, color: palette.onSurface },
    actionLabelDestructive: { color: palette.error },
    actionSub: { fontSize: 12, color: palette.muted },

    sheetNotice: { alignItems: 'center', gap: 10, paddingVertical: 24 },
    sheetNoticeText: { fontSize: 13, color: palette.muted, textAlign: 'center' },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: colors.softBg,
    },
    retryLabel: { fontSize: 13, fontWeight: '600', color: colors.primary },
    sheetTail: { height: 4 },
  });
}
