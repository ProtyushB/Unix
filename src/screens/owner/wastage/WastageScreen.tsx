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
  AlertTriangle,
  CircleX,
  Plus,
  RotateCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react-native';

import { FAB } from '../../../components/layout/FAB';
import { CollapsingHeader, AnimatedFlatList } from '../../../components/layout/CollapsingHeader';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { useTheme } from '../../../hooks/useTheme';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { useCollapsingHeader } from '../../../hooks/useCollapsingHeader';
import { useToast } from '../../../hooks/useToast';
import { useAppContext } from '../../../context/AppContext';
import { useParlour } from '../../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../../backend/modules/pharmacy/hook/usePharmacy';
import { getSelectedBusinessId } from '../../../backend/modules/shared/hook/useModuleService';
import { useIsTabEnabled } from '../../../backend/tab-config';
import type {
  WastageDto,
  WastageQuery,
  WastageReason,
} from '../../../backend/modules/shared/wastage.types';
import { WASTAGE_REASON_CHOICES } from '../../../backend/modules/shared/wastage.types';
import type { AppTheme } from '../../../theme/theme.types';
import { listSubtitle, toWastageRow, type WastageRow } from './wastage.model';
import {
  DEFAULT_FILTERS,
  REASON_CHIPS,
  appliedFilterChips,
  cardMetaLine,
  deriveWastageView,
  hasActiveFilters,
  headerCollapses,
  poolLabel,
  quickActionsFor,
  reasonLabel,
  showsFab,
  toQuery,
  type WastageFilters,
} from './wastage.view';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const LIST_BOTTOM_PAD = 100;

/**
 * The design's spacing scale, lifted from the Stock & Ops mockups — the same values every list
 * screen in this app uses.
 */
const SECTION_GAP = 18;
const FILTER_GAP = 12;
const CARD_GAP = 12;
const LIST_TOP_PAD = SECTION_GAP;

/**
 * The screen's side gutter — the Content column is inset 16 on both edges.
 *
 * Applied PER ELEMENT rather than on a wrapper: chip rows are horizontal ScrollViews, so their 16
 * belongs on the contentContainerStyle. Put it on a container and the chips stop 16 short of the
 * edge instead of scrolling under it.
 */
const SIDE_PAD = 16;

/**
 * The module hook's wastage slice, narrowed to what this screen uses.
 *
 * ⚠️ REFERENCE STABILITY IS THE CONTRACT HERE, not tidiness. `rows` feeds a `useEffect` dependency
 * whose body calls `setRows`. The stub this replaced returned a fresh `[]` on every render, so the
 * effect re-ran, set state, re-rendered, and looped until React gave up with "Maximum update depth
 * exceeded" — with the whole suite green, because jest in this repo runs in node and never renders.
 *
 * `activeModule.wastage` is a `useState` cell, so its identity only changes when the data does,
 * which is exactly the property that was missing. The `useMemo` around the object keeps the
 * WRAPPER stable too; `moduleKey` is in the dependency list because switching module swaps which
 * hook instance is being read, and the callbacks below belong to one of them.
 */
function useWastageListApi(
  activeModule: {
    wastage: unknown[];
    wastageTotalPages: number;
    loadWastageByBusiness: (
      businessId: number,
      query?: WastageQuery,
      page?: number,
      limit?: number,
      append?: boolean,
    ) => Promise<unknown>;
    deleteWastage: (id: number) => Promise<{ success: boolean; error?: string | null }>;
  },
  moduleKey: string,
) {
  const rows = activeModule.wastage as WastageDto[];
  const totalPages = activeModule.wastageTotalPages;
  const loadWastageByBusiness = activeModule.loadWastageByBusiness;
  const deleteWastage = activeModule.deleteWastage;
  return useMemo(
    () => ({
      rows,
      totalPages,
      load: (
        businessId: number,
        query: WastageQuery,
        page: number,
        limit: number,
        append: boolean,
      ) => {
        void loadWastageByBusiness(businessId, query, page, limit, append);
      },
      remove: (id: number) => deleteWastage(id),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, totalPages, loadWastageByBusiness, deleteWastage, moduleKey],
  );
}

interface WastageScreenProps {
  /** Optional so the screen can also be mounted standalone in the web preview. */
  navigation?: {
    navigate?: (screen: string, params?: Record<string, unknown>) => void;
    addListener?: (event: string, cb: () => void) => (() => void) | undefined;
  };
}

/**
 * Wastage — the write-off log.
 *
 * Same shape as `InventoryScreen`: collapsing header, a filter sheet, a long-press actions sheet and
 * a FAB. Every decision it makes — which view, what the filters mean, what a row says — lives in
 * `wastage.view.ts` / `wastage.model.ts`, which are `.ts` and therefore covered by jest.
 *
 * Filtering, sorting, searching and paging are ALL server-side. Nothing here narrows a loaded page
 * client-side: with infinite scroll that would filter only what happens to be loaded, so the list
 * would grow as you scrolled and never be authoritative.
 *
 * ⚠️ There is no record count and no total value anywhere on this screen, by design — see
 * `listSubtitle`.
 */
export function WastageScreen({ navigation }: WastageScreenProps = {}) {
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
  const listApi = useWastageListApi(activeModule, moduleKey);
  // The endpoint is `@TabGated(WASTAGE)`: with the tab off, delete 403s. Gated in the sheet rather
  // than hidden — see `quickActionsFor`.
  const wastageEnabled = useIsTabEnabled('WASTAGE');

  const [businessId, setBusinessId] = useState<number | null>(null);
  const [mode, setMode] = useState<'browse' | 'search'>('browse');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<WastageFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<WastageFilters>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<WastageRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  // Every sheet is gated on STATE, never on a Modal's `visible` prop: on react-native-web a
  // dismissed Modal's portal stays mounted and swallows taps meant for the screen beneath it.
  const [sheet, setSheet] = useState<null | 'filter' | 'actions'>(null);
  const [activeRecord, setActiveRecord] = useState<WastageDto | null>(null);
  const [dialog, setDialog] = useState<null | 'delete'>(null);

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
      listApi.load(businessId, query, page, PAGE_SIZE, append);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [businessId, query, moduleKey],
  );

  const reload = useCallback(() => load(1, false), [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Refetch on RETURN from the detail screen. Skips the FIRST focus — the effect above already
  // fetched on mount, and firing both races two identical requests.
  const hasFocusedRef = useRef(false);
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        return;
      }
      reload();
    });
    return unsubscribe;
  }, [navigation, reload]);

  /**
   * The DTOs mapped to rows.
   *
   * ⚠️ `listRows` MUST be reference-stable between renders when the data has not changed. It is a
   * `useState` cell inside the module hook, so it is — but this effect calls `setRows`, so anything
   * that handed back a fresh array per render would re-run it, set state, re-render, and loop until
   * React gave up. That exact bug shipped here once, with the whole suite green: jest in this repo
   * runs in node and renders nothing, so no test can catch it.
   *
   * No base unit is passed: `toWastageRow` recovers it from each record, because the list has no
   * catalog to read a product ladder off and 'unit' would render "600 unit" for 600 ml.
   */
  const listRows = listApi.rows;
  useEffect(() => {
    setRows(listRows.map((w) => toWastageRow(w)));
    loadingMoreRef.current = false;
  }, [listRows]);

  /**
   * "The first load has finished" — the gate between LOADING and EMPTY.
   *
   * Tracks the loading true → false TRANSITION, not the flag: `loading` is false on the very first
   * render, so a plain `!loading` marks the screen loaded before any request exists and flashes the
   * empty hero at someone with a year of write-offs.
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

  /**
   * Infinite scroll, guarded on `totalPages` and NOTHING ELSE.
   *
   * There is no row count to compare against — the endpoint does not report one — so `totalPages` is
   * the only thing that can say "there is no page 5". Requesting one anyway returns an empty array
   * on a good day and a 400 on a bad one.
   */
  const onEndReached = useCallback(() => {
    if (loadingMoreRef.current || activeModule.loading) return;
    if (pageRef.current >= (listApi.totalPages || 1)) return;
    loadingMoreRef.current = true;
    load(pageRef.current + 1, true);
  }, [activeModule.loading, listApi.totalPages, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    reload();
    setRefreshing(false);
  }, [reload]);

  const filtered = hasActiveFilters(filters);
  const searching = mode === 'search';

  const view = deriveWastageView({
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
    (record: WastageDto) => {
      // Close BEFORE navigating — a Modal left mounted over a screen transition eats the taps on
      // the screen you land on.
      setSheet(null);
      navigation?.navigate?.('WastageDetail', { wastageId: record.id, mode: 'view' });
    },
    [navigation],
  );

  const openActions = useCallback((record: WastageDto) => {
    setActiveRecord(record);
    setSheet('actions');
  }, []);

  const openAdd = useCallback(() => {
    setSheet(null);
    navigation?.navigate?.('WastageDetail', { mode: 'add' });
  }, [navigation]);

  const confirmDelete = useCallback(async () => {
    setDialog(null);
    if (!activeRecord?.id) return;
    const res = await listApi.remove(activeRecord.id);
    if (!res?.success) {
      showToast(res?.error || 'Could not delete this wastage', 'error');
      return;
    }
    // Says the stock came BACK. A delete here is a reversal, and a bare "Deleted" hides the thing
    // the user most needs to know about what just happened to their inventory.
    showToast('Wastage deleted · stock restocked', 'success');
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRecord, moduleKey, reload, showToast]);

  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  /** What is narrowing the list, in words — the filtered-empty hero names it back to the user. */
  const applied = useMemo(() => appliedFilterChips(filters), [filters]);

  /** The long-press sheet's rows. The delete gate is the WASTAGE tab and nothing else. */
  const actions = useMemo(
    () => quickActionsFor(activeRecord, { wastageEnabled }),
    [activeRecord, wastageEnabled],
  );

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
      keyExtractor={(item: WastageRow, index: number) => String(item.id ?? index)}
      renderItem={({ item, index }: { item: WastageRow; index: number }) => (
        <WastageCard
          row={item}
          styles={styles}
          onPress={() => openDetail(listApi.rows[index])}
          onLongPress={() => openActions(listApi.rows[index])}
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
        headline="Couldn’t load wastage"
        subtext="Something went wrong while loading your records. Check your connection and try again."
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
        icon={<AlertTriangle size={40} color={palette.muted} />}
        headline="Nothing written off yet"
        subtext="Record expired, damaged or spilled stock so your inventory matches the shelf."
        ctaLabel="Record wastage"
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
        headline="Search wastage"
        subtext="Find a record by item name."
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
        headline="No wastage found"
        subtext={`No results for “${debouncedSearch}”. Try a different item name.`}
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
        headline="No wastage matches these filters"
        // Names what is actually applied rather than assuming it is the reason — the sheet can
        // narrow by sort order too, and "Nothing here for the selected reason" would be a lie
        // about a list nobody filtered by reason.
        subtext={`Nothing here for ${applied.join(' · ')}. Try widening it.`}
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
              placeholder="Search by item name"
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
              <Text style={styles.title}>Wastage</Text>
              <View style={styles.modulePill}>
                <Text style={styles.modulePillText}>
                  {moduleKey === 'PHARMACY' ? 'Pharmacy' : 'Parlour'}
                </Text>
              </View>
            </View>
            {/* No count and no total — see `listSubtitle`. */}
            <Text style={styles.subtitle}>{listSubtitle(filtered, filters.sortDir)}</Text>
          </View>

          <View style={styles.searchRow}>
            <Pressable style={styles.searchBox} onPress={() => setMode('search')}>
              <Search size={18} color={palette.muted} />
              {/* Pinned by the mockups. */}
              <Text style={styles.searchPlaceholder}>Search by item name</Text>
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

          {/*
            The reason chips. Seven plus an All head — drawn from `REASON_CHIPS`, which is built on
            `WASTAGE_REASON_CHOICES` and therefore excludes CORRECTION. No per-chip counts: no
            endpoint reports any, and an invented number is worse than none.
          */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            {REASON_CHIPS.map((chip) => {
              const active = filters.reason === chip.value;
              return (
                <Pressable
                  key={chip.value}
                  onPress={() => setFilters((prev) => ({ ...prev, reason: chip.value }))}
                  style={[styles.sheetChip, active && styles.sheetChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.sheetChipText, active && styles.sheetChipTextActive]}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* No second "applied filters" strip. Everything narrowing the list is already on screen
              — the reason on the chip row above, the sort order in the subtitle, and the filter
              button itself tints when either is set. A strip repeating the reason chip 40px under
              the reason chip reads as two different controls for one filter. */}
        </>
      )}
    </CollapsingHeader>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {body}
      {header}

      {showsFab(view) ? (
        <FAB onPress={openAdd} accessibilityLabel="Record wastage" icon={<Plus size={26} />} />
      ) : null}

      {sheet === 'filter' ? (
        <SheetShell styles={styles} onClose={() => setSheet(null)}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <Pressable onPress={() => setDraftFilters(DEFAULT_FILTERS)} hitSlop={8}>
              <Text style={styles.sheetReset}>Reset</Text>
            </Pressable>
          </View>

          {/*
            Reason over Sort, and NOTHING ELSE.

            ⚠️ In particular there is no Product/Raw toggle here. `inventoryType` is on every record
            and it IS in the sort whitelist, which makes the toggle the obvious thing to add — and
            the endpoint reads no such query param, so it would look like it worked and quietly
            return the unfiltered list. Type is a per-card badge on this screen, nothing more.
          */}
          <Text style={styles.sheetLabel}>Reason</Text>
          <View style={styles.sheetChipWrap}>
            {(['ALL', ...WASTAGE_REASON_CHOICES] as (WastageReason | 'ALL')[]).map((value) => {
              const active = draftFilters.reason === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setDraftFilters((prev) => ({ ...prev, reason: value }))}
                  style={[styles.sheetChip, active && styles.sheetChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.sheetChipText, active && styles.sheetChipTextActive]}>
                    {value === 'ALL' ? 'All Reasons' : reasonLabel(value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sheetLabel}>Sort</Text>
          <View style={styles.sheetChipWrap}>
            {(
              [
                ['desc', 'Newest first'],
                ['asc', 'Oldest first'],
              ] as ['asc' | 'desc', string][]
            ).map(([dir, label]) => {
              const active = draftFilters.sortDir === dir;
              return (
                <Pressable
                  key={dir}
                  onPress={() => setDraftFilters((prev) => ({ ...prev, sortDir: dir }))}
                  style={[styles.sheetChip, active && styles.sheetChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.sheetChipText, active && styles.sheetChipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* No count on Apply — nothing reports one. */}
          <Pressable
            style={styles.applyButton}
            onPress={() => {
              setFilters(draftFilters);
              setSheet(null);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.applyLabel}>Apply</Text>
          </Pressable>
          <View style={styles.sheetTail} />
        </SheetShell>
      ) : null}

      {sheet === 'actions' && activeRecord ? (
        <SheetShell styles={styles} onClose={() => setSheet(null)}>
          {/*
            Short, because a wastage is IMMUTABLE: View, and Delete (which restocks). No status
            change, no edit. A blocked Delete is DISABLED with its reason on the row rather than
            hidden — an action that silently disappears reads as a bug, and the user would have no
            way to learn that the Wastage tab switch is what took it away.
          */}
          {actions.map((action) => (
            <Pressable
              key={action.id}
              style={[styles.actionRow, action.disabled && styles.actionRowDisabled]}
              disabled={action.disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!action.disabled }}
              onPress={() => {
                if (action.id === 'view') {
                  openDetail(activeRecord);
                  return;
                }
                setSheet(null);
                setDialog('delete');
              }}
            >
              <View style={styles.actionCopy}>
                <Text
                  style={[styles.actionLabel, action.destructive && styles.actionLabelDestructive]}
                >
                  {action.label}
                </Text>
                {action.sub ? <Text style={styles.actionSub}>{action.sub}</Text> : null}
              </View>
            </Pressable>
          ))}
        </SheetShell>
      ) : null}

      {dialog === 'delete' ? (
        <ConfirmDialog
          visible
          title="Delete this wastage?"
          // The one sentence that must survive a copy edit: deleting puts the stock back.
          message="The written-off quantity is returned to the batches it came from."
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof createStyles>;

/**
 * One list row: name and quantity on top, then the reason chip and the pool badge, then the
 * timestamp with the note after a `·`.
 *
 * Every string comes off `WastageRow` or a tested function in `wastage.view.ts` — the card never
 * reaches into the DTO, because a mapping written inside a `.tsx` cannot be tested at all here.
 *
 * The POOL badge is the one piece of information only this feature's rows carry: a consumption is
 * always RAW and a transfer has two ends, so "which stock did this destroy?" is a question only a
 * wastage row can answer. It is a badge and NOT a filter — see the filter sheet.
 */
function WastageCard({
  row,
  styles,
  onPress,
  onLongPress,
}: {
  row: WastageRow;
  styles: Styles;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const pool = poolLabel(row.inventoryType);
  const meta = cardMetaLine(row);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.qtyText}, ${reasonLabel(row.reason)}`}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={styles.cardQty} numberOfLines={1}>
          {row.qtyText}
        </Text>
      </View>

      <View style={styles.cardChips}>
        {row.reason ? (
          <View style={styles.reasonChip}>
            <Text style={styles.reasonChipText}>{reasonLabel(row.reason)}</Text>
          </View>
        ) : null}
        {pool ? (
          <View style={styles.poolBadge}>
            <Text style={styles.poolBadgeText}>{pool}</Text>
          </View>
        ) : null}
      </View>

      {meta ? (
        <Text style={styles.cardMeta} numberOfLines={1}>
          {meta}
        </Text>
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
      <View style={[styles.sk, styles.skName]} />
      <View style={[styles.sk, styles.skMeta]} />
      <View style={[styles.sk, styles.skMeta]} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  const { colors, palette } = theme;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },

    /* The mockup's spacing, applied PER ELEMENT rather than on a wrapper — see SIDE_PAD. */
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

    // flexShrink:0 is load-bearing — without it the row collapses inside the header column. The
    // gutter is horizontal PADDING on the scroll content, so chips scroll under the edge.
    chipScroll: { flexShrink: 0, marginBottom: FILTER_GAP },
    chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: SIDE_PAD },

    // ── Card ──
    card: {
      gap: 6,
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
    cardTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
    cardName: { flex: 1, fontSize: 15, fontWeight: '600', color: palette.onSurface },
    cardQty: { fontSize: 13.5, fontWeight: '700', color: palette.onSurface },
    cardChips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    cardMeta: { fontSize: 11.5, color: palette.muted },

    // The reason reads as the row's classification, so it is tinted; the pool is a neutral fact
    // about which shelf the loss came off, so it is outlined. Two chips of the same weight side by
    // side would make the reader work out which one is the headline.
    reasonChip: {
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: 999,
      backgroundColor: colors.softBg,
      borderWidth: 1,
      borderColor: colors.primary + '40',
    },
    reasonChipText: { fontSize: 10.5, fontWeight: '700', color: colors.primary },
    poolBadge: {
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    poolBadgeText: { fontSize: 10.5, fontWeight: '600', color: palette.muted },

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

    // No gutter here: the skeleton rows reuse `card`, which already carries its own margin.
    skeletonWrap: { flex: 1 },
    sk: { borderRadius: 6, backgroundColor: palette.surfaceElevated },
    skName: { width: 150, height: 13 },
    skMeta: { width: 110, height: 10, marginTop: 6 },

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

    actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
    // Dimmed rather than removed — the row still has to explain WHY it cannot be tapped.
    actionRowDisabled: { opacity: 0.45 },
    actionCopy: { flex: 1, gap: 2 },
    actionLabel: { fontSize: 14.5, color: palette.onSurface },
    actionLabelDestructive: { color: palette.error },
    actionSub: { fontSize: 11.5, color: palette.muted },
    sheetTail: { height: 4 },
  });
}
