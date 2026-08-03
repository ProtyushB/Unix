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
import type { StyleProp, ViewStyle } from 'react-native';
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
import { CollapsingHeader, AnimatedSectionList } from '../../../components/layout/CollapsingHeader';
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
  type AppointmentView,
} from './appointment.view';

const PAGE_SIZE = 20;

/** Gap between the collapsing header and the first row. Lives on the header — see `gapBelow`. */
const LIST_TOP_PAD = 10;
/** FAB clearance, so the last card is never trapped under it. */
const LIST_BOTTOM_PAD = 100;

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

export function AppointmentsScreen() {
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
  const [selectedDate, setSelectedDate] = useState(() => toYmd(new Date()));
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetch A: the list ──────────────────────────────────────────────────────
  const listOpts = useMemo<AppointmentListOptions>(
    () =>
      mode === 'search'
        ? // Global across all dates: someone looking up a booking rarely knows which day it is on.
          { search: debouncedSearch, sortBy: 'appointmentDateTime', sortDir: 'desc' }
        : // Exactly one IST day, chronological. sortDir must be explicit — viewAll defaults to desc.
          {
            fromDate: selectedDate,
            toDate: selectedDate,
            sortBy: 'appointmentDateTime',
            sortDir: 'asc',
          },
    [mode, debouncedSearch, selectedDate],
  );

  const listKey = mode === 'search' ? `s:${debouncedSearch}` : `d:${selectedDate}`;

  useEffect(() => {
    // A search with no query yet has nothing to fetch — SEARCH_IDLE renders a blank body.
    if (mode === 'search' && !debouncedSearch) return;
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
    const week = weekDays(parseYmd(selectedDate));
    return { fromDate: toYmd(week[0]), toDate: toYmd(week[6]) };
  }, [mode, surface, selectedDate, anchorMonth]);

  const countsKey = countsWindow ? `${countsWindow.fromDate}:${countsWindow.toDate}` : '';

  useEffect(() => {
    if (!countsWindow) return;
    activeModule.loadAppointmentDayCounts?.(countsWindow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countsKey, moduleKey]);

  const dayCounts: Record<string, number> = activeModule.appointmentDayCounts ?? {};

  // ── Derived view ───────────────────────────────────────────────────────────
  const view: AppointmentView = deriveView({
    surface,
    mode,
    query: debouncedSearch,
    rowCount: rows.length,
    loadedOnce,
    hasError: !!activeModule.error,
  });

  /**
   * The day's count. Prefers the server's number, because the list is page-capped and a busy day
   * would otherwise read "20 appointments" forever.
   *
   * Falls back to the rows actually on screen when the map has no entry for this day — the counts
   * fetch is deliberately best-effort (it never sets `error`), so a 404 or a 500 would otherwise
   * print "0 appointments" above a full list. Absent means unknown, not zero.
   */
  const dayTotal = dayCounts[selectedDate] ?? rows.length;

  const onEndReached = useCallback(() => {
    if (loadingMoreRef.current || activeModule.loading) return;
    if (pageRef.current >= (activeModule.appointmentsTotalPages || 1)) return;
    loadingMoreRef.current = true;
    pageRef.current += 1;
    activeModule.loadAppointments(pageRef.current, PAGE_SIZE, listOpts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listOpts, activeModule.loading, activeModule.appointmentsTotalPages]);

  const reload = useCallback(() => {
    pageRef.current = 1;
    activeModule.loadAppointments(1, PAGE_SIZE, listOpts);
    if (countsWindow) activeModule.loadAppointmentDayCounts?.(countsWindow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listOpts, countsWindow]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    pageRef.current = 1;
    await Promise.all([
      activeModule.loadAppointments(1, PAGE_SIZE, listOpts),
      countsWindow
        ? (activeModule.loadAppointmentDayCounts?.(countsWindow) ?? Promise.resolve())
        : Promise.resolve(),
    ]);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listOpts, countsWindow]);

  const closeAll = useCallback(() => {
    setSheet(null);
    setActiveAppt(null);
    setDialog(null);
  }, []);

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

  const openDay = useCallback((ymd: string) => {
    setSelectedDate(ymd);
    const d = parseYmd(ymd);
    setAnchorMonth({ y: d.getFullYear(), m: d.getMonth() });
  }, []);

  // ── Row renderer ───────────────────────────────────────────────────────────
  const renderRow = useCallback(
    (item: AppointmentRow) => {
      const st = theme.status[item.status] ?? theme.status.FALLBACK;
      const pair = theme.avatar.forName(item.serviceName);
      const showAmount = view === 'DAY' || view === 'SEARCH_RESULTS';
      const showDate = view === 'SEARCH_RESULTS';

      return (
        <Pressable
          onPress={() => {
            setActiveAppt(item);
            setSheet('actions');
          }}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          android_ripple={{ color: palette.divider }}
        >
          <View style={styles.timeCol}>
            <Text style={styles.timeClock}>{apptClock(item.time)}</Text>
            <Text style={styles.timeMeridiem}>{apptMeridiem(item.time)}</Text>
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
    [theme, styles, palette.divider, view],
  );

  // ── Body ───────────────────────────────────────────────────────────────────
  const sections = useMemo(() => [{ title: '', data: rows }], [rows]);

  // The header is an overlay now, so every body branch has to reserve its height or it renders
  // underneath. The list gets it through contentContainerStyle; the hero/skeleton blocks need it
  // as real padding.
  const { headerProps, listProps, headerHeight } = useCollapsingHeader({
    pinned: !headerCollapses(view),
    refreshing,
    contentBottomPadding: LIST_BOTTOM_PAD,
  });
  const bodyInset = useMemo(() => ({ paddingTop: headerHeight }), [headerHeight]);

  // List footer: the spinner while a further page lands, otherwise the mockup's end-of-day marker.
  //
  // The marker is only honest on the DAY surface — "scheduled today" is nonsense against a search
  // result set spanning every date. Completeness is judged against dayCounts rather than a page
  // counter because that is already the authoritative total for the day (the list itself is
  // page-capped, which is why the count line reads from the same place).
  const dayFullyLoaded = rows.length > 0 && rows.length >= dayTotal;
  const footer = useMemo(() => {
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
    activeModule.loading,
    rows.length,
    surface,
    mode,
    dayFullyLoaded,
    styles,
    colors.primary,
    palette.muted,
  ]);

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
  } else if (view === 'LOADING' || view === 'CALENDAR_LOADING' || view === 'SEARCHING') {
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
        onCta={() => {
          /* TODO: navigate to appointment create */
        }}
        colors={colors}
      />
    );
  } else {
    body = (
      <AnimatedSectionList
        {...listProps}
        sections={sections}
        keyExtractor={(item: AppointmentRow) => String(item.id)}
        renderSectionHeader={() => null}
        renderItem={({ item }: { item: AppointmentRow }) => renderRow(item)}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        // Explicit, and load-bearing: the default is true on iOS, which would pin section headers
        // at scroll-view y=0 — i.e. behind the overlay header — then pop them into view the moment
        // it collapses. Headers render null here anyway, but the flag must not be left to chance.
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
              <Text style={styles.subtitle}>{formatDayHeading(parseYmd(selectedDate))}</Text>
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
            selectedDate={selectedDate}
            counts={dayCounts}
            onPickDate={openDay}
          />
        ))}

      {/* Count line. Sourced from dayCounts, never rows.length — the list is page-capped, so a busy
          day would otherwise read "20 appointments" forever. */}
      {(view === 'DAY' || view === 'CALENDAR') && (
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

      {showsFab(view) && (
        <FAB
          onPress={() => {
            /* TODO: navigate to appointment create */
          }}
        />
      )}

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
  selectedDate,
  counts,
  onPickDate,
}: {
  styles: any;
  colors: any;
  selectedDate: string;
  counts: Record<string, number>;
  onPickDate: (ymd: string) => void;
}) {
  const days = useMemo(() => weekDays(parseYmd(selectedDate)), [selectedDate]);

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
  selectedDate: string;
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
      marginBottom: 10,
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
