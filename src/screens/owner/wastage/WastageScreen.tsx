import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
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
import type { WastageDto, WastageQuery } from '../../../backend/modules/shared/wastage.types';
import type { AppTheme } from '../../../theme/theme.types';
import { listSubtitle, toWastageRow, type WastageRow } from './wastage.model';
import {
  DEFAULT_FILTERS,
  deriveWastageView,
  hasActiveFilters,
  headerCollapses,
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
 * FEATURE: the module-hook wiring — do this FIRST.
 *
 * `useModuleService.ts` carries a labelled but EMPTY `─── Wastage ───` region at each of its four
 * edit sites, and this adapter stands in until it is filled, so that everything else on this screen
 * (paging, debounce, refresh, the view machine, the first-focus skip) is real code rather than a
 * sketch.
 *
 * To finish it: fill those four regions by copying the consumption slice, then replace the four
 * bodies below with `activeModule.wastages`, `.wastagesTotalPages`, `.loadWastageByBusiness` and
 * `.deleteWastage` and delete this function. The signatures already match
 * `loadConsumptionsByBusiness` exactly.
 *
 * Until then the screen sits on its LOADING skeleton, which is correct rather than broken: nothing
 * has been requested, so `loadedOnce` is false, and claiming "No wastage yet" about data we never
 * asked for would be a lie.
 */
/**
 * Frozen so the stub cannot spin the screen.
 *
 * `rows` feeds a `useEffect` dependency. Returning a fresh `[]` from this function meant a new
 * array identity on every render, so the effect re-ran, called `setRows` with another new array,
 * re-rendered, and looped until React gave up with "Maximum update depth exceeded". Jest never
 * renders anything in this repo, so nothing caught it — the whole suite stayed green.
 *
 * The replacement must keep this property: whatever `rows` becomes, it has to be a value that is
 * reference-stable between renders when the data has not changed.
 */
const NO_WASTAGE_ROWS: WastageDto[] = [];

function useWastageListApi(_activeModule: unknown) {
  return useMemo(
    () => ({
      rows: NO_WASTAGE_ROWS,
      totalPages: 1,
      load: (
        _businessId: number,
        _query: WastageQuery & { search: string | null },
        _page: number,
        _limit: number,
        _append: boolean,
      ) => {},
      remove: async (_id: number): Promise<{ success: boolean; error?: string | null }> => ({
        success: false,
        error: 'Wastage is not wired to the module hook yet.',
      }),
    }),
    [],
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
  const listApi = useWastageListApi(activeModule);

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

  // FEATURE: the base unit is the PRODUCT's, not a constant — resolve it per row once the list
  // FEATURE: response is known to carry one (or hydrate it from the catalog).
  const baseUnit = 'unit';
  const listRows = listApi.rows;
  useEffect(() => {
    setRows(listRows.map((w) => toWastageRow(w, baseUnit)));
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
    // FEATURE: the toast copy. Say that the stock came BACK — a delete here is a reversal, and a
    // FEATURE: bare "Deleted" hides the thing the user most needs to know.
    showToast('Wastage deleted', 'success');
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRecord, moduleKey, reload, showToast]);

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

  // FEATURE: every headline and subtext below. The STRUCTURE — which view gets a hero, which hero
  // FEATURE: gets a CTA, and which CTA — is settled; only the words are open.
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
        subtext="Nothing here for the selected reason. Try widening it."
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
            <Text style={styles.subtitle}>{listSubtitle(filtered)}</Text>
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
            FEATURE: the reason chip row, and the applied-filter chips that replace it once the
            FEATURE: sheet has been used. Model both on InventoryScreen's pair — a horizontal
            FEATURE: ScrollView with `styles.chipScroll` / `styles.chipRow`, whose gutter is
            FEATURE: horizontal PADDING on the scroll content so chips scroll under the edge.
            FEATURE: ⚠️ Render from `WASTAGE_REASON_CHOICES` (seven), not `WASTAGE_REASONS` (eight):
            FEATURE: CORRECTION is a value the system writes, not one a person may pick.
            FEATURE: There are no per-chip counts, because no endpoint reports any.
          */}
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
            FEATURE: the sheet body — a Reason block over a Sort block. Chips come from
            FEATURE: `WASTAGE_REASON_CHOICES` plus an 'ALL' head; sort is the two directions.
            FEATURE: ⚠️ Do NOT add a Product/Raw toggle. `inventoryType` is on every record and is
            FEATURE: sortable, which makes the toggle the obvious thing to build — and the endpoint
            FEATURE: reads no such param, so it would look like it worked and return everything.
            FEATURE: The Apply button carries NO count — nothing reports one.
          */}

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
            FEATURE: the actions sheet body. A wastage is IMMUTABLE, so the list is short — View
            FEATURE: detail, and Delete (which RESTOCKS). No status change, no edit. Drive it from a
            FEATURE: `quickActionsFor` in `wastage.view.ts`, following `batch.view.ts`'s rule that a
            FEATURE: blocked action is disabled WITH A REASON rather than hidden.
          */}
          <Pressable style={styles.actionRow} onPress={() => openDetail(activeRecord)}>
            <Text style={styles.actionLabel}>View wastage</Text>
          </Pressable>
          <Pressable
            style={styles.actionRow}
            onPress={() => {
              setSheet(null);
              setDialog('delete');
            }}
          >
            <Text style={[styles.actionLabel, styles.actionLabelDestructive]}>Delete wastage</Text>
          </Pressable>
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
 * FEATURE: the card.
 *
 * The mockup's row is: item name, the written-off quantity, a reason chip, the pool it came out of,
 * and the timestamp. This placeholder draws the strings the model already produces so the list is
 * navigable while the real card is built; it is not the design.
 *
 * Keep every string it shows coming from `WastageRow` — the card must not reach into the DTO, or
 * the mapping stops being testable.
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
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.qtyText}`}
    >
      <Text style={styles.cardName} numberOfLines={1}>
        {row.name}
      </Text>
      <Text style={styles.cardMeta} numberOfLines={1}>
        {row.qtyText}
      </Text>
      {row.whenText ? (
        <Text style={styles.cardMeta} numberOfLines={1}>
          {row.whenText}
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
    cardName: { fontSize: 15, fontWeight: '600', color: palette.onSurface },
    cardMeta: { fontSize: 11.5, color: palette.muted },

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
    actionLabel: { fontSize: 14.5, color: palette.onSurface },
    actionLabelDestructive: { color: palette.error },
    sheetTail: { height: 4 },
  });
}
