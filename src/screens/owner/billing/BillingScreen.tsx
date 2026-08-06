import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  AppState,
  type AppStateStatus,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  X,
  Wallet,
  Receipt,
  CircleX,
  CircleCheck,
  CircleDashed,
  Ban,
  FilePen,
  Download,
  Share2,
  Lock,
} from 'lucide-react-native';
import { FAB } from '../../../components/layout/FAB';
import { CollapsingHeader, AnimatedSectionList } from '../../../components/layout/CollapsingHeader';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { useTheme } from '../../../hooks/useTheme';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { useCollapsingHeader } from '../../../hooks/useCollapsingHeader';
import { useToast } from '../../../hooks/useToast';
import type { AppTheme } from '../../../theme/theme.types';
import { useAppContext } from '../../../context/AppContext';
import { useParlour } from '../../../backend/modules/parlour';
import { usePharmacy } from '../../../backend/modules/pharmacy';
import type { BillListOptions } from '../../../backend/modules/shared/hook/useModuleService';
import {
  toBillRow,
  istToday,
  groupBillsByDay,
  formatAmount,
  formatCompactAmount,
  billsHeaderLine,
  BILL_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type BillRow,
} from './bill.model';
import {
  deriveBillView,
  showsBillFab,
  showsBillChips,
  billHeaderCollapses,
  quickActionsFor,
  type QuickAction,
} from './bill.view';

const PAGE_SIZE = 20;

/** Gap between the collapsing header and the first row. Lives on the header — see `gapBelow`. */
const LIST_TOP_PAD = 12;

/**
 * How far the wallet popover rides UP over the bottom of the title row.
 *
 * Taken from the mockup, where the card's top edge (y=118) lands inside the subtitle (109–125),
 * clipping its last few pixels. That overlap is deliberate: it tucks the card under the title
 * rather than parking it in the gap below, so the popover reads as belonging to the header instead
 * of floating loose over the list. Anchoring cleanly below the subtitle — which is what this
 * screen did first — loses that and leaves an oddly wide gap.
 */
const WALLET_TITLE_OVERLAP = 7;
/** FAB clearance, so the last card is never trapped under it. */
const LIST_BOTTOM_PAD = 100;

/**
 * The payment-status chips. `null` is "All" — no filter.
 *
 * Only the three the mockup draws. The remaining statuses (refunds, failed) still render their own
 * pill on a row; they simply have no chip, which is the same sparse-chip rule Orders follows.
 */
const CHIPS: { key: string | null; label: string }[] = [
  { key: null, label: 'All' },
  { key: 'PAID', label: 'Paid' },
  { key: 'UNPAID', label: 'Unpaid' },
];

interface BillingScreenProps {
  /** Optional so the web preview can mount the list standalone, with no navigator around it. */
  navigation?: {
    navigate: (route: string, params?: Record<string, unknown>) => void;
    addListener?: (event: string, cb: () => void) => () => void;
  };
}

export function BillingScreen({ navigation }: BillingScreenProps = {}) {
  const theme = useTheme();
  const { colors, palette } = theme;
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const moduleKey = selectedModule === 'PHARMACY' ? 'PHARMACY' : 'PARLOUR';
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;

  const [rows, setRows] = useState<BillRow[]>([]);
  const [mode, setMode] = useState<'browse' | 'search'>('browse');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [chip, setChip] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  /** Height of the title row, so the wallet popover can anchor just beneath it. */
  const [titleH, setTitleH] = useState(0);

  const [sheet, setSheet] = useState<null | 'actions' | 'amount'>(null);
  const [activeBill, setActiveBill] = useState<BillRow | null>(null);
  const [pendingAction, setPendingAction] = useState<QuickAction | null>(null);
  const [dialog, setDialog] = useState<null | 'cancel' | 'finalize'>(null);

  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);

  /**
   * Today, in IST.
   *
   * NOT frozen at mount: a screen left open overnight would keep labelling yesterday's bills
   * "TODAY". Recomputed whenever the app returns to the foreground, which is the only moment a
   * phone realistically crosses midnight with this screen still mounted.
   */
  const [today, setToday] = useState(() => istToday());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') setToday(istToday());
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const listOpts = useMemo<BillListOptions>(
    () =>
      mode === 'search'
        ? // Search spans every status — a stale chip must not silently narrow the results.
          { search: debouncedSearch, sortBy: 'billDate', sortDir: 'desc' }
        : {
            ...(chip ? { paymentStatus: chip } : {}),
            sortBy: 'billDate',
            sortDir: 'desc',
          },
    [mode, debouncedSearch, chip],
  );

  const reload = useCallback(() => {
    pageRef.current = 1;
    activeModule.loadBills(1, PAGE_SIZE, listOpts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listOpts, moduleKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Summary is independent of the list filters: the chips have to keep showing every count even
  // while one of them is selected, or selecting "Paid" would blank the "Unpaid" number.
  useEffect(() => {
    activeModule.loadBillSummary?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  useEffect(() => {
    const mapped = (activeModule.bills as any[]).map(toBillRow);
    setRows((prev) => (pageRef.current <= 1 ? mapped : [...prev, ...mapped]));
    loadingMoreRef.current = false;
  }, [activeModule.bills]);

  /**
   * "The first load finished" — the gate between LOADING and EMPTY.
   *
   * Tracks the loading true → false TRANSITION, not the flag: `loading` is false on the very first
   * render, so a plain `!loading` marks the screen loaded before any request exists and flashes
   * EMPTY over a business with plenty of bills.
   */
  const sawLoadingRef = useRef(false);
  useEffect(() => {
    if (activeModule.loading) sawLoadingRef.current = true;
    else if (sawLoadingRef.current) {
      sawLoadingRef.current = false;
      setLoadedOnce(true);
    }
  }, [activeModule.loading]);

  const onEndReached = useCallback(() => {
    if (loadingMoreRef.current || activeModule.loading) return;
    if (pageRef.current >= (activeModule.billsTotalPages || 1)) return;
    loadingMoreRef.current = true;
    pageRef.current += 1;
    activeModule.loadBills(pageRef.current, PAGE_SIZE, listOpts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listOpts, activeModule.loading, activeModule.billsTotalPages]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setToday(istToday());
    pageRef.current = 1;
    await Promise.all([
      activeModule.loadBills(1, PAGE_SIZE, listOpts),
      activeModule.loadBillSummary?.() ?? Promise.resolve(),
    ]);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listOpts]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const summary = activeModule.billSummary;
  const errored = !!activeModule.error && rows.length === 0 && loadedOnce;

  const view = deriveBillView({
    mode,
    query: debouncedSearch,
    rowCount: rows.length,
    loadedOnce,
    hasError: errored,
    filtered: chip !== null,
  });

  const sections = useMemo(() => groupBillsByDay(rows, today), [rows, today]);

  const chipCount = useCallback(
    (key: string | null) =>
      key === null ? summary?.totalBills : summary?.countsByPaymentStatus?.[key],
    [summary],
  );

  const { headerProps, listProps, headerHeight } = useCollapsingHeader({
    pinned: !billHeaderCollapses(view),
    refreshing,
    contentBottomPadding: LIST_BOTTOM_PAD,
  });
  const bodyInset = useMemo(() => ({ paddingTop: headerHeight }), [headerHeight]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const closeSheets = useCallback(() => {
    setSheet(null);
    setActiveBill(null);
    setPendingAction(null);
    setDialog(null);
  }, []);

  const afterWrite = useCallback(() => {
    // Both the list AND the summary: a status change moves a bill between chips and shifts the
    // outstanding figure, so refreshing one without the other leaves the header contradicting the
    // rows beneath it.
    reload();
    activeModule.loadBillSummary?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  /**
   * Refetch on RETURN from the detail screen — `afterWrite`, not `reload`, for the reason above:
   * a bill created or finalized elsewhere moves the chip counts and the outstanding total too.
   *
   * Skips the FIRST focus, since the mount effect already fetched and firing both lets the slower
   * response overwrite the newer rows. A ref rather than state so it survives the re-subscription
   * when `afterWrite`'s identity changes; `addListener` rather than `useFocusEffect` because this
   * screen is also mounted standalone in the web preview.
   */
  const hasFocusedRef = useRef(false);
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        return;
      }
      afterWrite();
    });
    return unsubscribe;
  }, [navigation, afterWrite]);

  /**
   * Everything that must come down before the stack pushes.
   *
   * `closeSheets` alone is not enough — the wallet popover is separate state and would ride onto
   * the detail screen. On react-native-web a Modal's portal outlives `visible: false`, so any
   * overlay still open at navigate time becomes a tap-eating ghost over the next route.
   */
  const closeForNavigation = useCallback(() => {
    closeSheets();
    setWalletOpen(false);
  }, [closeSheets]);

  /** Tapping a row opens the record; the quick-actions sheet moves to a long press. */
  const openDetail = useCallback(
    (bill: BillRow) => {
      closeForNavigation();
      navigation?.navigate('BillDetail', { billId: bill.id, mode: 'view' });
    },
    [closeForNavigation, navigation],
  );

  const onAdd = useCallback(() => {
    closeForNavigation();
    navigation?.navigate('BillDetail', { mode: 'add' });
  }, [closeForNavigation, navigation]);

  const runAction = useCallback(
    async (bill: BillRow, action: QuickAction, amount?: number) => {
      // Dismiss first. The action either succeeds — in which case the sheet is stale — or is
      // refused, and leaving it up invites a retry loop against a rule that will not budge.
      closeSheets();

      const res =
        action.axis === 'bill'
          ? await activeModule.updateBillStatus?.(bill.id, action.key)
          : await activeModule.updateBillPayment?.(bill.id, action.key, {
              ...(action.key === 'PARTIALLY_PAID' ? { paidAmount: amount } : {}),
            });

      if (res?.success) {
        afterWrite();
        return;
      }

      // STATE_CONFLICT is the server refusing a transition it cannot honour — today that is only
      // draft-from-cancelled, whose items were already released. Worth saying why rather than
      // showing a generic failure.
      const conflict = (res as { code?: string } | undefined)?.code === 'STATE_CONFLICT';
      showToast(
        conflict
          ? 'This bill was cancelled — its items were released and its stock returned, so it cannot go back to draft. Create a new bill instead.'
          : (res?.error as string) || 'Something went wrong. Please try again.',
        'error',
        {
          title: action.axis === 'bill' ? "Couldn't update bill" : "Couldn't update payment",
          // Longer than the 3500ms default: the conflict message is three lines and tells the user
          // to go and do something else.
          duration: conflict ? 6000 : 4000,
        },
      );
    },
    [activeModule, afterWrite, closeSheets, showToast],
  );

  const onPickAction = useCallback(
    (action: QuickAction) => {
      if (!activeBill) return;
      if (action.confirm) {
        setPendingAction(action);
        // Drop the sheet before raising the dialog. Two stacked Modals leave the sheet painted
        // over the dialog — the dialog mounts, the user sees nothing, and confirming reads as a
        // dead tap. Only `sheet` is cleared: the dialog still needs activeBill and pendingAction.
        setSheet(null);
        setDialog(action.confirm);
        return;
      }
      if (action.needsAmount) {
        setPendingAction(action);
        // Swaps rather than stacks, so this path was never affected.
        setSheet('amount');
        return;
      }
      runAction(activeBill, action);
    },
    [activeBill, runAction],
  );

  // ── Row ────────────────────────────────────────────────────────────────────

  const renderRow = useCallback(
    (item: BillRow) => {
      const bs = theme.status[item.billStatus] ?? theme.status.FALLBACK;
      const ps = theme.status[item.paymentStatus] ?? theme.status.FALLBACK;
      const pair = theme.avatar.forName(item.customerName);

      return (
        <Pressable
          onPress={() => openDetail(item)}
          onLongPress={() => {
            setActiveBill(item);
            setSheet('actions');
          }}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          android_ripple={{ color: palette.divider }}
          accessibilityRole="button"
          accessibilityLabel={`${item.billNumber} · ${item.customerName}`}
        >
          <View style={[styles.avatar, { backgroundColor: pair.bg }]}>
            <Text style={[styles.avatarText, { color: pair.text }]}>
              {initials(item.customerName)}
            </Text>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.customerName}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.billNumber}
            </Text>
          </View>

          <View style={styles.cardRight}>
            <Text style={styles.amount}>{formatAmount(item.amount)}</Text>
            <View style={styles.pillRow}>
              <View style={[styles.pill, { backgroundColor: bs.bg }]}>
                <Text style={[styles.pillText, { color: bs.text }]}>
                  {BILL_STATUS_LABEL[item.billStatus] ?? item.billStatus}
                </Text>
              </View>
              <View style={[styles.pill, { backgroundColor: ps.bg }]}>
                <Text style={[styles.pillText, { color: ps.text }]}>
                  {PAYMENT_STATUS_LABEL[item.paymentStatus] ?? item.paymentStatus}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [theme, styles, palette.divider, openDetail],
  );

  // ── Body ───────────────────────────────────────────────────────────────────

  const footer =
    activeModule.loading && rows.length > 0 ? (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    ) : null;

  let body: React.ReactNode;

  if (view === 'ERROR') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<CircleX size={40} color={palette.muted} />}
        headline="Couldn't load bills"
        sub="Something went wrong while loading. Check your connection and try again."
        ctaLabel="Retry"
        onCta={reload}
        colors={colors}
      />
    );
  } else if (view === 'LOADING' || view === 'SEARCHING') {
    body = (
      <View style={[styles.skeletonWrap, bodyInset]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonRow key={i} styles={styles} />
        ))}
      </View>
    );
  } else if (view === 'SEARCH_IDLE') {
    body = <View style={styles.idleBody} />;
  } else if (view === 'NO_RESULTS') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<Search size={40} color={palette.muted} />}
        headline="No bills found"
        // Not "try a different name": the backend matches bill number, phone, email and the
        // numeric id — never customer name. Suggesting a name points at the one thing that cannot
        // work, which is the trap the Orders and Appointments copy already fell into.
        sub={`No bills match '${debouncedSearch}'. Try a phone number, email or bill number.`}
        colors={colors}
      />
    );
  } else if (view === 'FILTERED_EMPTY') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<Receipt size={40} color={palette.muted} />}
        headline="No bills match this filter"
        sub="Nothing here with that payment status. Clear the filter to see every bill."
        ctaLabel="Clear filter"
        onCta={() => setChip(null)}
        colors={colors}
      />
    );
  } else if (view === 'EMPTY') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<Receipt size={40} color={palette.muted} />}
        headline="No bills yet"
        sub="Bills you create will appear here. Create your first bill to get started."
        ctaLabel="Create Bill"
        onCta={onAdd}
        colors={colors}
      />
    );
  } else {
    body = (
      <AnimatedSectionList
        {...listProps}
        sections={sections}
        keyExtractor={(item: BillRow) => String(item.id)}
        // Explicit: the default is true on iOS, which would pin these opaque headers behind the
        // overlay header and then pop them into view as it collapses.
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }: { section: { title: string; data: BillRow[] } }) =>
          // Search results span every date, so a day heading there is noise rather than structure.
          isSearch(view) ? null : (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>
                {section.data.length} bill{section.data.length === 1 ? '' : 's'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }: { item: BillRow }) => renderRow(item)}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressViewOffset={headerHeight}
          />
        }
        ListFooterComponent={footer}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  const searching = mode === 'search';

  // ── Header ─────────────────────────────────────────────────────────────────

  const header = (
    <CollapsingHeader {...headerProps} backgroundColor={palette.background} gapBelow={LIST_TOP_PAD}>
      {searching ? (
        <View style={styles.searchHeader}>
          <View style={styles.searchField}>
            <Search size={17} color={palette.muted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by phone, email or bill no…"
              placeholderTextColor={palette.muted}
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
              setDebouncedSearch('');
            }}
            hitSlop={8}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View
            style={styles.titleRow}
            // Measured so the wallet popover can hang directly beneath the title, which is where
            // the mockup anchors it — deliberately over the search row and chips, not below them.
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (Math.abs(h - titleH) > 0.5) setTitleH(h);
            }}
          >
            <View style={styles.titleBlock}>
              <Text style={styles.title}>Billing</Text>
              <Text style={styles.subtitle}>
                {billsHeaderLine(
                  summary?.totalBills ?? rows.length,
                  summary?.totalOutstanding ?? 0,
                )}
              </Text>
            </View>
            <Pressable
              style={[styles.walletBtn, walletOpen && { backgroundColor: colors.primary }]}
              onPress={() => setWalletOpen((w) => !w)}
              android_ripple={{ color: palette.divider }}
              accessibilityRole="button"
              accessibilityLabel={walletOpen ? 'Hide outstanding' : 'Show outstanding'}
            >
              <Wallet size={19} color={walletOpen ? '#ffffff' : palette.muted} />
            </Pressable>
          </View>

          {view !== 'ERROR' && (
            <Pressable style={styles.searchBox} onPress={() => setMode('search')}>
              <Search size={17} color={palette.muted} />
              <Text style={styles.searchPlaceholder}>Search by phone, email or bill no…</Text>
            </Pressable>
          )}

          {showsBillChips(view) && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScrollContent}
              style={styles.chipScroll}
              keyboardShouldPersistTaps="handled"
            >
              {CHIPS.map((c) => {
                const active = chip === c.key;
                const count = chipCount(c.key);
                return (
                  <Pressable
                    key={c.label}
                    onPress={() => setChip(c.key)}
                    style={[
                      styles.chip,
                      active && { backgroundColor: colors.softBg, borderColor: colors.primary },
                    ]}
                  >
                    <Text style={[styles.chipLabel, active && { color: colors.primary }]}>
                      {c.label}
                    </Text>
                    {count != null && (
                      <Text style={[styles.chipCount, active && { color: colors.primary }]}>
                        {count}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {view === 'SEARCH_RESULTS' && (
            <Text style={styles.resultLine}>
              {`${rows.length} result${rows.length === 1 ? '' : 's'} for '${debouncedSearch}'`}
            </Text>
          )}
        </>
      )}
    </CollapsingHeader>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {body}

      {header}

      {/* The outstanding card FLOATS over the screen behind a scrim — it does not sit in the
          header and does not push the list down. The mockup is explicit: its Content frame is
          untouched with the card overlaid, so the chips and rows stay exactly where they were and
          simply dim. Inline would shove everything down and make opening the card feel like a
          navigation rather than a glance.

          In a Modal rather than plain absolute children so the scrim reaches the WHOLE screen: the
          bottom tab bar is rendered by the navigator as a sibling of this scene, so anything drawn
          inside the scene can never dim it. Modal portals to the root, which also gives Android's
          back button the dismiss it should have. Gated at render level for the same reason as the
          sheets below. Coordinates inside a Modal are screen-absolute, hence the +insets.top. */}
      {walletOpen && summary && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setWalletOpen(false)}>
          <Pressable
            style={styles.walletScrim}
            onPress={() => setWalletOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss outstanding"
          />
          <WalletCard
            styles={styles}
            summary={summary}
            top={insets.top + titleH - WALLET_TITLE_OVERLAP}
          />
        </Modal>
      )}

      {/* Hidden while the wallet is open. The FAB renders after the scrim and would otherwise sit
          on top of it at full brightness, which both breaks the dim and offers a second action
          competing with the popover — the mockup draws no FAB in this state. */}
      {/* Two create affordances, one handler. `showsBillFab` excludes EMPTY, where the hero CTA is
          the only way in, so wiring one and not the other leaves a dead button on the screen a
          brand-new business sees first. */}
      {showsBillFab(view) && !walletOpen && <FAB accessibilityLabel="New bill" onPress={onAdd} />}

      {/* Each overlay is gated at render level rather than on Modal's `visible` prop alone:
          react-native-web keeps a Modal's portal mounted after `visible` flips false, which leaves
          stale sheets stacked on screen intercepting taps. */}
      {sheet === 'actions' && activeBill && (
        <ActionsSheet
          bill={activeBill}
          styles={styles}
          theme={theme}
          insets={insets}
          onClose={closeSheets}
          onPick={onPickAction}
        />
      )}

      {sheet === 'amount' && activeBill && pendingAction && (
        <AmountSheet
          bill={activeBill}
          styles={styles}
          theme={theme}
          onCancel={closeSheets}
          onConfirm={(amount) => runAction(activeBill, pendingAction, amount)}
        />
      )}

      <ConfirmDialog
        visible={dialog === 'cancel'}
        title="Cancel this bill?"
        message={
          activeBill
            ? `Bill ${activeBill.billNumber} will be cancelled. Its linked orders and appointments are unbilled, and any items billed directly on it are restocked.`
            : ''
        }
        confirmLabel="Cancel bill"
        cancelLabel="Keep bill"
        danger
        onConfirm={() => activeBill && pendingAction && runAction(activeBill, pendingAction)}
        onCancel={closeSheets}
      />

      <ConfirmDialog
        visible={dialog === 'finalize'}
        title="Finalize this bill?"
        message="Once finalized, its linked orders and appointments are locked — you'll need to cancel this bill to change them."
        confirmLabel="Finalize"
        cancelLabel="Not yet"
        onConfirm={() => activeBill && pendingAction && runAction(activeBill, pendingAction)}
        onCancel={closeSheets}
      />
    </SafeAreaView>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSearch(view: string): boolean {
  return view === 'SEARCH_RESULTS' || view === 'NO_RESULTS' || view === 'SEARCHING';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

// ─── Wallet card ─────────────────────────────────────────────────────────────

/**
 * The outstanding breakdown, toggled from the header.
 *
 * Shows the split rather than only the total because "₹18,750 owed" is a number to worry about,
 * while "₹12,000 not yet paid and ₹6,750 part-paid" tells the owner which bills to chase first.
 * Every figure comes from the server so the card can never disagree with the header line above it.
 */
function WalletCard({ styles, summary, top }: { styles: any; summary: any; top: number }) {
  return (
    <View style={[styles.wallet, { top }]}>
      <Text style={styles.walletLabel}>TOTAL OUTSTANDING</Text>
      <Text style={styles.walletTotal}>{formatAmount(summary.totalOutstanding)}</Text>
      <Text style={styles.walletCaption}>
        {`across ${summary.outstandingBillCount} unsettled bill${
          summary.outstandingBillCount === 1 ? '' : 's'
        }`}
      </Text>

      <View style={styles.walletRow}>
        <WalletFigure styles={styles} value={summary.totalPaid} label="Paid" tone="paid" />
        <WalletFigure
          styles={styles}
          value={summary.outstandingFromPartial}
          label="Partial"
          tone="partial"
        />
        <WalletFigure
          styles={styles}
          value={summary.outstandingFromUnpaid}
          label="Unpaid"
          tone="unpaid"
        />
      </View>
    </View>
  );
}

function WalletFigure({
  styles,
  value,
  label,
  tone,
}: {
  styles: any;
  value: number;
  label: string;
  tone: 'paid' | 'partial' | 'unpaid';
}) {
  return (
    <View style={styles.walletFigure}>
      <Text style={[styles.walletValue, styles[`wallet_${tone}`]]}>
        {formatCompactAmount(value ?? 0)}
      </Text>
      <Text style={styles.walletFigureLabel}>{label}</Text>
    </View>
  );
}

// ─── Rows / hero ─────────────────────────────────────────────────────────────

function SkeletonRow({ styles }: { styles: any }) {
  return (
    <View style={styles.card}>
      <View style={styles.skelAvatar} />
      <View style={styles.cardBody}>
        <View style={styles.skelLineWide} />
        <View style={styles.skelLineNarrow} />
      </View>
      <View style={styles.skelPill} />
    </View>
  );
}

function HeroBlock({
  styles,
  style,
  icon,
  headline,
  sub,
  ctaLabel,
  onCta,
  colors,
}: {
  styles: any;
  style?: StyleProp<ViewStyle>;
  icon: React.ReactNode;
  headline: string;
  sub: string;
  ctaLabel?: string;
  onCta?: () => void;
  colors: any;
}) {
  return (
    <View style={[styles.hero, style]}>
      <View style={styles.heroIcon}>{icon}</View>
      <Text style={styles.heroHeadline}>{headline}</Text>
      <Text style={styles.heroSub}>{sub}</Text>
      {ctaLabel && onCta && (
        <Pressable style={[styles.heroCta, { backgroundColor: colors.primary }]} onPress={onCta}>
          <Text style={styles.heroCtaLabel}>{ctaLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Quick actions ───────────────────────────────────────────────────────────

/**
 * The mockup's `$text-tertiary` — the dim tone used for the unavailable rows. Same alpha the
 * screen's styles already use for de-emphasised text, so it tracks the theme instead of pinning
 * the mockup's dark-mode hex.
 */
const DISABLED_TINT = (theme: AppTheme) => theme.palette.muted + '8A';

const ACTION_ICON: Record<string, React.ComponentType<any>> = {
  DRAFT: FilePen,
  FINALIZED: Lock,
  CANCELLED: Ban,
  PAID: CircleCheck,
  PARTIALLY_PAID: CircleDashed,
  FAILED: CircleX,
};

function ActionsSheet({
  bill,
  styles,
  theme,
  insets,
  onClose,
  onPick,
}: {
  bill: BillRow;
  styles: any;
  theme: AppTheme;
  insets: { bottom: number };
  onClose: () => void;
  onPick: (a: QuickAction) => void;
}) {
  const actions = quickActionsFor(bill.billStatus, bill.paymentStatus);
  const billActions = actions.filter((a) => a.axis === 'bill');
  const payActions = actions.filter((a) => a.axis === 'payment');
  const bs = theme.status[bill.billStatus] ?? theme.status.FALLBACK;
  const ps = theme.status[bill.paymentStatus] ?? theme.status.FALLBACK;

  const row = (a: QuickAction) => {
    const Icon = ACTION_ICON[a.key] ?? CircleDashed;
    return (
      <Pressable key={a.key} style={styles.actionRow} onPress={() => onPick(a)}>
        <Icon size={19} color={theme.palette[a.tint]} />
        <Text style={[styles.actionLabel, a.danger && { color: theme.palette.error }]}>
          {a.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetGrip} />

        <View style={styles.sheetHead}>
          <View style={styles.sheetHeadText}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {bill.customerName}
            </Text>
            <Text style={styles.sheetSub} numberOfLines={1}>
              {`${bill.billNumber} · ${formatAmount(bill.amount)}`}
            </Text>
          </View>
          <View style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: bs.bg }]}>
              <Text style={[styles.pillText, { color: bs.text }]}>
                {BILL_STATUS_LABEL[bill.billStatus] ?? bill.billStatus}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: ps.bg }]}>
              <Text style={[styles.pillText, { color: ps.text }]}>
                {PAYMENT_STATUS_LABEL[bill.paymentStatus] ?? bill.paymentStatus}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sheetSection}>BILL STATUS</Text>
        {billActions.map(row)}

        <Text style={styles.sheetSection}>PAYMENT STATUS</Text>
        {payActions.map(row)}

        {/* Drawn in the mockup as explicitly unavailable. Rendered disabled rather than omitted so
            the sheet matches the design and the capability is visibly planned, not missing.
            Their icons take the mockup's $text-tertiary — a step dimmer than the muted used by the
            live rows above, which is what reads as "not available" rather than merely secondary. */}
        <View style={styles.actionRowDisabled}>
          <Download size={19} color={DISABLED_TINT(theme)} />
          <Text style={styles.actionLabelDisabled}>Download PDF</Text>
          <Text style={styles.soonBadge}>Coming soon</Text>
        </View>
        <View style={styles.actionRowDisabled}>
          <Share2 size={19} color={DISABLED_TINT(theme)} />
          <Text style={styles.actionLabelDisabled}>Share bill</Text>
          <Text style={styles.soonBadge}>Coming soon</Text>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Amount entry for "Mark as Partially Paid".
 *
 * The server rejects PARTIALLY_PAID without an amount, and the service layer rejects it before the
 * round trip — but neither is a substitute for asking. Seeded with the outstanding balance because
 * settling the remainder is the common case.
 */
function AmountSheet({
  bill,
  styles,
  theme,
  onCancel,
  onConfirm,
}: {
  bill: BillRow;
  styles: any;
  theme: AppTheme;
  onCancel: () => void;
  onConfirm: (amount: number) => void;
}) {
  const [text, setText] = useState(String(bill.balance || ''));
  const amount = Number(text);
  const valid = Number.isFinite(amount) && amount > 0 && amount <= bill.amount;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.sheetBackdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.sheetGrip} />
        <Text style={styles.sheetTitle}>Record a part payment</Text>
        <Text style={styles.sheetSub}>
          {`${bill.billNumber} · ${formatAmount(bill.amount)} total · ${formatAmount(
            bill.balance,
          )} outstanding`}
        </Text>

        <TextInput
          style={styles.amountInput}
          value={text}
          onChangeText={setText}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={theme.palette.muted}
          autoFocus
        />
        {!valid && !!text && (
          <Text style={styles.amountError}>
            {amount > bill.amount
              ? 'More than the bill total — mark it Paid instead.'
              : 'Enter an amount greater than zero.'}
          </Text>
        )}

        <View style={styles.sheetActions}>
          <Pressable style={styles.sheetGhost} onPress={onCancel}>
            <Text style={styles.sheetGhostLabel}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[
              styles.sheetPrimary,
              { backgroundColor: theme.colors.primary },
              !valid && styles.sheetPrimaryDisabled,
            ]}
            disabled={!valid}
            onPress={() => onConfirm(amount)}
          >
            <Text style={styles.sheetPrimaryLabel}>Record payment</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (theme: AppTheme) => {
  const dim = theme.palette.muted + '8A';
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.palette.background },

    // Header
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 8,
    },
    titleBlock: { flex: 1 },
    title: { fontSize: 27, fontWeight: '700', color: theme.palette.onBackground },
    subtitle: { fontSize: 12.5, color: dim, marginTop: 2 },
    walletBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surface,
    },

    searchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingTop: 8,
    },
    searchField: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 46,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      backgroundColor: theme.palette.surface,
    },
    searchInput: { flex: 1, fontSize: 14, color: theme.palette.onBackground, padding: 0 },
    cancelText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 46,
      marginHorizontal: 18,
      marginTop: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surface,
    },
    searchPlaceholder: { fontSize: 14, color: theme.palette.muted },

    // flexShrink: 0 is load-bearing — a horizontal ScrollView in a height-constrained column gets
    // crushed to a few px without it. Same incident as the Orders chip rows.
    chipScroll: { marginTop: 10, flexGrow: 0, flexShrink: 0 },
    chipScrollContent: { paddingHorizontal: 18, gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surface,
    },
    chipLabel: { fontSize: 12.5, fontWeight: '600', color: theme.palette.onBackground },
    chipCount: { fontSize: 11.5, fontWeight: '700', color: dim },

    resultLine: {
      fontSize: 12,
      fontWeight: '600',
      color: dim,
      paddingHorizontal: 18,
      marginTop: 12,
    },

    // Wallet — a popover over the screen, not a panel in the header. The card's `top` is supplied
    // at render time from the measured header height so it hangs directly beneath the title
    // whatever the header currently contains.
    //
    // The scrim covers the whole screen, title and status bar included. The mockup draws it
    // starting level with the card, but a dim that leaves the heading at full brightness reads as
    // a rendering seam rather than as focus — the point is that everything except the card recedes.
    walletScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#00000099',
      zIndex: 20,
    },
    wallet: {
      position: 'absolute',
      left: 18,
      right: 18,
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surface,
      // Above the scrim (20) and the collapsing header (10); below the FAB (100).
      zIndex: 30,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.5,
      shadowRadius: 18,
      elevation: 12,
    },
    walletLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, color: theme.palette.muted },
    walletTotal: {
      fontSize: 30,
      fontWeight: '700',
      color: theme.palette.onBackground,
      marginTop: 6,
    },
    walletCaption: { fontSize: 12, color: theme.palette.muted, marginTop: 6 },
    walletRow: {
      flexDirection: 'row',
      // space-between, NOT three flexed thirds: the mockup pins Paid to the left edge and Unpaid
      // flush to the right, so the row spans the card's full width. Equal thirds left-align each
      // figure and leave a ragged gap on the right.
      justifyContent: 'space-between',
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: theme.palette.divider,
    },
    walletFigure: {},
    walletValue: { fontSize: 16, fontWeight: '700' },
    walletFigureLabel: { fontSize: 11, fontWeight: '500', color: dim, marginTop: 3 },
    // Green, amber, neutral — taken from the mockup, which fills these with $success, $warning and
    // $text-secondary respectively. Unpaid is deliberately NOT alarm-coloured: on most days it is
    // the largest of the three, and painting the biggest number red would make an ordinary ledger
    // read as a crisis. Green and amber mark what has moved; unpaid is just the remainder.
    wallet_paid: { color: theme.status.PAID?.text ?? theme.palette.onBackground },
    wallet_partial: { color: theme.status.PENDING?.text ?? theme.palette.onBackground },
    wallet_unpaid: { color: theme.palette.muted },

    // Sections + list
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 8,
      backgroundColor: theme.palette.background,
    },
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: dim },
    sectionCount: { fontSize: 11, color: dim },

    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 16,
      marginBottom: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surface,
    },
    cardPressed: { opacity: 0.75 },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 13, fontWeight: '700' },
    cardBody: { flex: 1, gap: 3 },
    customerName: { fontSize: 14, fontWeight: '600', color: theme.palette.onBackground },
    cardMeta: { fontSize: 11.5, fontWeight: '500', color: dim },
    cardRight: { alignItems: 'flex-end', gap: 6 },
    amount: { fontSize: 15, fontWeight: '700', color: theme.palette.onBackground },
    pillRow: { flexDirection: 'row', gap: 6 },
    pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

    footer: { paddingVertical: 16 },

    // Skeleton
    skeletonWrap: { paddingTop: 10 },
    skelAvatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.palette.divider },
    skelLineWide: {
      width: '55%',
      height: 11,
      borderRadius: 6,
      backgroundColor: theme.palette.divider,
    },
    skelLineNarrow: {
      width: '38%',
      height: 9,
      borderRadius: 5,
      backgroundColor: theme.palette.divider,
    },
    skelPill: { width: 58, height: 18, borderRadius: 999, backgroundColor: theme.palette.divider },

    // Hero
    idleBody: { flex: 1 },
    hero: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      gap: 10,
    },
    heroIcon: {
      width: 78,
      height: 78,
      borderRadius: 39,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surface,
    },
    heroHeadline: { fontSize: 17, fontWeight: '700', color: theme.palette.onBackground },
    heroSub: { fontSize: 13, color: dim, textAlign: 'center', lineHeight: 19 },
    heroCta: { marginTop: 6, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12 },
    heroCtaLabel: { fontSize: 14, fontWeight: '600', color: '#ffffff' },

    // Sheets
    sheetBackdrop: { flex: 1, backgroundColor: '#00000099' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 20,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      backgroundColor: theme.palette.surface,
    },
    sheetGrip: {
      alignSelf: 'center',
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.palette.divider,
      marginBottom: 12,
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider,
    },
    sheetHeadText: { flex: 1 },
    sheetTitle: { fontSize: 15, fontWeight: '700', color: theme.palette.onBackground },
    sheetSub: { fontSize: 12, color: dim, marginTop: 2 },
    sheetSection: {
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: dim,
      marginTop: 16,
      marginBottom: 4,
    },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
    actionLabel: { fontSize: 14, fontWeight: '600', color: theme.palette.onBackground },
    actionRowDisabled: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      opacity: 0.45,
    },
    actionLabelDisabled: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.palette.muted },
    soonBadge: {
      fontSize: 10,
      fontWeight: '700',
      color: dim,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.palette.background,
    },

    amountInput: {
      marginTop: 14,
      height: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.background,
      paddingHorizontal: 16,
      fontSize: 20,
      fontWeight: '700',
      color: theme.palette.onBackground,
    },
    amountError: { fontSize: 12, color: theme.palette.error, marginTop: 8 },
    sheetActions: { flexDirection: 'row', gap: 12, marginTop: 18 },
    sheetGhost: {
      flex: 1,
      height: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    sheetGhostLabel: { fontSize: 14, fontWeight: '600', color: theme.palette.onBackground },
    sheetPrimary: {
      flex: 1.4,
      height: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetPrimaryDisabled: { opacity: 0.45 },
    sheetPrimaryLabel: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  });
};

export default BillingScreen;
