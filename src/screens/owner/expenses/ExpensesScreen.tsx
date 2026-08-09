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
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banknote, Receipt, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../theme/theme.types';
import { AnimatedFlatList, CollapsingHeader } from '../../../components/layout/CollapsingHeader';
import { FAB } from '../../../components/layout/FAB';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { useCollapsingHeader } from '../../../hooks/useCollapsingHeader';
import { useAppContext } from '../../../context/AppContext';
import { useParlour } from '../../../backend/modules/parlour';
import { usePharmacy } from '../../../backend/modules/pharmacy';
import { getSelectedBusinessId } from '../../../backend/modules/shared/hook/useModuleService';
import { useIsTabEnabled } from '../../../backend/tab-config';
import type { ExpenseDto, ExpenseQuery } from '../../../backend/modules/shared/expense.types';
import { Badge } from '../shared/detail/parts/Badge';
import { moduleLabel } from './detail/expenseDetail.modules';
import { cardCategoryLine, cardMetaLine, formatAmount, toExpenseRow, type ExpenseRow } from './expense.model';
import {
  CATEGORY_FILTER_OPTIONS,
  DEFAULT_FILTERS,
  EMPTY_BODY,
  EMPTY_CTA,
  EMPTY_TITLE,
  ERROR_BODY,
  ERROR_CTA,
  ERROR_TITLE,
  FILTERED_EMPTY_BODY,
  FILTERED_EMPTY_TITLE,
  NO_RESULTS_BODY,
  REIMBURSEMENT_CHIPS,
  SEARCH_IDLE_BODY,
  SEARCH_IDLE_TITLE,
  SEARCH_PLACEHOLDER,
  SORT_CHOICES,
  appliedFilterChips,
  deriveExpensesView,
  hasActiveFilters,
  headerCollapses,
  listSubtitle,
  monthRangeIst,
  monthTotal,
  noResultsTitle,
  reimbursementPill,
  showsFab,
  sortChoiceKey,
  toQuery,
  type ExpenseFilters,
} from './expense.view';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const LIST_BOTTOM_PAD = 100;

// The Content column's rhythm. Applied PER ELEMENT, never on a wrapper — the list itself stays
// full-bleed so its scrollbar and overscroll reach the edge, and the chip row scrolls UNDER the
// edge rather than stopping short of it.
const SECTION_GAP = 18;
const FILTER_GAP = 12;
const CARD_GAP = 12;
const LIST_TOP_PAD = SECTION_GAP;
const SIDE_PAD = 16;

/** Frozen empties, so an unloaded slice cannot hand a fresh array to a dependency array. */
const NO_EXPENSE_ROWS: unknown[] = [];

/**
 * The module hook's expense slice, wrapped so its identity is stable.
 *
 * ⚠️ REFERENCE STABILITY IS THE CONTRACT HERE, not tidiness — the same trap wastage and stock
 * transfers hit. `rows` feeds a `useEffect` whose body calls `setRows`; an array rebuilt per render
 * makes that effect re-run, set state, re-render, and loop until React gives up. jest cannot catch
 * it: this repo's suite runs in node and never renders.
 */
function useExpenseListApi(
  activeModule: {
    expenses: unknown[];
    expensesTotalPages: number;
    loadExpenseByBusiness: (
      businessId: number,
      query?: ExpenseQuery,
      page?: number,
      limit?: number,
      append?: boolean,
    ) => Promise<{ success: boolean; error?: string | null }>;
    loadExpenseTotalByCategory: (
      businessId: number,
      from: string,
      to: string,
    ) => Promise<{ success: boolean; data?: unknown }>;
    deleteExpense: (id: number) => Promise<{ success: boolean; error?: string | null }>;
  },
  moduleKey: string,
) {
  return useMemo(
    () => ({
      rows: (activeModule.expenses ?? NO_EXPENSE_ROWS) as ExpenseDto[],
      totalPages: activeModule.expensesTotalPages ?? 1,
      load: activeModule.loadExpenseByBusiness,
      loadTotals: activeModule.loadExpenseTotalByCategory,
      remove: activeModule.deleteExpense,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeModule.expenses,
      activeModule.expensesTotalPages,
      activeModule.loadExpenseByBusiness,
      activeModule.loadExpenseTotalByCategory,
      activeModule.deleteExpense,
      moduleKey,
    ],
  );
}

interface Props {
  navigation?: { navigate?: (screen: string, params?: Record<string, unknown>) => void };
}

export function ExpensesScreen({ navigation }: Props) {
  const theme = useTheme();
  const { colors } = theme;
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const moduleKey = String(selectedModule || '').toUpperCase();
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;
  const listApi = useExpenseListApi(activeModule, moduleKey);

  // Writes are @TabGated(EXPENSES) — with the tab off, a delete 403s.
  const expensesEnabled = useIsTabEnabled('EXPENSES');

  const [businessId, setBusinessId] = useState<number | null>(null);
  const [mode, setMode] = useState<'browse' | 'search'>('browse');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<ExpenseFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ExpenseFilters>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [totals, setTotals] = useState<Record<string, number> | null>(null);
  const [sheet, setSheet] = useState<null | 'filter' | 'actions'>(null);
  const [activeRecord, setActiveRecord] = useState<ExpenseDto | null>(null);
  const [dialog, setDialog] = useState<null | 'delete'>(null);

  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const sawLoadingRef = useRef(false);

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

  const query = useMemo<ExpenseQuery>(
    () => ({ ...toQuery(filters), search: debouncedSearch || null }),
    [filters, debouncedSearch],
  );

  const load = useCallback(
    (page: number, append: boolean) => {
      if (businessId == null) return;
      pageRef.current = page;
      void listApi.load(businessId, query, page, PAGE_SIZE, append).finally(() => {
        loadingMoreRef.current = false;
      });
    },
    // ⚠️ `listApi` is called here but DELIBERATELY not a dependency, and the disable below is
    // load-bearing rather than a shortcut. Its identity changes every time a load lands (the memo
    // is keyed on `activeModule.expenses`), so depending on it makes `load` → `reload` → the effect
    // that calls `reload` → another load, forever. Verified in the browser: it fired ~5 requests a
    // second until the fix. `moduleKey` stands in for it — that is what actually decides which
    // module's callbacks these are.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [businessId, query, moduleKey],
  );

  const reload = useCallback(() => load(1, false), [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  /**
   * The month's ₹ figure for the header.
   *
   * A SECOND request, keyed on the CATEGORY only — not on the search box. `totalByCategory` takes a
   * date range and nothing else, so it cannot narrow to a search, and the line it feeds claims
   * "this month cost X" rather than describing the rows below it. See `listSubtitle`.
   */
  useEffect(() => {
    if (businessId == null) return;
    let alive = true;
    const { from, to } = monthRangeIst();
    void listApi.loadTotals(businessId, from, to).then((res) => {
      if (!alive) return;
      setTotals(res?.success ? ((res.data as Record<string, number>) ?? null) : null);
    });
    return () => {
      alive = false;
    };
    // ⚠️ Same exclusion as `load` above, and the same reason — `listApi` changes identity on every
    // landed load, so depending on it loops.
    //
    // The CATEGORY is not a dependency either, and that is deliberate: the endpoint returns all
    // fifteen keys zero-filled, so `monthTotal` reads the chosen one out of the map already here.
    // Refetching on a filter change would be a request that returns the same bytes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, moduleKey]);

  // Map the DTOs into rows whenever the slice changes.
  useEffect(() => {
    setRows(listApi.rows.map(toExpenseRow));
  }, [listApi.rows]);

  // Track the loading true→false TRANSITION rather than the flag, so the empty hero cannot flash
  // before the first response has landed.
  useEffect(() => {
    if (activeModule.loading) sawLoadingRef.current = true;
    else if (sawLoadingRef.current) setLoadedOnce(true);
  }, [activeModule.loading]);

  const onEndReached = useCallback(() => {
    if (loadingMoreRef.current || activeModule.loading) return;
    // `totalPages` is the ONLY stop signal — the endpoint reports no row count, so nothing else can
    // say "there is no page 5". Asking anyway returns an empty array on a good day and a 400 on a
    // bad one.
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

  const view = deriveExpensesView({
    mode,
    loading: activeModule.loading,
    loadedOnce,
    hasError: !!activeModule.error && rows.length === 0,
    hasRows: rows.length > 0,
    hasQuery: !!debouncedSearch,
    filtered,
  });

  const { headerProps, listProps, headerHeight } = useCollapsingHeader({
    pinned: !headerCollapses(view),
    refreshing,
    contentBottomPadding: insets.bottom + LIST_BOTTOM_PAD,
  });

  const subtitle = listSubtitle(monthTotal(totals, filters.category), filters.category, (n) =>
    formatAmount(n),
  );

  const openDetail = useCallback(
    (record: ExpenseDto) => {
      // Close BEFORE navigating — a Modal left mounted over a screen transition eats the taps on
      // the screen you land on.
      setSheet(null);
      navigation?.navigate?.('ExpenseDetail', { expenseId: record.id, mode: 'view' });
    },
    [navigation],
  );

  const openAdd = useCallback(() => {
    setSheet(null);
    navigation?.navigate?.('ExpenseDetail', { mode: 'add' });
  }, [navigation]);

  const openActions = useCallback((record: ExpenseDto) => {
    setActiveRecord(record);
    setSheet('actions');
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!activeRecord?.id) return;
    setDialog(null);
    const res = await listApi.remove(activeRecord.id);
    setActiveRecord(null);
    if (res?.success) reload();
  }, [activeRecord, listApi, reload]);

  const bodyInset: StyleProp<ViewStyle> = { paddingTop: headerHeight + LIST_TOP_PAD };

  const list = (
    <AnimatedFlatList
      {...listProps}
      // On react-native-web this maps to `scrollbar-width`. Without it the list keeps a 15px gutter
      // the header (an absolute overlay) does not, so every card sits narrower than the search box.
      showsVerticalScrollIndicator={false}
      data={rows}
      keyExtractor={(item: ExpenseRow, index: number) => String(item.id ?? index)}
      renderItem={({ item, index }: { item: ExpenseRow; index: number }) => (
        <ExpenseCard
          row={item}
          styles={styles}
          theme={theme}
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
      <View style={[styles.bodyPad, bodyInset]}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonRow key={i} styles={styles} />
        ))}
      </View>
    );
  } else if (view === 'ERROR') {
    body = (
      <View style={[styles.bodyPad, bodyInset]}>
        <HeroBlock
          styles={styles}
          title={ERROR_TITLE}
          body={ERROR_BODY}
          ctaLabel={ERROR_CTA}
          onPress={reload}
        />
      </View>
    );
  } else if (view === 'EMPTY') {
    body = (
      <View style={[styles.bodyPad, bodyInset]}>
        <HeroBlock
          styles={styles}
          title={EMPTY_TITLE}
          body={EMPTY_BODY}
          ctaLabel={EMPTY_CTA}
          onPress={openAdd}
        />
      </View>
    );
  } else if (view === 'FILTERED_EMPTY') {
    body = (
      <View style={[styles.bodyPad, bodyInset]}>
        <HeroBlock
          styles={styles}
          title={FILTERED_EMPTY_TITLE}
          body={`${FILTERED_EMPTY_BODY}${
            appliedFilterChips(filters).length
              ? ` (${appliedFilterChips(filters).join(', ')})`
              : ''
          }`}
          ctaLabel="Clear filters"
          onPress={() => setFilters(DEFAULT_FILTERS)}
        />
      </View>
    );
  } else if (view === 'SEARCH_IDLE') {
    body = (
      <View style={[styles.bodyPad, bodyInset]}>
        <HeroBlock styles={styles} title={SEARCH_IDLE_TITLE} body={SEARCH_IDLE_BODY} />
      </View>
    );
  } else if (view === 'SEARCHING') {
    body = (
      <View style={[styles.bodyPad, bodyInset]}>
        {[0, 1, 2].map((i) => (
          <SkeletonRow key={i} styles={styles} />
        ))}
      </View>
    );
  } else if (view === 'NO_RESULTS') {
    body = (
      <View style={[styles.bodyPad, bodyInset]}>
        <HeroBlock
          styles={styles}
          title={noResultsTitle(debouncedSearch)}
          body={NO_RESULTS_BODY}
        />
      </View>
    );
  } else {
    body = list;
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/* Body FIRST — the header is an absolute overlay. */}
      {body}

      <CollapsingHeader
        {...headerProps}
        backgroundColor={theme.palette.background}
        gapBelow={LIST_TOP_PAD}
      >
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Expenses</Text>
            <Badge label={moduleLabel(moduleKey)} tone="accent" />
          </View>
          {/* Rendered only when the figure is known — the header never claims a number it does not
              have, and there is no record COUNT here at all: the endpoint reports none. */}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={17} color={theme.palette.muted} />
            <TextInput
              value={search}
              onChangeText={(t) => {
                setSearch(t);
                setMode(t ? 'search' : 'browse');
              }}
              placeholder={SEARCH_PLACEHOLDER}
              placeholderTextColor={theme.palette.muted}
              style={styles.searchInput}
              autoCorrect={false}
              accessibilityLabel={SEARCH_PLACEHOLDER}
            />
            {search ? (
              <Pressable
                onPress={() => {
                  setSearch('');
                  setMode('browse');
                }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <X size={16} color={theme.palette.muted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => {
              setDraftFilters(filters);
              setSheet('filter');
            }}
            style={[styles.filterButton, filtered && styles.filterButtonActive]}
            accessibilityRole="button"
            accessibilityLabel="Filters"
          >
            <SlidersHorizontal size={19} color={filtered ? colors.primary : theme.palette.muted} />
          </Pressable>
        </View>

        {/* Reimbursement stays inline — two states fit. Category moved into the sheet: fifteen do
            not, and a curated five could not filter to Insurance or Taxes at all. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
          {REIMBURSEMENT_CHIPS.map((chip) => {
            const active = filters.reimbursement === chip.key;
            return (
              <Pressable
                key={chip.key}
                onPress={() => setFilters((prev) => ({ ...prev, reimbursement: chip.key }))}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </CollapsingHeader>

      {showsFab(view) ? <FAB onPress={openAdd} accessibilityLabel="Record expense" /> : null}

      {sheet === 'filter' ? (
        <FilterSheet
          draft={draftFilters}
          styles={styles}
          insets={insets}
          onChange={setDraftFilters}
          onReset={() => setDraftFilters(DEFAULT_FILTERS)}
          onApply={() => {
            setFilters(draftFilters);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'actions' && activeRecord ? (
        <SheetShell styles={styles} insets={insets} onClose={() => setSheet(null)}>
          <Text style={styles.sheetTitle}>{activeRecord.title}</Text>
          <Pressable
            style={styles.sheetAction}
            onPress={() => openDetail(activeRecord)}
            accessibilityRole="button"
          >
            <Text style={styles.sheetActionLabel}>View details</Text>
          </Pressable>
          {expensesEnabled ? (
            <Pressable
              style={styles.sheetAction}
              onPress={() => {
                setSheet(null);
                setDialog('delete');
              }}
              accessibilityRole="button"
            >
              <Text style={styles.sheetActionDanger}>Delete</Text>
            </Pressable>
          ) : null}
        </SheetShell>
      ) : null}

      {dialog === 'delete' ? (
        <ConfirmDialog
          visible
          title="Delete this expense?"
          message="This removes the record. It cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => {
            setDialog(null);
            setActiveRecord(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ─── File-local pieces ───────────────────────────────────────────────────────

type Styles = ReturnType<typeof createStyles>;

function ExpenseCard({
  row,
  styles,
  theme,
  onPress,
  onLongPress,
}: {
  row: ExpenseRow;
  styles: Styles;
  theme: AppTheme;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const pill = reimbursementPill(row.reimbursement);
  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.title}, ${row.amountText}, ${row.categoryText}`}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {row.title}
        </Text>
        <Text style={styles.cardAmount}>{row.amountText}</Text>
      </View>
      <Text style={styles.cardCategory} numberOfLines={1}>
        {cardCategoryLine(row)}
      </Text>
      <View style={styles.cardBottomRow}>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {cardMetaLine(row)}
        </Text>
        <View style={styles.cardTrailing}>
          {row.hasReceipt ? <Receipt size={14} color={theme.palette.muted} /> : null}
          {pill ? <Badge label={pill.label} tone={pill.tone} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function SheetShell({
  styles,
  insets,
  onClose,
  children,
}: {
  styles: Styles;
  insets: { bottom: number };
  onClose: () => void;
  children: React.ReactNode;
}) {
  // ⚠️ A Modal renders outside SafeAreaView and gets no inset from anywhere; the bottom one is read
  // and applied here.
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

function FilterSheet({
  draft,
  styles,
  insets,
  onChange,
  onReset,
  onApply,
  onClose,
}: {
  draft: ExpenseFilters;
  styles: Styles;
  insets: { bottom: number };
  onChange: (next: ExpenseFilters) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const chosenSort = sortChoiceKey(draft);
  return (
    <SheetShell styles={styles} insets={insets} onClose={onClose}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Filters</Text>
        <Pressable onPress={onReset} accessibilityRole="button" accessibilityLabel="Reset filters">
          <Text style={styles.sheetReset}>Reset</Text>
        </Pressable>
      </View>

      <ScrollView bounces={false} style={styles.sheetScroll}>
        <Text style={styles.sheetLabel}>Category</Text>
        <View style={styles.sheetChipWrap}>
          {CATEGORY_FILTER_OPTIONS.map((option) => {
            const active = draft.category === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onChange({ ...draft, category: option.value })}
                style={[styles.sheetChip, active && styles.sheetChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.sheetChipLabel, active && styles.sheetChipLabelActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sheetLabel}>Sort</Text>
        <View style={styles.sheetChipWrap}>
          {SORT_CHOICES.map((choice) => {
            const active = chosenSort === choice.key;
            return (
              <Pressable
                key={choice.key}
                onPress={() =>
                  onChange({ ...draft, sortBy: choice.sortBy, sortDir: choice.sortDir })
                }
                style={[styles.sheetChip, active && styles.sheetChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.sheetChipLabel, active && styles.sheetChipLabelActive]}>
                  {choice.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* No count on Apply — nothing reports one. */}
      <Pressable
        onPress={onApply}
        style={styles.applyButton}
        accessibilityRole="button"
        accessibilityLabel="Apply filters"
      >
        <Text style={styles.applyLabel}>Apply</Text>
      </Pressable>
    </SheetShell>
  );
}

function HeroBlock({
  styles,
  title,
  body,
  ctaLabel,
  onPress,
}: {
  styles: Styles;
  title: string;
  body: string;
  ctaLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroIcon}>
        <Banknote size={22} color="#F97316" />
      </View>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroBody}>{body}</Text>
      {ctaLabel && onPress ? (
        <Pressable
          onPress={onPress}
          style={styles.heroCta}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={styles.heroCtaLabel}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SkeletonRow({ styles }: { styles: Styles }) {
  return (
    <View style={styles.skeleton}>
      <View style={styles.skeletonLineWide} />
      <View style={styles.skeletonLine} />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, palette } = theme;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },

    titleBlock: { marginBottom: SECTION_GAP, paddingHorizontal: SIDE_PAD, gap: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { fontSize: 26, fontWeight: '800', color: palette.onBackground },
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
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    searchInput: { flex: 1, fontSize: 13.5, color: palette.onSurface, padding: 0 },
    filterButton: {
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    filterButtonActive: { borderColor: colors.border, backgroundColor: colors.softBg },

    // `flexShrink: 0` is load-bearing — without it the row collapses inside the header column.
    chipScroll: { marginBottom: FILTER_GAP, flexShrink: 0 },
    chipRow: { gap: 8, paddingHorizontal: SIDE_PAD },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    chipActive: { backgroundColor: colors.softBg, borderColor: colors.border },
    chipLabel: { fontSize: 13, fontWeight: '500', color: palette.muted },
    chipLabelActive: { color: colors.primary, fontWeight: '600' },

    // marginHorizontal, not a wrapper padding — the list stays full-bleed.
    card: {
      marginHorizontal: SIDE_PAD,
      marginBottom: CARD_GAP,
      padding: 14,
      borderRadius: 16,
      gap: 8,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: palette.onSurface },
    cardAmount: { fontSize: 15, fontWeight: '800', color: palette.onBackground },
    cardCategory: { fontSize: 12, color: palette.muted },
    cardBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardMeta: { flex: 1, fontSize: 11.5, color: palette.muted },
    cardTrailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },

    bodyPad: { flex: 1, paddingHorizontal: SIDE_PAD },
    footerSpinner: { marginVertical: 18 },

    hero: { alignItems: 'center', gap: 10, paddingVertical: 40 },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.softBg,
    },
    heroTitle: { fontSize: 16, fontWeight: '700', color: palette.onBackground },
    heroBody: { fontSize: 13, color: palette.muted, textAlign: 'center', lineHeight: 19 },
    heroCta: {
      marginTop: 6,
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    heroCtaLabel: { fontSize: 13.5, fontWeight: '700', color: colors.onAccent ?? '#FFFFFF' },

    skeleton: {
      marginBottom: CARD_GAP,
      padding: 14,
      borderRadius: 16,
      gap: 10,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    skeletonLineWide: {
      height: 12,
      width: '65%',
      borderRadius: 6,
      backgroundColor: palette.surfaceElevated,
    },
    skeletonLine: {
      height: 10,
      width: '40%',
      borderRadius: 5,
      backgroundColor: palette.surfaceElevated,
    },

    sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: palette.overlay },
    sheet: {
      maxHeight: '80%',
      paddingHorizontal: SIDE_PAD,
      paddingTop: 10,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: palette.surface,
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      marginBottom: 14,
      backgroundColor: palette.divider,
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sheetTitle: { fontSize: 16, fontWeight: '700', color: palette.onBackground },
    sheetReset: { fontSize: 13, fontWeight: '600', color: colors.primary },
    sheetScroll: { marginTop: 6 },
    sheetLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: palette.muted,
      marginTop: 14,
      marginBottom: 10,
    },
    sheetChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    sheetChip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    sheetChipActive: { backgroundColor: colors.softBg, borderColor: colors.border },
    sheetChipLabel: { fontSize: 13, fontWeight: '500', color: palette.muted },
    sheetChipLabelActive: { color: colors.primary, fontWeight: '600' },
    applyButton: {
      marginTop: 16,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    applyLabel: { fontSize: 14, fontWeight: '700', color: colors.onAccent ?? '#FFFFFF' },

    sheetAction: {
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: palette.divider,
      marginTop: 10,
    },
    sheetActionLabel: { fontSize: 14, fontWeight: '600', color: palette.onSurface },
    sheetActionDanger: { fontSize: 14, fontWeight: '600', color: palette.error },
  });
}
