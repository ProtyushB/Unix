import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  StyleSheet,
  RefreshControl,
  Linking,
  ActivityIndicator,
} from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Search,
  X,
  CalendarDays,
  CalendarClock,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
  CircleDot,
  CircleCheck,
  CircleX,
  Ban,
  Phone,
  Scissors,
} from 'lucide-react-native';
import { FAB } from '../../../components/layout/FAB';
import {
  CollapsingHeader,
  AnimatedSectionList,
  type AnimatedSectionListHandle,
} from '../../../components/layout/CollapsingHeader';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { useTheme } from '../../../hooks/useTheme';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { useCollapsingHeader } from '../../../hooks/useCollapsingHeader';
import { useToast } from '../../../hooks/useToast';
import type { AppTheme } from '../../../theme/theme.types';
import {
  toYmd,
  parseYmd,
  weekDays,
  monthGrid,
  formatDayHeading,
  formatDayStamp,
  formatDayCompact,
  formatMonthLabel,
} from '../../../utils/dateRange';
import { useAppContext } from '../../../context/AppContext';
import { useParlour } from '../../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../../backend/modules/pharmacy/hook/usePharmacy';
import type { AppointmentListOptions } from '../../../backend/modules/shared/hook/useModuleService';
import {
  toAppointmentRow,
  serviceSummary,
  formatAmount,
  apptClock,
  apptMeridiem,
  formatApptTime,
  STATUS_LABEL,
  type AppointmentRow,
} from './appointment.model';
import {
  deriveView,
  showsFab,
  showsDateNav,
  dayDotCount,
  headerCollapses,
  listKeyFor,
  listModeFor,
  type AppointmentView,
} from './appointment.view';
import {
  allDatesCellLayout,
  allDatesWindows,
  anchorSectionIndex,
  buildDateSections,
  sectionHeaderCellIndex,
  sectionHeading,
  toggleDaySelection,
  type AllDatesCellMetrics,
} from './appointment.allDates';

const PAGE_SIZE = 20;

/**
 * How much of the previous (later-dated) group stays visible above the day the all-dates list opens
 * on.
 *
 * What it actually shows is the bottom 64px of the previous group's LAST CARD — a partial row, cut
 * off. Not a date band: the cell directly above an anchored section is always the previous
 * section's zero-height footer, and `buildDateSections` never emits an empty section, so a band can
 * never fall in the gap.
 *
 * A cut-off card is the right thing to show anyway, and better than a band would be. The all-dates
 * list is the only one in the app that runs backwards — up is forward in time — and a day sitting
 * flush against the top edge reads as the beginning of the list, so nothing suggests the upward
 * scroll that reaches next week. Half a card is unmistakably a thing continuing off-screen.
 */
const ANCHOR_PEEK = 64;

/**
 * The gap under each appointment card.
 *
 * Named rather than inlined into the style because it is also part of the ROW CELL's height, and
 * the all-dates list has to know that height exactly. VirtualizedList wraps every rendered item in
 * a plain `<View>`, and a Yoga container's auto height is the sum of its children's margin boxes —
 * so this gap sits inside the cell that `getItemLayout` measures, not between two cells. Measuring
 * the card and forgetting the margin under-counts every row by 10px.
 */
const CARD_GAP = 10;

/** Gap between the collapsing header and the first row. Lives on the header — see `gapBelow`. */
const LIST_TOP_PAD = 10;
/** FAB clearance, so the last card is never trapped under it. */
const LIST_BOTTOM_PAD = 100;

/**
 * Keeps the rows the user is reading in place when a future page lands ABOVE them. Without it,
 * every prepended page shoves the visible rows down the screen by its own height.
 *
 * `minIndexForVisible: 0`, and the value was checked against the RN source rather than copied off
 * a chat-list snippet, because the two ends of this prop count from different places:
 *
 *  - VirtualizedList reads it in DATA-item space, to decide which item's key it fingerprints as
 *    "the first one" and how far to shift its render window when that key moves
 *    (`getDerivedStateFromProps`).
 *  - It then hands the native ScrollView `minIndexForVisible + (ListHeaderComponent ? 1 : 0)`,
 *    because on that side the count is over the content view's CHILDREN and the list header is
 *    child 0.
 *
 * So the ListHeaderComponent this list always renders — the top cap — is already skipped for us.
 * The 1 that other codebases pass is exactly that header adjustment, applied a second time by
 * hand: against RN 0.82 it anchors on the second row rather than the first, for no reason.
 */
const MAINTAIN_POSITION = { minIndexForVisible: 0 } as const;

/**
 * Fixed height for the all-dates top cap, whatever it is currently showing.
 *
 * `maintainVisibleContentPosition` does cover a header that resizes — the anchor is a row below
 * it, and moving that row is what triggers the correction. What a constant height buys is
 * everything upstream of that: the list's content height stops changing as the cap swaps between
 * spinner, end marker and spacer, so `onStartReached` (which fires once per content length) is not
 * re-armed by the cap's own state changes, and the end marker appears without the list twitching.
 */
const ALL_TOP_CAP_HEIGHT = 46;

/**
 * The hook types every list payload as `unknown[]` — it is whatever the server sent. `toAppointmentRow`
 * is the thing that copes with a missing or oddly-named field, so the cast belongs here, at the one
 * point where a raw payload becomes a row, rather than repeated at each bucket's call site.
 */
const toRows = (raw: unknown[]): AppointmentRow[] =>
  (raw as Record<string, any>[]).map(toAppointmentRow);

/**
 * Quick Actions rows. The appointment's CURRENT status is filtered out at render time — offering
 * "move to Confirmed" on an already-confirmed appointment is a no-op the user can only be
 * confused by. Same rule as OrdersScreen.
 *
 * There is no "Pending" row at all: the entity defaults to CONFIRMED on create and PENDING is
 * reserved for a customer-booking flow that does not exist yet, so moving an appointment backwards
 * into Pending has no meaning today.
 */
/**
 * `tint` is the palette role for the ICON, taken from the mockup. Deliberately independent of
 * `danger`, which tints the LABEL: the mockup draws "Rejected" with a red icon but primary-coloured
 * text, and only "Cancel appointment" turns its text red.
 */
const QUICK_STATUSES = [
  { status: 'CONFIRMED', label: 'Confirm appointment', icon: BadgeCheck, tint: 'success' },
  { status: 'IN_PROGRESS', label: 'In-Progress', icon: CircleDot, tint: 'info' },
  {
    status: 'COMPLETED',
    label: 'Mark as completed',
    icon: CircleCheck,
    tint: 'success',
    // True as of the status-cascade fix in GenericAppointmentService — do not ship this label
    // against a backend that only sets the status.
    sub: 'Also marks all items completed',
  },
  { status: 'REJECTED', label: 'Rejected', icon: Ban, tint: 'error' },
  { status: 'CANCELLED', label: 'Cancel appointment', icon: CircleX, tint: 'error', danger: true },
] as const satisfies readonly {
  status: string;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  tint: 'success' | 'warning' | 'info' | 'error' | 'muted';
  sub?: string;
  danger?: boolean;
}[];

/** Rescheduling something already finished or called off is meaningless — hide the row. */
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED'];

const WEEK_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const GRID_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ─── Screen ──────────────────────────────────────────────────────────────────

interface AppointmentsScreenProps {
  /** Optional so the web preview can mount the list standalone, with no navigator around it. */
  navigation?: {
    navigate: (route: string, params?: Record<string, unknown>) => void;
    addListener?: (event: string, cb: () => void) => () => void;
  };
}

export function AppointmentsScreen({ navigation }: AppointmentsScreenProps = {}) {
  const theme = useTheme();
  const { colors, palette } = theme;
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();

  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();

  const moduleKey = (selectedModule || '').toUpperCase();
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;

  // ── Drivers ────────────────────────────────────────────────────────────────
  const [surface, setSurface] = useState<'DAY' | 'CALENDAR'>('DAY');
  const [mode, setMode] = useState<'browse' | 'search'>('browse');
  /** The picked day, or null once the user taps the highlighted day again — the all-dates list. */
  const [selectedDate, setSelectedDate] = useState<string | null>(() => toYmd(new Date()));
  /**
   * Which week the strip shows and which day the header names. Follows every tap INCLUDING the one
   * that deselects, so clearing the selection leaves the strip on the week it was already showing
   * with nothing highlighted, rather than snapping back to today's week.
   */
  const [anchorDate, setAnchorDate] = useState(() => toYmd(new Date()));
  const [anchorMonth, setAnchorMonth] = useState(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const [sheet, setSheet] = useState<null | 'actions' | 'reschedule'>(null);
  const [activeAppt, setActiveAppt] = useState<AppointmentRow | null>(null);
  // Cancel-blocked is a toast, not a dialog — both mockups specify it, and Orders now matches.
  const [dialog, setDialog] = useState<null | 'cancelConfirm'>(null);

  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);

  const todayYmd = useMemo(() => toYmd(new Date()), []);

  const listMode = listModeFor({ mode, selectedDate });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── All-dates buckets ──────────────────────────────────────────────────────
  //
  // Two lists, paged independently, concatenated at render time. See `allDatesWindows` for why the
  // seam is at today and why the future bucket is fetched ascending.
  const [futureRows, setFutureRows] = useState<AppointmentRow[]>([]);
  const [pastRows, setPastRows] = useState<AppointmentRow[]>([]);
  const [allLoadedOnce, setAllLoadedOnce] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);
  const [futureLoading, setFutureLoading] = useState(false);
  const [pastLoading, setPastLoading] = useState(false);
  /** Mirrors of the page refs, for the top cap and the footer — a ref cannot trigger a repaint. */
  const [futureDone, setFutureDone] = useState(false);
  const [pastDone, setPastDone] = useState(false);
  /** Bumped whenever a fresh pair of page-1s lands; drives the one-shot scroll onto today. */
  const [anchorNonce, setAnchorNonce] = useState(0);

  const futurePageRef = useRef(1);
  const futurePagesRef = useRef(1);
  const futureBusyRef = useRef(false);
  const pastPageRef = useRef(1);
  const pastPagesRef = useRef(1);
  const pastBusyRef = useRef(false);
  /**
   * Generation counter for the all-dates fetches. Every response checks it before writing, so a
   * page still in flight when the user picks a day — or pulls to refresh — is discarded instead of
   * landing on top of the list that replaced it.
   */
  const allRunRef = useRef(0);
  /** True between "both page-1s landed" and "the opening scroll finished". Gates upward paging. */
  const anchorPendingRef = useRef(false);

  const sectionListRef = useRef<AnimatedSectionListHandle | null>(null);

  // ── Measuring the all-dates cells ──────────────────────────────────────────
  //
  // The two heights `getItemLayout` needs, read off the first card and the first date band the
  // all-dates list lays out.
  //
  // Measured rather than written down as constants because there is no constant that would be
  // right. A card is as tall as its tallest column, and every one of those is a `<Text>` whose line
  // height comes from the platform's font metrics and is then multiplied by the user's system
  // text-size setting — so the number differs between iOS and Android, and again at 150% text. A
  // hardcoded height would be a `getItemLayout` that lies, and a lying one drifts a little further
  // from the truth with every row, which is worse than the scroll simply not happening.
  //
  // What makes one measurement stand for every row is that no cell's height depends on its
  // CONTENT. Every text that could wrap is capped at one line — the two body lines already were,
  // the time gutter and the date band are now — and the amount is rendered on every row in this
  // mode rather than only on some. The amount and the status pill sit in a column with no flex of
  // its own, which is why six rows carrying four different statuses and five different amounts all
  // laid out at exactly the same height when this was measured against the real screen.
  const [cardHeight, setCardHeight] = useState(0);
  const [bandHeight, setBandHeight] = useState(0);
  const cardMeasuredRef = useRef(false);
  const bandMeasuredRef = useRef(false);

  /**
   * First measurement wins, and later ones are ignored.
   *
   * Not an optimisation. `onLayout` fires per mounted cell, so re-reading it would let any single
   * row rewrite the frame table for a list the user is already scrolling — and if two rows ever
   * did disagree, the two values would take turns and the list would resize under the finger. One
   * latched number is either right for every row or visibly wrong for all of them, which is the
   * failure that gets reported rather than the one that gets lived with.
   */
  const measureCard = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (cardMeasuredRef.current || h <= 0) return;
    cardMeasuredRef.current = true;
    setCardHeight(h);
  }, []);

  const measureBand = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (bandMeasuredRef.current || h <= 0) return;
    bandMeasuredRef.current = true;
    setBandHeight(h);
  }, []);

  /** Both cells measured — i.e. the list's offsets are computable rather than guessable. */
  const cellsMeasured = cardHeight > 0 && bandHeight > 0;

  const windows = useMemo(() => allDatesWindows(todayYmd), [todayYmd]);

  const fetchPage = activeModule.fetchAppointmentsPage;

  /**
   * Both buckets, page 1, in parallel.
   *
   * Parallel and then written TOGETHER, not one after the other: today's section index is the
   * number of future sections above it, so a first paint holding only one bucket would anchor the
   * opening scroll on the wrong group and then have it yanked when the other landed. One
   * `allLoadedOnce` for both is also one skeleton rather than two.
   */
  const loadAllDates = useCallback(async () => {
    const runId = ++allRunRef.current;
    // Deliberately does NOT clear `allLoadedOnce` — the fetch effect does that, and only on a key
    // change. Exactly like the day list, where `setLoadedOnce(false)` lives in the effect and not
    // in `loadAppointments`: a reload or a pull-to-refresh has to repaint the rows UNDER the
    // existing list, not drop back to the skeleton and take the list out from under the finger
    // that is still holding the refresh spinner.
    setAllError(null);
    futurePageRef.current = 1;
    futurePagesRef.current = 1;
    futureBusyRef.current = false;
    pastPageRef.current = 1;
    pastPagesRef.current = 1;
    pastBusyRef.current = false;
    setFutureLoading(true);
    setPastLoading(true);

    const [future, past] = await Promise.all([
      fetchPage(1, PAGE_SIZE, windows.future),
      fetchPage(1, PAGE_SIZE, windows.todayAndPast),
    ]);
    if (runId !== allRunRef.current) return;

    futurePagesRef.current = future.totalPages;
    pastPagesRef.current = past.totalPages;
    setFutureRows(toRows(future.rows));
    setPastRows(toRows(past.rows));
    // A bucket that FAILED is not a bucket that ended, and the failure envelope makes the two look
    // identical: it answers `{rows: [], totalPages: 1}`, which reads as "one page, and you have it".
    // Left alone that prints "That's the whole history" under a list that fetched no history, and
    // — because the page cursor also starts at 1 — permanently satisfies loadMore's
    // `page >= totalPages` guard, so scrolling can never retry. The only way out was pull-to-
    // refresh, which nothing on screen suggests.
    //
    // Rewinding the cursor to 0 makes the next scroll re-request page ONE through the ordinary
    // path, rather than skipping it and asking for page two of a bucket that has nothing.
    if (future.error) futurePageRef.current = 0;
    if (past.error) pastPageRef.current = 0;
    setFutureDone(!future.error && future.totalPages <= 1);
    setPastDone(!past.error && past.totalPages <= 1);
    setFutureLoading(false);
    setPastLoading(false);
    // Today lives in the second bucket, so its failure is the one that matters most; either way
    // the ERROR view only takes over when nothing at all came back — see deriveView's precedence.
    setAllError(past.error ?? future.error);
    setAllLoadedOnce(true);
    anchorPendingRef.current = true;
    setAnchorNonce((n) => n + 1);
  }, [fetchPage, windows]);

  /** Scrolling UP: the next page of the future, PREPENDED above what is already on screen. */
  const loadMoreFuture = useCallback(async () => {
    // Until the opening scroll has run the list is still sitting at offset 0, which is inside
    // onStartReached's threshold — without this gate the first paint would immediately fetch page
    // 2 of the future and prepend it under the anchor being computed.
    if (anchorPendingRef.current || futureBusyRef.current) return;
    if (futurePageRef.current >= futurePagesRef.current) return;
    const runId = allRunRef.current;
    futureBusyRef.current = true;
    setFutureLoading(true);
    const page = futurePageRef.current + 1;
    const res = await fetchPage(page, PAGE_SIZE, windows.future);
    if (runId !== allRunRef.current) return;
    futureBusyRef.current = false;
    setFutureLoading(false);
    if (!res.success) return; // Silent: the rows already on screen are still valid.
    futurePageRef.current = page;
    futurePagesRef.current = res.totalPages;
    setFutureDone(page >= res.totalPages);
    // Appending to the ASCENDING bucket is what prepends to the rendered list — buildDateSections
    // turns this array around.
    setFutureRows((prev) => [...prev, ...toRows(res.rows)]);
  }, [fetchPage, windows]);

  /** Scrolling DOWN: the next page back through the past, appended. */
  const loadMorePast = useCallback(async () => {
    if (pastBusyRef.current) return;
    if (pastPageRef.current >= pastPagesRef.current) return;
    const runId = allRunRef.current;
    pastBusyRef.current = true;
    setPastLoading(true);
    const page = pastPageRef.current + 1;
    const res = await fetchPage(page, PAGE_SIZE, windows.todayAndPast);
    if (runId !== allRunRef.current) return;
    pastBusyRef.current = false;
    setPastLoading(false);
    if (!res.success) return;
    pastPageRef.current = page;
    pastPagesRef.current = res.totalPages;
    setPastDone(page >= res.totalPages);
    setPastRows((prev) => [...prev, ...toRows(res.rows)]);
  }, [fetchPage, windows]);

  const allSections = useMemo(
    () => buildDateSections({ future: futureRows, todayAndPast: pastRows, today: todayYmd }),
    [futureRows, pastRows, todayYmd],
  );
  const allRowCount = useMemo(
    () => allSections.reduce((n, s) => n + s.data.length, 0),
    [allSections],
  );

  // ── Fetch A: the list ──────────────────────────────────────────────────────
  const listOpts = useMemo<AppointmentListOptions>(
    () =>
      mode === 'search'
        ? // Global across all dates: someone looking up a booking rarely knows which day it is on.
          { search: debouncedSearch, sortBy: 'appointmentDateTime', sortDir: 'desc' }
        : // Exactly one IST day, chronological. sortDir must be explicit — viewAll defaults to desc.
          //
          // `?? todayYmd` never reaches the wire: with no day selected the effect below takes the
          // all-dates branch and these options go unused. It is here so the day window stays a
          // pair of strings rather than becoming nullable for a case that cannot use it.
          {
            fromDate: selectedDate ?? todayYmd,
            toDate: selectedDate ?? todayYmd,
            sortBy: 'appointmentDateTime',
            sortDir: 'asc',
          },
    [mode, debouncedSearch, selectedDate, todayYmd],
  );

  const listKey = listKeyFor({ mode, selectedDate, query: debouncedSearch, today: todayYmd });

  useEffect(() => {
    if (listMode === 'all') {
      setAllLoadedOnce(false);
      loadAllDates();
      return;
    }
    // Leaving all-dates: retire any bucket page still in flight, or it lands on the day list.
    allRunRef.current += 1;
    // A search with no query yet has nothing to fetch — SEARCH_IDLE renders a blank body.
    if (listMode === 'search' && !debouncedSearch) return;
    pageRef.current = 1;
    setLoadedOnce(false);
    activeModule.loadAppointments(1, PAGE_SIZE, listOpts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey, moduleKey]);

  useEffect(() => {
    const mapped = (activeModule.appointments as any[]).map(toAppointmentRow);
    setRows((prev) => (pageRef.current <= 1 ? mapped : [...prev, ...mapped]));
    loadingMoreRef.current = false;
  }, [activeModule.appointments]);

  /**
   * "The first load has finished" — the gate between LOADING and EMPTY/DAY.
   *
   * Tracks the loading true → false TRANSITION, not the flag. `loading` is false on the very first
   * render, before loadAppointments flips it, so a plain `!loading` check marks the screen loaded
   * before any request exists and flashes the empty state instead of the skeleton.
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

  // ── Fetch B: the day-count dots ────────────────────────────────────────────
  const countsWindow = useMemo(() => {
    if (mode === 'search') return null; // no dots while searching
    if (surface === 'CALENDAR') {
      const { from, to } = monthGrid(anchorMonth.y, anchorMonth.m);
      return { fromDate: from, toDate: to };
    }
    // `anchorDate`, not `selectedDate`: the strip still shows a week — and still needs its dots —
    // when nothing is selected.
    const week = weekDays(parseYmd(anchorDate));
    return { fromDate: toYmd(week[0]), toDate: toYmd(week[6]) };
  }, [mode, surface, anchorDate, anchorMonth]);

  const countsKey = countsWindow ? `${countsWindow.fromDate}:${countsWindow.toDate}` : '';

  useEffect(() => {
    if (!countsWindow) return;
    activeModule.loadAppointmentDayCounts?.(countsWindow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countsKey, moduleKey]);

  const dayCounts: Record<string, number> = activeModule.appointmentDayCounts ?? {};

  // ── Derived view ───────────────────────────────────────────────────────────
  //
  // All three counters switch together with the mode. The all-dates buckets are fetched through
  // `fetchAppointmentsPage`, which deliberately writes none of the hook's shared cells, so
  // `activeModule.error` and `loadedOnce` describe the DAY list and would report a stale
  // first-load and a stale failure if they leaked into the all-dates branch.
  const isAll = listMode === 'all';
  const view: AppointmentView = deriveView({
    surface,
    mode,
    selectedDate,
    query: debouncedSearch,
    rowCount: isAll ? allRowCount : rows.length,
    loadedOnce: isAll ? allLoadedOnce : loadedOnce,
    hasError: isAll ? !!allError : !!activeModule.error,
  });

  /**
   * The day's count. Prefers the server's number, because the list is page-capped and a busy day
   * would otherwise read "20 appointments" forever.
   *
   * Falls back to the rows actually on screen when the map has no entry for this day — the counts
   * fetch is deliberately best-effort (it never sets `error`), so a 404 or a 500 would otherwise
   * print "0 appointments" above a full list. Absent means unknown, not zero.
   */
  const dayTotal = selectedDate ? (dayCounts[selectedDate] ?? rows.length) : rows.length;

  const onEndReached = useCallback(() => {
    // Scrolling DOWN in all-dates mode walks backwards through the past, which is the second
    // bucket's own forward paging — nothing to do with the day list's page counter.
    if (isAll) {
      loadMorePast();
      return;
    }
    if (loadingMoreRef.current || activeModule.loading) return;
    if (pageRef.current >= (activeModule.appointmentsTotalPages || 1)) return;
    loadingMoreRef.current = true;
    pageRef.current += 1;
    activeModule.loadAppointments(pageRef.current, PAGE_SIZE, listOpts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAll, loadMorePast, listOpts, activeModule.loading, activeModule.appointmentsTotalPages]);

  /**
   * Refetch everything the current mode shows.
   *
   * In all-dates mode this is a full reset: both buckets back to page 1, and the list re-anchored
   * onto today. It cannot be anything else — the pages already loaded above and below are what the
   * scroll offset is measured against, so refetching one bucket and keeping the offset would leave
   * the user somewhere arbitrary. Re-anchoring at least lands them somewhere they can name.
   */
  const reload = useCallback(() => {
    if (isAll) {
      loadAllDates();
      if (countsWindow) activeModule.loadAppointmentDayCounts?.(countsWindow);
      return;
    }
    pageRef.current = 1;
    activeModule.loadAppointments(1, PAGE_SIZE, listOpts);
    if (countsWindow) activeModule.loadAppointmentDayCounts?.(countsWindow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAll, loadAllDates, listOpts, countsWindow]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const counts = countsWindow
      ? (activeModule.loadAppointmentDayCounts?.(countsWindow) ?? Promise.resolve())
      : Promise.resolve();
    if (isAll) {
      await Promise.all([loadAllDates(), counts]);
    } else {
      pageRef.current = 1;
      await Promise.all([activeModule.loadAppointments(1, PAGE_SIZE, listOpts), counts]);
    }
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAll, loadAllDates, listOpts, countsWindow]);

  /**
   * Drop every overlay. Called before navigating as well as after an action.
   *
   * Not optional on react-native-web: a Modal's portal stays mounted after `visible` flips false,
   * so a sheet left open when the stack pushes reappears over the detail screen and eats its taps.
   * The three overlays here are unmounted by STATE rather than by `visible` for that reason, so
   * clearing the state is what actually removes them.
   */
  const closeAll = useCallback(() => {
    setSheet(null);
    setActiveAppt(null);
    setDialog(null);
  }, []);

  /**
   * Refetch on RETURN from the detail screen. `reload` also repaints the day-count dots, which a
   * create or a delete moves.
   *
   * Skips the FIRST focus — the list effect already fetched on mount, and firing both sends two
   * identical requests and lets the slower one overwrite the newer rows. A ref rather than state so
   * it survives the re-subscription when `reload`'s identity changes; `addListener` rather than
   * `useFocusEffect` because this screen is also mounted standalone in the web preview.
   */
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

  /** Tapping a row opens the record; the quick-actions sheet moves to a long press. */
  const openDetail = useCallback(
    (appt: AppointmentRow) => {
      closeAll();
      navigation?.navigate('AppointmentDetail', { appointmentId: appt.id, mode: 'view' });
    },
    [closeAll, navigation],
  );

  const onAdd = useCallback(() => {
    closeAll();
    navigation?.navigate('AppointmentDetail', { mode: 'add' });
  }, [closeAll, navigation]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const changeStatus = useCallback(
    async (appt: AppointmentRow, status: string) => {
      const res = await activeModule.updateAppointmentStatus?.(appt.id, status);
      if (res?.success) {
        closeAll();
        reload();
        return;
      }
      // Dismiss first: the action was refused, and leaving the sheet up invites a retry loop
      // against a lock that will not clear from here.
      closeAll();
      const cancelling = status === 'CANCELLED';
      showToast(
        (res as any)?.code === 'APPOINTMENT_LOCKED'
          ? `This appointment is on a finalized bill. Cancel that bill before you can ${
              cancelling ? 'cancel' : 'update'
            } the appointment.`
          : 'Something went wrong while updating this appointment. Please try again.',
        'error',
        {
          title: cancelling ? "Couldn't cancel appointment" : "Couldn't update appointment",
          // Two lines of copy that tell the user to go do something else — 3500ms is not enough.
          duration: 5000,
        },
      );
    },
    [activeModule, reload, closeAll, showToast],
  );

  const submitReschedule = useCallback(
    async (appt: AppointmentRow, when: Date) => {
      // Zone-less IST wall clock, built from local parts. NEVER toISOString() — that emits UTC and
      // the server would re-read the shifted clock as IST, landing 5h30m off.
      const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const wire =
        `${when.getFullYear()}-${p(when.getMonth() + 1)}-${p(when.getDate())}` +
        `T${p(when.getHours())}:${p(when.getMinutes())}:00`;

      const res = await activeModule.rescheduleAppointment?.(appt.id, wire);
      if (res?.success) {
        closeAll();
        // The row may have moved to another day: refetch the list AND the dots so both the old and
        // the new day repaint.
        reload();
        showToast(
          `Moved to ${formatDayHeading(when)}, ${formatApptTime(`${p(when.getHours())}:${p(when.getMinutes())}`)}`,
          'success',
          {
            title: 'Appointment rescheduled',
          },
        );
        return;
      }
      closeAll();
      showToast(
        (res as any)?.code === 'APPOINTMENT_LOCKED'
          ? 'This appointment is on a finalized bill. Cancel that bill before you can reschedule it.'
          : 'Something went wrong while rescheduling. Please try again.',
        'error',
        { title: "Couldn't reschedule", duration: 5000 },
      );
    },
    [activeModule, reload, closeAll, showToast],
  );

  const contactCustomer = useCallback((appt: AppointmentRow) => {
    const target = appt.phone ? `tel:${appt.phone}` : appt.email ? `mailto:${appt.email}` : null;
    if (target) Linking.openURL(target).catch(() => {});
  }, []);

  /**
   * Tapping a day on the strip or the calendar. Tapping the one already selected DESELECTS it and
   * drops the screen into all-dates mode; every other tap selects, from either state.
   *
   * The month anchor follows the tap even when the tap deselected, so the calendar does not jump
   * back to another month the instant the highlight clears.
   */
  const openDay = useCallback((ymd: string) => {
    setSelectedDate((current) => toggleDaySelection(current, ymd));
    setAnchorDate(ymd);
    const d = parseYmd(ymd);
    setAnchorMonth({ y: d.getFullYear(), m: d.getMonth() });
  }, []);

  // ── Row renderer ───────────────────────────────────────────────────────────
  const renderRow = useCallback(
    (item: AppointmentRow) => {
      const st = theme.status[item.status] ?? theme.status.FALLBACK;
      const pair = theme.avatar.forName(item.serviceName);
      const showAmount = view === 'DAY' || view === 'ALL' || view === 'SEARCH_RESULTS';
      // Only search: the all-dates list carries the date in its section headings instead, and
      // repeating it on every row would state the same thing twice a card apart.
      const showDate = view === 'SEARCH_RESULTS';

      return (
        <Pressable
          onPress={() => openDetail(item)}
          onLongPress={() => {
            setActiveAppt(item);
            setSheet('actions');
          }}
          // Only the all-dates list needs a row height, and only its first row answers — see
          // `measureCard`. The day and search lists measure their own cells the ordinary way.
          onLayout={view === 'ALL' ? measureCard : undefined}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          android_ripple={{ color: palette.divider }}
          accessibilityRole="button"
          accessibilityLabel={`${item.appointmentNumber} · ${item.customerName}`}
        >
          <View style={styles.timeCol}>
            {/*
              Both capped at one line so the card's height cannot depend on which appointment it
              is. The gutter is a fixed 46px, so at a large system text size "12:30" wraps where
              "9:15" still fits — two rows of different heights, and a `getItemLayout` that is
              right for one of them. "AM" and "PM" are not the same width either.
            */}
            <Text style={styles.timeClock} numberOfLines={1}>
              {apptClock(item.time)}
            </Text>
            <Text style={styles.timeMeridiem} numberOfLines={1}>
              {apptMeridiem(item.time)}
            </Text>
          </View>

          <View style={styles.cardDivider} />

          <View style={[styles.serviceTile, { backgroundColor: pair.bg + '1F' }]}>
            <Scissors size={18} color={pair.bg} />
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.customerName}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.appointmentNumber}
              {showDate && item.date ? ` · ${formatDayCompact(parseYmd(item.date))}` : ''}
            </Text>
          </View>

          <View style={styles.cardRight}>
            {showAmount && <Text style={styles.amount}>{formatAmount(item.amount)}</Text>}
            <View style={[styles.pill, { backgroundColor: st.bg }]}>
              <Text style={[styles.pillText, { color: st.text }]}>
                {STATUS_LABEL[item.status] ?? item.status}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [theme, styles, palette.divider, view, openDetail, measureCard],
  );

  // ── Body ───────────────────────────────────────────────────────────────────
  //
  // One section with a blank date for the single-day and search lists — `renderSectionHeader`
  // draws nothing for those, exactly as before. All-dates gets one section per date.
  const sections = useMemo(
    () =>
      isAll
        ? // `key` matters here and only here: without it SectionList keys sections by INDEX, and
          // every future page prepended at the top shifts every index below it, remounting the
          // whole list under the user.
          allSections.map((s) => ({ key: s.date, date: s.date, data: s.data }))
        : [{ key: 'single', date: '', data: rows }],
    [isAll, allSections, rows],
  );

  // The header is an overlay now, so every body branch has to reserve its height or it renders
  // underneath. The list gets it through contentContainerStyle; the hero/skeleton blocks need it
  // as real padding.
  const { headerProps, listProps, headerHeight } = useCollapsingHeader({
    pinned: !headerCollapses(view),
    refreshing,
    contentBottomPadding: LIST_BOTTOM_PAD,
  });
  const bodyInset = useMemo(() => ({ paddingTop: headerHeight }), [headerHeight]);

  // ── The opening scroll onto today ──────────────────────────────────────────
  //
  // `initialNumToRender` sized to reach today's section header, so the first commit already paints
  // the rows the scroll is about to land on instead of a blank band the windowing fills in
  // afterwards. Bounded by construction: the future bucket's page 1 is PAGE_SIZE rows, so the
  // worst case is PAGE_SIZE rows each on their own date, i.e. 3 * PAGE_SIZE + 1 cells.
  //
  // It is no longer what makes the scroll land — `getItemLayout` is, below — but it is still the
  // fallback for the first commit of a fresh entry, where nothing has been measured yet and there
  // is therefore no `getItemLayout` to hand the list.
  //
  // Deliberately keyed on `anchorNonce` alone. The state writes that end `loadAllDates` are
  // batched, so the render that bumps the nonce is the render that first holds the complete
  // sections — and pinning the value there keeps VirtualizedList's initial window from growing
  // every time a further future page is prepended.
  const anchorIndexRef = useRef(-1);
  const anchorRetryRef = useRef(0);
  const anchorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Appointments is a tab screen, so it stays mounted — but a retry armed as the user navigates
  // away would still fire into a list that has moved on. Nothing else clears this one: the anchor
  // effect owns only the timer IT starts, and the retry chain re-arms from inside the failure
  // handler, outside any effect's reach.
  useEffect(
    () => () => {
      if (anchorTimerRef.current) clearTimeout(anchorTimerRef.current);
    },
    [],
  );
  const anchorFailedRef = useRef(false);
  const initialCells = useMemo(() => {
    if (!isAll) return undefined;
    const index = anchorSectionIndex(allSections, todayYmd);
    if (index <= 0) return undefined;
    return sectionHeaderCellIndex(allSections, index) + 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorNonce]);

  /**
   * The all-dates list's cell geometry, or null until both cells have been measured.
   *
   * `contentStart` is the one term that is easy to leave out and impossible to notice missing from
   * the arithmetic alone: VirtualizedList hands whatever `getItemLayout` returns straight to
   * `scrollTo`, and that offset is counted from the top of the CONTENT CONTAINER — above the top
   * cap and inside the padding that reserves the collapsing header. `headerHeight` here is the
   * very same value `useCollapsingHeader` puts in `contentContainerStyle.paddingTop`, so the two
   * cannot drift apart.
   */
  const allCellMetrics = useMemo<AllDatesCellMetrics | null>(() => {
    if (!isAll || !cellsMeasured) return null;
    return {
      row: cardHeight + CARD_GAP,
      sectionHeader: bandHeight,
      // No `renderSectionFooter` is passed, so the cell VirtualizedSectionList reserves for one
      // renders nothing and measures zero. It still owns an index — see AllDatesCellMetrics.
      sectionFooter: 0,
      contentStart: headerHeight + ALL_TOP_CAP_HEIGHT,
    };
  }, [isAll, cellsMeasured, cardHeight, bandHeight, headerHeight]);

  /**
   * Undefined until the metrics exist, and that ordering is the point: a `getItemLayout` present
   * before the heights are known would answer with zeros, and VirtualizedList trusts it absolutely
   * — supplying one stops it measuring cells at all (`shouldListenForLayout`), so there would be
   * nothing left to correct the guess with. Absent, the list measures as it always did.
   *
   * The cost of arriving late is a known and deliberately small one. On the FIRST all-dates entry
   * of a screen session the initial cells are measured before this appears, and those measurements
   * are then frozen — VirtualizedList prefers a measured frame over a computed one and will never
   * re-measure that cell again. They agree with the computed offsets until something above them
   * resizes, and the one thing that can is the collapsing header: opening the month grid WITHOUT
   * picking a day leaves those first cells reporting pre-grid offsets while the rest report
   * post-grid ones, which can put the render window a few rows out until the list next remounts
   * (any day↔all-dates move does that, and every later entry has the heights already latched, so
   * nothing is measured and the whole table is computed). Not worth a probe row rendered off-screen
   * to pre-measure: that probe would have to be a copy of the real card, and a copy that drifts is
   * exactly the lying geometry this is all avoiding.
   */
  const allDatesItemLayout = useMemo(() => {
    if (!allCellMetrics) return undefined;
    return (_: unknown, index: number) => allDatesCellLayout(sections, index, allCellMetrics);
  }, [allCellMetrics, sections]);

  const scrollToAnchor = useCallback(() => {
    // The index belongs to the all-dates sections, so it is meaningless against any other list. A
    // retry armed here can outlive the mode: tap a day while one is pending and the day list — one
    // section, a handful of rows — receives a section index computed for a dozen. RN does not
    // ignore that. `scrollToLocation` walks `this.props.sections[i].data` and either throws
    // "scrollToIndex out of range" or dereferences undefined, uncaught, inside a bare timer.
    if (!isAll) {
      anchorPendingRef.current = false;
      return;
    }
    if (anchorIndexRef.current < 0) {
      anchorPendingRef.current = false;
      return;
    }
    // `scrollToIndex` calls `onScrollToIndexFailed` SYNCHRONOUSLY and returns, so this flag is
    // already true or false by the line after the call.
    anchorFailedRef.current = false;
    sectionListRef.current?.scrollToLocation({
      sectionIndex: anchorIndexRef.current,
      // itemIndex 0 is the SECTION HEADER cell, not the first row — see
      // VirtualizedSectionList.scrollToLocation. That is what puts the date band at the top.
      itemIndex: 0,
      animated: false,
      viewPosition: 0,
      // Deliberately not flush with the top, and deliberately not `headerHeight` either.
      //
      // Flush would be the obvious reading of "open on today", but it hides the one thing this list
      // does differently from every other list in the app: it runs BACKWARDS, so what is above the
      // fold is the future. A day landing hard against the top edge looks like the start of the
      // list, and nothing invites the upward scroll that reveals next week.
      //
      // So leave a slice of the previous group showing. It reads as "there is more above", which is
      // the only honest way to advertise a direction the user cannot otherwise guess.
      //
      // `headerHeight` was the original value and it was wrong by accident rather than by intent:
      // the header is an overlay that auto-hides on a downward scroll, and this anchor is always a
      // downward jump, so it has translated away by the time the jump lands. Reserving its full
      // height pushed today a whole header down — measured at 169px, with two entire date groups
      // stacked above the day the list is meant to open on. That is a peek turning into a scroll.
      viewOffset: ANCHOR_PEEK,
    });
    // Only now may upward paging start. Opening the gate while a retry is still pending would let
    // a future page prepend under a scroll that has not landed, moving the target mid-flight.
    if (!anchorFailedRef.current) anchorPendingRef.current = false;
  }, [isAll]);

  // Runs on a fresh pair of page-1s, AND again the moment the two cells are first measured.
  //
  // The second trigger is what makes a fresh entry land. The list mounts with nothing measured, so
  // the commit that first holds the sections has no `getItemLayout` yet and the scroll it fires is
  // still refused. The card and the band report their layout one commit later; that flips
  // `cellsMeasured`, this effect runs a second time, and by then the offsets are computable and
  // `scrollToIndex` cannot refuse. On any later entry the heights are already latched, so the flag
  // no longer changes and this runs once, on the nonce.
  //
  // `isAll` is read but deliberately not a dependency. The guard is needed, but not for the reason
  // an earlier draft of this comment gave: it claimed leaving all-dates flips `cellsMeasured` back
  // to false and re-runs this. It does not — the heights latch once and are never reset, so neither
  // dependency moves on the way out. What the guard actually catches is `cellsMeasured` turning
  // TRUE on the same commit that leaves the mode, which would aim an all-dates section index at the
  // single-day list. Worth stating correctly: a reader who checks the old claim finds it false and
  // concludes the guard is dead.
  useEffect(() => {
    if (!isAll || anchorNonce === 0) return;
    anchorRetryRef.current = 0;
    anchorIndexRef.current = anchorSectionIndex(allSections, todayYmd);
    // Index 0 (or none at all) already IS the top of the list — a business with no future, or with
    // nothing anywhere. Scrolling there is a no-op that would still burn the retry budget against
    // frames this commit has not measured yet, so open the paging gate and leave it alone.
    if (anchorIndexRef.current <= 0) {
      anchorPendingRef.current = false;
      return;
    }
    // Deferred a tick: the cells rendered by this commit have not reported their layout yet, and
    // an unmeasured frame is what scrollToLocation refuses while there is no `getItemLayout`.
    const t = setTimeout(scrollToAnchor, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorNonce, cellsMeasured]);

  /**
   * The frames were still not measured. Retry a few times, then stop.
   *
   * Reachable only while `getItemLayout` is absent — with one supplied, `scrollToIndex` skips the
   * measurement check entirely and this cannot fire. So it is now the path for the single commit
   * between "the rows are on screen" and "the first card has reported its height", plus whatever
   * device never delivers that layout at all.
   *
   * Bounded on purpose: an unbounded retry against a list that genuinely cannot reach the index
   * spins forever, and the fallback — sitting at the top of the future — is a real list the user
   * can scroll rather than a broken screen.
   */
  const onScrollToIndexFailed = useCallback(() => {
    anchorFailedRef.current = true;
    if (anchorRetryRef.current >= 3) {
      anchorPendingRef.current = false;
      return;
    }
    anchorRetryRef.current += 1;
    // Owned, so leaving the screen or the mode does not leave a scroll armed against a list that is
    // no longer there. `scrollToAnchor` guards on `isAll` as well — belt and braces, because the
    // guard alone still lets a timer fire into an unmounted tree.
    if (anchorTimerRef.current) clearTimeout(anchorTimerRef.current);
    anchorTimerRef.current = setTimeout(scrollToAnchor, 80);
  }, [scrollToAnchor]);

  // List footer: the spinner while a further page lands, otherwise the mockup's end-of-day marker.
  //
  // The marker is only honest on the DAY surface — "scheduled today" is nonsense against a search
  // result set spanning every date. Completeness is judged against dayCounts rather than a page
  // counter because that is already the authoritative total for the day (the list itself is
  // page-capped, which is why the count line reads from the same place).
  const dayFullyLoaded = rows.length > 0 && rows.length >= dayTotal;
  const footer = useMemo(() => {
    // All-dates: the bottom of the list is the OLDEST appointment, and completeness is the past
    // bucket's own page counter — dayCounts describes one day and says nothing about it.
    if (isAll) {
      if (pastLoading) {
        return (
          <View style={styles.footer}>
            <ActivityIndicator color={colors.primary} />
          </View>
        );
      }
      if (pastDone) {
        return (
          <View style={styles.endOfDay}>
            <CalendarCheck size={16} color={palette.muted} />
            <Text style={styles.endOfDayText}>That's the whole history</Text>
          </View>
        );
      }
      return null;
    }
    if (activeModule.loading && rows.length > 0) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (surface === 'DAY' && mode === 'browse' && dayFullyLoaded) {
      return (
        <View style={styles.endOfDay}>
          <CalendarCheck size={16} color={palette.muted} />
          <Text style={styles.endOfDayText}>Nothing more scheduled today</Text>
        </View>
      );
    }
    return null;
  }, [
    isAll,
    pastLoading,
    pastDone,
    activeModule.loading,
    rows.length,
    surface,
    mode,
    dayFullyLoaded,
    styles,
    colors.primary,
    palette.muted,
  ]);

  /**
   * The all-dates list's TOP cap — the far end of the future.
   *
   * Always rendered in this mode and always {@link ALL_TOP_CAP_HEIGHT} tall, which is why the
   * third state — more pages exist, none in flight — is an empty spacer rather than nothing.
   */
  const topCap = useMemo(() => {
    if (!isAll) return null;
    return (
      <View style={styles.topCap}>
        {futureLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : futureDone ? (
          <>
            <CalendarClock size={16} color={palette.muted} />
            <Text style={styles.endOfDayText}>Nothing scheduled further ahead</Text>
          </>
        ) : null}
      </View>
    );
  }, [isAll, futureLoading, futureDone, styles, colors.primary, palette.muted]);

  let body: React.ReactNode;

  if (view === 'ERROR') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<CircleX size={40} color={palette.muted} />}
        headline="Couldn't load appointments"
        sub="Something went wrong while loading. Check your connection and try again."
        ctaLabel="Retry"
        onCta={reload}
        colors={colors}
      />
    );
  } else if (
    view === 'LOADING' ||
    view === 'CALENDAR_LOADING' ||
    view === 'ALL_LOADING' ||
    view === 'SEARCHING'
  ) {
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
        headline="No appointments found"
        // Not "try a different name": customer-name search is deliberately unsupported by the
        // backend, so suggesting a name points the user at the one thing that cannot work.
        sub={`No appointments match '${debouncedSearch}'. Try a phone number, email or appointment number.`}
        colors={colors}
      />
    );
  } else if (view === 'DAY_EMPTY' || view === 'CALENDAR_EMPTY') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<CalendarDays size={40} color={palette.muted} />}
        headline="No appointments"
        sub="Nothing scheduled for this day. Book one to get started."
        ctaLabel="New Appointment"
        onCta={onAdd}
        colors={colors}
      />
    );
  } else if (view === 'ALL_EMPTY') {
    // Distinct copy from DAY_EMPTY on purpose: no day is selected here, so "nothing scheduled for
    // this day" would point at a day the user cannot see and send them hunting through the strip
    // for a day that has something on it. This state means the business has nothing, ever.
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<CalendarDays size={40} color={palette.muted} />}
        headline="No appointments yet"
        sub="Nothing booked on any date — past or upcoming. Book one to get started."
        ctaLabel="New Appointment"
        onCta={onAdd}
        colors={colors}
      />
    );
  } else {
    body = (
      <AnimatedSectionList
        // Remounts between the single-date list and the all-dates one. Their scroll offsets mean
        // different things, and `initialNumToRender` is read at mount — reusing one instance would
        // carry the day list's window into a list that has to open part-way down.
        //
        // Re-keying on a data-ready flag as well was tried, to remount the list with a window
        // sized for the sections it now has, and it does NOT work: the anchor fires on the same
        // batched render, so the scroll lands on the instance being replaced and the new one
        // starts at zero. Reverted. What fixes the opening scroll is `getItemLayout` below.
        //
        // Day↔search deliberately share a key, so that transition behaves exactly as it did.
        key={isAll ? 'all' : 'single'}
        ref={sectionListRef}
        {...listProps}
        sections={sections}
        keyExtractor={(item: AppointmentRow) => String(item.id)}
        renderSectionHeader={({ section }: { section: { date: string } }) =>
          section.date ? (
            // Only the all-dates list draws a band at all — the day and search lists pass one
            // section with a blank date — so this onLayout only ever reports an all-dates cell.
            <View style={styles.dateBand} onLayout={measureBand}>
              {/*
                One line, so every band is the same height. "YESTERDAY · WED, 23 SEPTEMBER" is
                nearly twice the width of "SUN, 27 APRIL", and at a large system text size the
                longer ones would wrap while the shorter ones did not.
              */}
              <Text style={styles.dateBandText} numberOfLines={1}>
                {sectionHeading(section.date, todayYmd)}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }: { item: AppointmentRow }) => renderRow(item)}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        // Scrolling UP walks into the future. Only the all-dates list has anything above it.
        onStartReached={isAll ? loadMoreFuture : undefined}
        onStartReachedThreshold={0.3}
        maintainVisibleContentPosition={isAll ? MAINTAIN_POSITION : undefined}
        // Gated on `isAll` as well as computed under it: `initialCells` is memoised on the anchor
        // nonce and therefore survives the switch back to a single day, where an inflated initial
        // window would make the day list render forty cells to show three.
        initialNumToRender={isAll ? initialCells : undefined}
        // What actually lands the opening scroll. `scrollToIndex` refuses any cell past the
        // highest frame it has MEASURED — and today's group sits below every future date, so on
        // the first commit it is always past that mark — but the refusal only exists while there
        // is no `getItemLayout`. With one, the offset is computed and the check is skipped.
        //
        // Already undefined outside all-dates and until the two cells have been measured; no
        // second gate here, so there is one place that decides whether the geometry is known.
        getItemLayout={allDatesItemLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}
        ListHeaderComponent={topCap}
        // Explicit, and load-bearing: the default is true on iOS, which would pin the date bands
        // at scroll-view y=0 — i.e. behind the overlay header — then pop them into view the moment
        // it collapses. It would also fight maintainVisibleContentPosition, whose anchor is a
        // content child that a stuck header has been lifted out of the flow of.
        stickySectionHeadersEnabled={false}
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
        ListFooterComponent={footer}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  const searching = mode === 'search';

  // The header is rendered as an overlay AFTER the body so Android's paint order agrees with its
  // zIndex. It translates off-screen on a downward scroll and back on an upward one; see
  // CollapsingHeader for why it is absolute rather than laid out above the list.
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
              placeholder="Search by phone, email or #..."
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
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>Appointments</Text>
              <Text style={styles.subtitle}>
                {selectedDate ? formatDayHeading(parseYmd(selectedDate)) : 'All dates'}
              </Text>
            </View>
            <Pressable
              style={styles.calBtn}
              onPress={() => setSurface((s) => (s === 'DAY' ? 'CALENDAR' : 'DAY'))}
              android_ripple={{ color: palette.divider }}
              accessibilityRole="button"
              accessibilityLabel={surface === 'DAY' ? 'Open calendar' : 'Back to day view'}
            >
              <CalendarDays
                size={19}
                color={surface === 'CALENDAR' ? colors.primary : palette.muted}
              />
            </Pressable>
          </View>

          {view !== 'ERROR' && surface === 'DAY' && (
            <Pressable style={styles.searchBox} onPress={() => setMode('search')}>
              <Search size={17} color={palette.muted} />
              <Text style={styles.searchPlaceholder}>Search by phone, email or #...</Text>
            </Pressable>
          )}
        </>
      )}

      {showsDateNav(view) &&
        (surface === 'CALENDAR' ? (
          <MonthGrid
            styles={styles}
            colors={colors}
            palette={palette}
            anchor={anchorMonth}
            selectedDate={selectedDate}
            counts={dayCounts}
            onPickDate={openDay}
            onShiftMonth={(delta) =>
              setAnchorMonth(({ y, m }) => {
                const next = new Date(y, m + delta, 1);
                return { y: next.getFullYear(), m: next.getMonth() };
              })
            }
          />
        ) : (
          <WeekStrip
            styles={styles}
            colors={colors}
            anchorDate={anchorDate}
            selectedDate={selectedDate}
            counts={dayCounts}
            onPickDate={openDay}
          />
        ))}

      {/* Count line. Sourced from dayCounts, never rows.length — the list is page-capped, so a busy
          day would otherwise read "20 appointments" forever.

          The `selectedDate &&` is a type narrowing, not a behaviour change: DAY and CALENDAR are
          unreachable without a selected day — deriveView returns an ALL_* state instead. */}
      {(view === 'DAY' || view === 'CALENDAR') && selectedDate && (
        <Text style={surface === 'CALENDAR' ? styles.calendarStamp : styles.dayCountLine}>
          {surface === 'CALENDAR'
            ? `${formatDayStamp(parseYmd(selectedDate))}   ·   ${dayTotal} appointment${
                dayTotal === 1 ? '' : 's'
              }`
            : `${dayTotal} appointment${dayTotal === 1 ? '' : 's'}${
                selectedDate === todayYmd ? ' today' : ''
              }`}
        </Text>
      )}

      {/* No number here, deliberately. The two buckets report pages, not row totals, so any figure
          would be "however much has been paged in so far" dressed up as a count. What the line does
          carry is the one thing the ordering is not self-evident about: up is later. */}
      {view === 'ALL' && (
        <Text style={styles.dayCountLine}>All dates · newest first, scroll up for later</Text>
      )}

      {view === 'SEARCH_RESULTS' && (
        <Text style={styles.searchResultLine}>
          {`${rows.length} result${rows.length === 1 ? '' : 's'} for '${debouncedSearch}'`}
        </Text>
      )}
    </CollapsingHeader>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {body}

      {header}

      {/* Two create affordances, one handler. `showsFab` also covers the empty views, so here the
          hero CTA and the FAB are both on screen at once — wiring one and not the other would
          leave two identical-looking buttons behaving differently. */}
      {showsFab(view) && <FAB accessibilityLabel="New appointment" onPress={onAdd} />}

      {/* Each overlay is gated at render level rather than on Modal's `visible` prop alone:
          react-native-web keeps a Modal's portal mounted after `visible` flips to false, which
          leaves stale sheets stacked on screen. */}
      {sheet === 'actions' && activeAppt && (
        <ActionsSheet
          appt={activeAppt}
          styles={styles}
          theme={theme}
          onClose={closeAll}
          onPickStatus={(status) => {
            if (status === 'CANCELLED') {
              setDialog('cancelConfirm');
              return;
            }
            changeStatus(activeAppt, status);
          }}
          onReschedule={() => setSheet('reschedule')}
          onContact={() => {
            contactCustomer(activeAppt);
            closeAll();
          }}
        />
      )}

      {sheet === 'reschedule' && activeAppt && (
        <RescheduleSheet
          appt={activeAppt}
          styles={styles}
          colors={colors}
          onCancel={() => setSheet('actions')}
          onConfirm={(when) => submitReschedule(activeAppt, when)}
        />
      )}

      {dialog === 'cancelConfirm' && activeAppt && (
        <ConfirmDialog
          visible
          title="Cancel this appointment?"
          message={`Appointment ${activeAppt.appointmentNumber} for ${
            activeAppt.customerName
          } will be cancelled and its ${formatApptTime(
            activeAppt.time,
          )} slot released. This can't be undone.`}
          confirmLabel="Cancel appointment"
          cancelLabel="Keep appointment"
          danger
          onConfirm={() => changeStatus(activeAppt, 'CANCELLED')}
          onCancel={() => setDialog(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Week strip ──────────────────────────────────────────────────────────────
// No ‹ › arrows: the mockup has none, and cross-week navigation is what the calendar view is for.

/**
 * The mockup's density indicator: one 4px dot per appointment on that day, capped by
 * {@link dayDotCount}. The row renders even at zero so every cell keeps the same height and the
 * grid doesn't jitter as counts arrive.
 */
function DayDots({ styles, count, color }: { styles: any; count: number; color: string }) {
  return (
    <View style={styles.dotRow}>
      {Array.from({ length: dayDotCount(count) }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

function WeekStrip({
  styles,
  colors,
  anchorDate,
  selectedDate,
  counts,
  onPickDate,
}: {
  styles: any;
  colors: any;
  /** Which week is on screen. Follows every tap, including the one that clears the selection. */
  anchorDate: string;
  /**
   * Which day is highlighted, or null. Null is the "disabled" strip: the week is still there and
   * still tappable, and no cell is lit — that IS the all-dates mode's indicator, so it must not be
   * substituted with a highlight on today.
   */
  selectedDate: string | null;
  counts: Record<string, number>;
  onPickDate: (ymd: string) => void;
}) {
  const days = useMemo(() => weekDays(parseYmd(anchorDate)), [anchorDate]);

  return (
    <View style={styles.weekStrip}>
      {days.map((d, i) => {
        const ymd = toYmd(d);
        const active = ymd === selectedDate;
        return (
          <Pressable
            key={ymd}
            // flex, not a computed width: a measured width breaks in the web preview where
            // Dimensions reports the browser rather than the phone frame.
            style={[
              styles.weekDay,
              active && { backgroundColor: colors.softBg, borderColor: colors.primary },
            ]}
            onPress={() => onPickDate(ymd)}
          >
            <Text style={[styles.weekLabel, active && { color: colors.primary }]}>
              {WEEK_LABELS[i]}
            </Text>
            <Text style={[styles.weekNum, active && { color: colors.primary }]}>{d.getDate()}</Text>
            <DayDots
              styles={styles}
              count={counts[ymd] ?? 0}
              color={active ? colors.primary : colors.secondary}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Month grid ──────────────────────────────────────────────────────────────

function MonthGrid({
  styles,
  colors,
  palette,
  anchor,
  selectedDate,
  counts,
  onPickDate,
  onShiftMonth,
}: {
  styles: any;
  colors: any;
  palette: any;
  anchor: { y: number; m: number };
  /** Null while no day is selected — no cell is filled, same as the week strip. */
  selectedDate: string | null;
  counts: Record<string, number>;
  onPickDate: (ymd: string) => void;
  onShiftMonth: (delta: number) => void;
}) {
  const { days } = useMemo(() => monthGrid(anchor.y, anchor.m), [anchor.y, anchor.m]);
  const weeks = useMemo(
    () => Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7)),
    [days],
  );

  return (
    <View style={styles.monthWrap}>
      <View style={styles.monthHeader}>
        <Pressable
          onPress={() => onShiftMonth(-1)}
          hitSlop={12}
          accessibilityLabel="Previous month"
        >
          <ChevronLeft size={20} color={palette.muted} />
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthLabel(anchor.y, anchor.m)}</Text>
        <Pressable onPress={() => onShiftMonth(1)} hitSlop={12} accessibilityLabel="Next month">
          <ChevronRight size={20} color={palette.muted} />
        </Pressable>
      </View>

      <View style={styles.gridRow}>
        {GRID_LABELS.map((l, i) => (
          <Text key={`${l}${i}`} style={styles.gridHeadCell}>
            {l}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.gridRow}>
          {week.map((d) => {
            const ymd = toYmd(d);
            const active = ymd === selectedDate;
            const outside = d.getMonth() !== anchor.m;
            return (
              <Pressable key={ymd} style={styles.gridCell} onPress={() => onPickDate(ymd)}>
                {/* The selected pill is the whole cell, not a circle around the number — the dots
                    sit inside it and flip to white, which is what the mockup specifies. */}
                <View style={[styles.gridDayBox, active && { backgroundColor: colors.primary }]}>
                  <Text
                    style={[
                      styles.gridDayText,
                      outside && styles.gridDayOutside,
                      active && styles.gridDayActive,
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                  <DayDots
                    styles={styles}
                    count={counts[ymd] ?? 0}
                    color={active ? '#ffffff' : colors.secondary}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Skeleton + hero ─────────────────────────────────────────────────────────

function SkeletonRow({ styles }: { styles: any }) {
  return (
    <View style={styles.card}>
      <View style={styles.timeCol}>
        <View style={styles.skelTime} />
      </View>
      <View style={styles.skelTile} />
      <View style={styles.cardBody}>
        <View style={styles.skelLineWide} />
        <View style={styles.skelLineNarrow} />
      </View>
      <View style={styles.cardRight}>
        <View style={styles.skelPill} />
      </View>
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
  /** Reserves the overlay header's height so the block centres in the visible region. */
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

// ─── Actions sheet ───────────────────────────────────────────────────────────

function ActionsSheet({
  appt,
  styles,
  theme,
  onClose,
  onPickStatus,
  onReschedule,
  onContact,
}: {
  appt: AppointmentRow;
  styles: any;
  theme: AppTheme;
  onClose: () => void;
  onPickStatus: (status: string) => void;
  onReschedule: () => void;
  onContact: () => void;
}) {
  // The screen's SafeAreaView omits the bottom edge and a Modal renders outside it anyway, so a
  // sheet gets no inset from anywhere — without this the nav bar clips the last row.
  const insets = useSafeAreaInsets();
  const st = theme.status[appt.status] ?? theme.status.FALLBACK;
  const pair = theme.avatar.forName(appt.serviceName);
  const actions = QUICK_STATUSES.filter((a) => a.status !== appt.status);
  const canReschedule = !TERMINAL_STATUSES.includes(appt.status);

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
            <Scissors size={18} color={pair.bg} />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.summaryName} numberOfLines={1}>
              {appt.customerName}
            </Text>
            <Text style={styles.summaryMeta} numberOfLines={1}>
              {`${serviceSummary(appt)} · ${formatApptTime(appt.time)} · ${appt.appointmentNumber}`}
            </Text>
          </View>
          <View style={[styles.pill, { backgroundColor: st.bg }]}>
            <Text style={[styles.pillText, { color: st.text }]}>
              {STATUS_LABEL[appt.status] ?? appt.status}
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
              <View style={styles.actionLabels}>
                <Text
                  style={[styles.actionLabel, (a as any).danger && { color: theme.palette.error }]}
                >
                  {a.label}
                </Text>
                {(a as any).sub && <Text style={styles.actionSub}>{(a as any).sub}</Text>}
              </View>
            </Pressable>
          );
        })}

        <View style={styles.sheetDivider} />

        {canReschedule && (
          <Pressable
            style={styles.actionRow}
            onPress={onReschedule}
            android_ripple={{ color: theme.palette.divider }}
          >
            <CalendarClock size={19} color={theme.palette.muted} />
            <View style={styles.actionLabels}>
              <Text style={styles.actionLabel}>Reschedule</Text>
              <Text style={styles.actionSub}>Update date &amp; time</Text>
            </View>
          </Pressable>
        )}

        <Pressable
          style={styles.actionRow}
          onPress={onContact}
          android_ripple={{ color: theme.palette.divider }}
        >
          <Phone size={19} color={theme.palette.muted} />
          <View style={styles.actionLabels}>
            <Text style={styles.actionLabel}>Contact customer</Text>
            <Text style={styles.actionSub}>Call or email</Text>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Reschedule sheet ────────────────────────────────────────────────────────

function RescheduleSheet({
  appt,
  styles,
  colors,
  onCancel,
  onConfirm,
}: {
  appt: AppointmentRow;
  styles: any;
  colors: any;
  onCancel: () => void;
  onConfirm: (when: Date) => void;
}) {
  const insets = useSafeAreaInsets();
  // Seeded from the row's own IST date/time, so the picker opens where the appointment already is.
  const [when, setWhen] = useState(() => {
    const base = appt.date ? parseYmd(appt.date) : new Date();
    const [h, m] = (appt.time || '09:00').split(':').map(Number);
    base.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
    return base;
  });
  const [step, setStep] = useState<'date' | 'time'>('date');
  const [picking, setPicking] = useState(true);

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.sheetOverlay} onPress={onCancel} />
      <View style={[styles.sheetTight, { paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.grabberWrap}>
          <View style={styles.grabber} />
        </View>

        <View style={styles.rescheduleHead}>
          <Text style={styles.summaryName}>Reschedule</Text>
          <Text style={styles.summaryMeta}>
            {`${formatDayHeading(when)} · ${formatApptTime(
              `${when.getHours() < 10 ? '0' : ''}${when.getHours()}:${
                when.getMinutes() < 10 ? '0' : ''
              }${when.getMinutes()}`,
            )}`}
          </Text>
        </View>

        {picking && (
          <DateTimePicker
            value={when}
            mode={step}
            onChange={(_e: unknown, picked?: Date) => {
              setPicking(false);
              if (!picked) return;
              const next = new Date(when);
              if (step === 'date') {
                next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
                setWhen(next);
                // Two-step: date, then straight into time, matching how a reschedule is thought of.
                setStep('time');
                setPicking(true);
              } else {
                next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
                setWhen(next);
              }
            }}
          />
        )}

        <View style={styles.rescheduleActions}>
          <Pressable style={styles.rescheduleGhost} onPress={onCancel}>
            <Text style={styles.rescheduleGhostLabel}>Back</Text>
          </Pressable>
          <Pressable
            style={[styles.rescheduleConfirm, { backgroundColor: colors.primary }]}
            onPress={() => onConfirm(when)}
          >
            <Text style={styles.rescheduleConfirmLabel}>Save new time</Text>
          </Pressable>
        </View>

        {!picking && (
          <Pressable
            style={styles.reschedulePickAgain}
            onPress={() => {
              setStep('date');
              setPicking(true);
            }}
          >
            <Text style={styles.rescheduleGhostLabel}>Pick a different date</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  // Derived tertiary grey — one step dimmer than `muted`, for meta lines and section heads.
  const dim = theme.palette.muted + '8A';

  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.palette.background },

    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 8,
    },
    titleBlock: { flex: 1 },
    title: { fontSize: 28, fontWeight: '700', color: theme.palette.onBackground },
    subtitle: { fontSize: 13, color: theme.palette.muted, marginTop: 2 },
    calBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surface,
    },

    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 12,
      marginHorizontal: 18,
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surface,
    },
    searchPlaceholder: { fontSize: 14, color: theme.palette.muted },

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
      gap: 10,
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      backgroundColor: theme.palette.surface,
    },
    searchInput: { flex: 1, fontSize: 14, color: theme.palette.onBackground, padding: 0 },
    cancelText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

    // Week strip — flex per day so it adapts to any width.
    weekStrip: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 18,
      marginTop: 12,
    },
    weekDay: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surface,
      gap: 2,
    },
    weekLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4, color: dim },
    weekNum: { fontSize: 15, fontWeight: '700', color: theme.palette.onBackground },
    // Fixed height so a day with no appointments reserves the same space as a day with three.
    dotRow: { flexDirection: 'row', gap: 3, height: 4, marginTop: 3 },
    dot: { width: 4, height: 4, borderRadius: 2 },

    // Month grid
    monthWrap: { paddingHorizontal: 18, marginTop: 12 },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 8,
    },
    monthLabel: { fontSize: 15, fontWeight: '700', color: theme.palette.onBackground },
    gridRow: { flexDirection: 'row' },
    gridHeadCell: {
      flex: 1,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '600',
      color: dim,
      paddingBottom: 6,
    },
    gridCell: { flex: 1, paddingVertical: 2 },
    gridDayBox: {
      height: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gridDayText: { fontSize: 14, fontWeight: '500', color: theme.palette.onBackground },
    gridDayOutside: { color: dim },
    gridDayActive: { color: '#ffffff', fontWeight: '700' },

    dayCountLine: {
      fontSize: 12,
      fontWeight: '600',
      color: dim,
      paddingHorizontal: 18,
      marginTop: 14,
    },
    calendarStamp: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: dim,
      paddingHorizontal: 18,
      marginTop: 14,
    },
    searchResultLine: {
      fontSize: 12,
      color: theme.palette.muted,
      paddingHorizontal: 18,
      marginTop: 12,
    },

    // List
    // No `list` style: paddingTop is the measured header height (from useCollapsingHeader) and
    // paddingBottom is LIST_BOTTOM_PAD. The gap above the first row is LIST_TOP_PAD, held as the
    // header's own paddingBottom so it cannot scroll away.
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 16,
      marginBottom: CARD_GAP,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surface,
    },
    cardPressed: { opacity: 0.75 },
    timeCol: { width: 46, alignItems: 'center', gap: 1 },
    timeClock: { fontSize: 14, fontWeight: '700', color: theme.palette.onBackground },
    timeMeridiem: { fontSize: 10, fontWeight: '600', color: dim },
    cardDivider: { width: 1, height: 38, backgroundColor: theme.palette.divider },
    serviceTile: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBody: { flex: 1, gap: 3 },
    customerName: { fontSize: 14, fontWeight: '600', color: theme.palette.onBackground },
    cardMeta: { fontSize: 11.5, fontWeight: '500', color: dim },
    cardRight: { alignItems: 'flex-end', gap: 6 },
    amount: { fontSize: 15, fontWeight: '700', color: theme.palette.onBackground },
    pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

    // Skeleton
    //
    // No paddingTop here. `bodyInset` is paddingTop: headerHeight, and headerHeight is measured on
    // the header's inner view which already carries LIST_TOP_PAD as its paddingBottom — so the gap
    // above the first skeleton row is already there. A paddingTop on this style was dead (bodyInset
    // is spread after it) and would have doubled the gap if it had won.
    skeletonWrap: {},
    skelTime: { width: 34, height: 12, borderRadius: 6, backgroundColor: theme.palette.divider },
    skelTile: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.palette.divider },
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

    // Hero (empty / error / no-results)
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
      marginBottom: 6,
    },
    heroHeadline: { fontSize: 17, fontWeight: '700', color: theme.palette.onBackground },
    heroSub: { fontSize: 13, lineHeight: 19, color: theme.palette.muted, textAlign: 'center' },
    heroCta: {
      marginTop: 14,
      paddingHorizontal: 20,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCtaLabel: { fontSize: 14, fontWeight: '600', color: '#ffffff' },

    // All-dates date band. Same type treatment as the calendar's day stamp so the two read as one
    // family; the horizontal padding lines it up with the cards' 16px margin rather than the
    // header's 18px.
    dateBand: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },
    dateBandText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: dim },

    // Fixed height — see ALL_TOP_CAP_HEIGHT.
    topCap: {
      height: ALL_TOP_CAP_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },

    footer: { paddingVertical: 16 },
    endOfDay: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingTop: 16,
      paddingBottom: 6,
    },
    endOfDayText: { fontSize: 12.5, fontWeight: '500', color: dim },

    // Sheets
    sheetOverlay: { flex: 1, backgroundColor: theme.palette.overlay ?? '#00000088' },
    sheetTight: {
      backgroundColor: theme.palette.surfaceElevated ?? theme.palette.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      borderColor: theme.palette.divider,
      paddingTop: 10,
      gap: 4,
    },
    grabberWrap: { alignItems: 'center', paddingBottom: 6 },
    grabber: { width: 40, height: 4, borderRadius: 999, backgroundColor: theme.palette.divider },

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
    summaryText: { flex: 1, gap: 2 },
    summaryName: { fontSize: 15, fontWeight: '700', color: theme.palette.onBackground },
    summaryMeta: { fontSize: 12, color: dim },
    sheetDivider: { height: 1, backgroundColor: theme.palette.divider },
    actionsHeader: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: dim,
      paddingHorizontal: 22,
      paddingTop: 10,
      paddingBottom: 4,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 22,
      paddingVertical: 12,
    },
    actionLabels: { flex: 1, gap: 1 },
    actionLabel: { fontSize: 15, fontWeight: '500', color: theme.palette.onBackground },
    actionSub: { fontSize: 12, color: theme.palette.muted },

    // Reschedule
    rescheduleHead: { paddingHorizontal: 22, paddingBottom: 10, gap: 2 },
    rescheduleActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 22, paddingTop: 10 },
    rescheduleGhost: {
      flex: 1,
      height: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    rescheduleGhostLabel: { fontSize: 14, fontWeight: '600', color: theme.palette.muted },
    rescheduleConfirm: {
      flex: 1,
      height: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rescheduleConfirmLabel: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
    reschedulePickAgain: { alignItems: 'center', paddingTop: 12 },
  });
}

export default AppointmentsScreen;
