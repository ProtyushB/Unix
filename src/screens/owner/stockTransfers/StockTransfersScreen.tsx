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
  ArrowLeftRight,
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
import type { StockTransferDto } from '../../../backend/modules/shared/stockTransfer.types';
import type { AppTheme } from '../../../theme/theme.types';
import { listSubtitle, toStockTransferRow, type StockTransferRow } from './stockTransfer.model';
import {
  DEFAULT_FILTERS,
  appliedFilterChips,
  deleteRefusalMessage,
  deleteSuccessMessage,
  deriveStockTransfersView,
  directionLabel,
  hasActiveFilters,
  headerCollapses,
  quickActionsFor,
  reasonLabel,
  showsFab,
  showsReasonChip,
  sortLabel,
  toQuery,
  type StockTransferFilters,
} from './stockTransfer.view';

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
 * The base unit the list falls back to.
 *
 * ⚠️ A CONSTANT, and knowingly a compromise. The real base unit belongs to the PRODUCT, and the
 * list response carries no ladder — resolving it per row would mean hydrating the catalog just to
 * label a list. It matters less than it looks: `recordQtyLabel` prefers the record's own `unitName`
 * whenever the transfer was saved against a level, so this only ever fills in for a record stored in
 * bare base units, where "200 units" is at least not wrong about the number.
 *
 * Module scope rather than inline so it is a stable primitive and never a fresh value per render.
 */
const LIST_BASE_UNIT = 'unit';

interface StockTransfersScreenProps {
  /** Optional so the screen can also be mounted standalone in the web preview. */
  navigation?: {
    navigate?: (screen: string, params?: Record<string, unknown>) => void;
    addListener?: (event: string, cb: () => void) => (() => void) | undefined;
  };
}

/**
 * Stock Transfers — the cross-pool movement log.
 *
 * Same shape as `InventoryScreen`: collapsing header, a filter sheet, a long-press actions sheet and
 * a FAB. Every decision it makes — which view, what the filters mean, what a row says — lives in
 * `stockTransfer.view.ts` / `stockTransfer.model.ts`, which are `.ts` and therefore covered by jest.
 *
 * Filtering, sorting, searching and paging are ALL server-side. Nothing here narrows a loaded page
 * client-side: with infinite scroll that would filter only what happens to be loaded, so the list
 * would grow as you scrolled and never be authoritative.
 *
 * ⚠️ There is no record count anywhere on this screen, by design — see `listSubtitle`. And there are
 * no reason chips, by design — see `StockTransferFilters`.
 */
export function StockTransfersScreen({ navigation }: StockTransfersScreenProps = {}) {
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
   * ⚠️ Pull the individual pieces out; never depend on `activeModule` itself.
   *
   * `createModuleHook` returns a fresh object literal on every render, so an effect that lists it in
   * its deps re-runs every render — and a fetch effect that re-runs every render sets state, which
   * renders, which fetches again. That is a silent unbounded request loop; `OrderDetailScreen`
   * carries the same warning after it was caught there at 56 requests.
   *
   * `stockTransfers` is the hook's own `useState` array, so its identity only changes when a load
   * actually replaces it — which is exactly the property the effect below depends on. Anything that
   * rebuilt the array per render (a `.map()`, a `?? []` on a fresh literal) would spin this screen
   * until React blanked it, and jest would not catch it: nothing in this repo renders.
   */
  const {
    stockTransfers,
    stockTransfersTotalPages,
    loadStockTransfersByBusiness,
    deleteStockTransfer,
  } = activeModule;
  const listRows = stockTransfers as StockTransferDto[];

  const [businessId, setBusinessId] = useState<number | null>(null);
  const [mode, setMode] = useState<'browse' | 'search'>('browse');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<StockTransferFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<StockTransferFilters>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<StockTransferRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  // Every sheet is gated on STATE, never on a Modal's `visible` prop: on react-native-web a
  // dismissed Modal's portal stays mounted and swallows taps meant for the screen beneath it.
  const [sheet, setSheet] = useState<null | 'filter' | 'actions'>(null);
  const [activeRecord, setActiveRecord] = useState<StockTransferDto | null>(null);
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
      void loadStockTransfersByBusiness(businessId, query, page, PAGE_SIZE, append);
    },
    [businessId, query, loadStockTransfersByBusiness],
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

  // `listRows` is the module hook's state array, so this runs when a load replaces it and not once
  // per render. See the note where it is destructured — this is the dependency that spun the screen.
  useEffect(() => {
    setRows(listRows.map((t) => toStockTransferRow(t, LIST_BASE_UNIT)));
    loadingMoreRef.current = false;
  }, [listRows]);

  /**
   * "The first load has finished" — the gate between LOADING and EMPTY.
   *
   * Tracks the loading true → false TRANSITION, not the flag: `loading` is false on the very first
   * render, so a plain `!loading` marks the screen loaded before any request exists and flashes the
   * empty hero at a business with hundreds of transfers.
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
    if (pageRef.current >= (stockTransfersTotalPages || 1)) return;
    loadingMoreRef.current = true;
    load(pageRef.current + 1, true);
  }, [activeModule.loading, stockTransfersTotalPages, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    reload();
    setRefreshing(false);
  }, [reload]);

  const filtered = hasActiveFilters(filters);
  const searching = mode === 'search';
  const chips = appliedFilterChips(filters);

  const view = deriveStockTransfersView({
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
    (record: StockTransferDto | undefined) => {
      // `rows` is derived from `listRows` in an effect, so for the one frame between a load landing
      // and that effect flushing the two can differ in length. Guarding beats navigating to a
      // detail screen with `stockTransferId: undefined`, which renders "No transfer was specified".
      if (!record) return;
      // Close BEFORE navigating — a Modal left mounted over a screen transition eats the taps on
      // the screen you land on.
      setSheet(null);
      navigation?.navigate?.('StockTransferDetail', {
        stockTransferId: record.id,
        mode: 'view',
      });
    },
    [navigation],
  );

  const openActions = useCallback((record: StockTransferDto | undefined) => {
    if (!record) return;
    setActiveRecord(record);
    setSheet('actions');
  }, []);

  const openAdd = useCallback(() => {
    setSheet(null);
    navigation?.navigate?.('StockTransferDetail', { mode: 'add' });
  }, [navigation]);

  const confirmDelete = useCallback(async () => {
    setDialog(null);
    if (!activeRecord?.id) return;
    const res = await deleteStockTransfer(activeRecord.id);
    if (!res?.success) {
      // ⚠️ A 409 `STOCK_MOVEMENT_LOCKED` is the system protecting stock, not a failure: the
      // destination batch has been drawn from, so reversing the move would take back something
      // already sold or consumed. `deleteRefusalMessage` says that; "Could not delete" would read
      // as a bug in a screen that is working exactly as designed.
      showToast(deleteRefusalMessage(res?.code, res?.error), 'error');
      return;
    }
    // Says the stock went BACK — this is a reversal, not a tidy-up.
    showToast(deleteSuccessMessage(), 'success');
    reload();
  }, [activeRecord, deleteStockTransfer, reload, showToast]);

  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

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
      keyExtractor={(item: StockTransferRow, index: number) => String(item.id ?? index)}
      renderItem={({ item, index }: { item: StockTransferRow; index: number }) => (
        <StockTransferCard
          row={item}
          styles={styles}
          theme={theme}
          onPress={() => openDetail(listRows[index])}
          onLongPress={() => openActions(listRows[index])}
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

  // Which view gets a hero, which hero gets a CTA, and which CTA, all come from `showsFab` and the
  // view machine. Note that no hero here offers "Transfer stock" AND a FAB at the same time — see
  // `showsFab`: two Transfer affordances on one screen read as two different actions.
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
        headline="Couldn’t load transfers"
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
        icon={<ArrowLeftRight size={40} color={palette.muted} />}
        headline="No transfers yet"
        subtext="Move stock between the sellable and consumable pools without changing what you hold."
        ctaLabel="Transfer stock"
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
        headline="Search transfers"
        subtext="Find a record by product."
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
        headline="No transfers found"
        subtext={`No results for “${debouncedSearch}”. Try a different product.`}
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
        headline="No transfers match these filters"
        subtext="Nothing here for the current selection. Try widening it."
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
              placeholder="Search by product"
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
              <Text style={styles.title}>Stock Transfers</Text>
              <View style={styles.modulePill}>
                <Text style={styles.modulePillText}>
                  {moduleKey === 'PHARMACY' ? 'Pharmacy' : 'Parlour'}
                </Text>
              </View>
            </View>
            {/* No count — see `listSubtitle`. */}
            <Text style={styles.subtitle}>{listSubtitle(filtered)}</Text>
          </View>

          <View style={styles.searchRow}>
            <Pressable style={styles.searchBox} onPress={() => setMode('search')}>
              <Search size={18} color={palette.muted} />
              {/* Pinned by the mockups. */}
              <Text style={styles.searchPlaceholder}>Search by product</Text>
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
            The applied-filter chips, once the sheet has been used.

            ⚠️ There is NO reason chip row here, unlike consumption and wastage — the transfer
            controller reads no `reason` param, so chips would look like they worked and return the
            unfiltered list. `StockTransferQuery` has no such key, so adding one is a compile error
            rather than a bug report. What CAN appear is the sort order, which is the only axis the
            server narrows by. Tapping a chip clears it, matching `InventoryScreen`.
          */}
          {chips.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
            >
              {chips.map((chip) => (
                <Pressable
                  key={chip.id}
                  style={styles.appliedChip}
                  onPress={clearFilters}
                  accessibilityRole="button"
                  accessibilityLabel={`Clear filter: ${chip.label}`}
                >
                  <Text style={styles.appliedChipText}>{chip.label}</Text>
                  <X size={12} color={colors.primary} />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </>
      )}
    </CollapsingHeader>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {body}
      {header}

      {showsFab(view) ? (
        <FAB onPress={openAdd} accessibilityLabel="Transfer stock" icon={<Plus size={26} />} />
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
            The sheet body — a Sort block, and that is genuinely all the server supports.

            ⚠️ Do NOT add reason or direction chips. `reason`, `sourceType` and `destType` are all
            SORTABLE and none of them is FILTERABLE, so chips for any of them would appear to work
            and silently return the unfiltered list. `StockTransferQuery` omits the keys to make that
            a compile error.

            The Apply button carries NO count, unlike its siblings: with one axis a count could only
            ever read "1", which is furniture.
          */}
          <Text style={styles.sheetLabel}>Sort</Text>
          <View style={styles.sheetChipWrap}>
            {(['desc', 'asc'] as const).map((dir) => {
              const active = draftFilters.sortDir === dir;
              return (
                <Pressable
                  key={dir}
                  style={[styles.sheetChip, active && styles.sheetChipActive]}
                  onPress={() => setDraftFilters({ sortDir: dir })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.sheetChipText, active && styles.sheetChipTextActive]}>
                    {sortLabel(dir)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

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
            A transfer is IMMUTABLE, so the list is short — View, and Delete (which REVERSES the
            move). No status change, no edit. Every decision about the rows lives in
            `quickActionsFor`, following `batch.view.ts`'s rule that a blocked action is rendered
            DISABLED with its reason rather than hidden, because a missing row reads as a missing
            feature.
          */}
          {quickActionsFor(activeRecord).map((action) => (
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
              <View style={styles.actionBody}>
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
          title="Delete this transfer?"
          // The one sentence that must survive a copy edit: deleting moves the stock back, and it
          // can be refused once the destination batch has been drawn from.
          message="The moved quantity goes back to the pool it came from. This is refused once the destination batch has been used."
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
 * One list row: product name and an optional reason chip, then the direction, the quantity and when.
 *
 * ⚠️ The arrow is built from `row.sourceType` / `row.destType`, NEVER from `row.reason`. A record
 * can carry `reason: PRODUCT_TO_RAW` alongside `sourceType: RAW_INVENTORY` — the server accepts that
 * pairing — and a card that drew its arrow from the reason would report the move backwards forever.
 * And the `→` is NOT a quantity separator: the `·` convention applies to quantities only.
 *
 * The chip appears for the three NON-directional reasons only. "Product → Raw" as a chip beside the
 * card's own "Product → Raw" line says it twice, and says it from the untrusted source.
 *
 * Every string comes from `StockTransferRow` or a tested label function — the card never reaches
 * into the DTO, or the mapping stops being testable.
 */
function StockTransferCard({
  row,
  styles,
  theme,
  onPress,
  onLongPress,
}: {
  row: StockTransferRow;
  styles: Styles;
  theme: AppTheme;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const direction = directionLabel(row.sourceType, row.destType);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={[row.name, direction, row.qtyText].filter(Boolean).join(', ')}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={1}>
          {row.name}
        </Text>
        {showsReasonChip(row.reason) ? (
          <View style={styles.reasonChip}>
            <Text style={styles.reasonChipText}>{reasonLabel(row.reason)}</Text>
          </View>
        ) : null}
      </View>

      {direction ? (
        <View style={styles.directionRow}>
          <ArrowLeftRight size={13} color={theme.colors.primary} />
          <Text style={styles.directionText} numberOfLines={1}>
            {direction}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardFoot}>
        <Text style={styles.qtyText} numberOfLines={1}>
          {row.qtyText}
        </Text>
        {row.whenText ? (
          <Text style={styles.cardMeta} numberOfLines={1}>
            {row.whenText}
          </Text>
        ) : null}
      </View>
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
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardName: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: palette.onSurface },
    cardMeta: { fontSize: 11.5, color: palette.muted },

    // Only ever drawn for REBALANCE / CORRECTION / OTHER — see `showsReasonChip`. Neutral rather
    // than accent-tinted: it is a label, not a state.
    reasonChip: {
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: 999,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    reasonChipText: { fontSize: 10.5, fontWeight: '700', color: palette.muted },

    // The direction is the card's headline fact, so it carries the accent — it is what tells the
    // two halves of a rebalance apart at a glance.
    directionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    directionText: { fontSize: 12.5, fontWeight: '600', color: colors.primary },

    cardFoot: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    qtyText: { fontSize: 13, fontWeight: '600', color: palette.onSurface },

    // Tinted like the filter button's active state, so an applied chip reads as part of the same
    // control rather than as a new one.
    appliedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 11,
      borderRadius: 999,
      backgroundColor: colors.softBg,
      borderWidth: 1,
      borderColor: colors.primary + '55',
    },
    appliedChipText: { fontSize: 12, fontWeight: '600', color: colors.primary },

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
    // Dimmed rather than removed — see `quickActionsFor`. A missing row reads as a missing feature.
    actionRowDisabled: { opacity: 0.45 },
    actionBody: { flex: 1, gap: 2 },
    actionLabel: { fontSize: 14.5, color: palette.onSurface },
    actionLabelDestructive: { color: palette.error },
    actionSub: { fontSize: 12, color: palette.muted },
    sheetTail: { height: 4 },
  });
}
