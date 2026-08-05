import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Search,
  X,
  Plus,
  List as ListIcon,
  LayoutGrid,
  ArrowUpDown,
  ChevronDown,
  Check,
  Clock,
  Layers,
  Scissors,
  Sparkles,
  Droplet,
  Droplets,
  Wind,
  Hand,
  Flower2,
  Pencil,
  CircleSlash2,
  CalendarPlus,
  Trash2,
  CircleX,
} from 'lucide-react-native';
import { CollapsingHeader, AnimatedFlatList } from '../../../components/layout/CollapsingHeader';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { useTheme } from '../../../hooks/useTheme';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { useCollapsingHeader } from '../../../hooks/useCollapsingHeader';
import { useToast } from '../../../hooks/useToast';
import type { AppTheme } from '../../../theme/theme.types';
import { useAppContext } from '../../../context/AppContext';
import { useParlour } from '../../../backend/modules/parlour';
import { usePharmacy } from '../../../backend/modules/pharmacy';
import type { ServiceListOptions } from '../../../backend/modules/shared/hook/useModuleService';
import {
  toServiceRow,
  availabilityStateFor,
  formatDuration,
  formatPrice,
  servicesHeaderLine,
  servicesResultLine,
  serviceTintIndex,
  AVAILABILITY_LABEL,
  AVAILABILITY_TINT,
  type ServiceRow,
  type AvailabilityState,
} from './service.model';
import {
  deriveServiceView,
  showsServiceAdd,
  serviceHeaderCollapses,
  showsServiceMenuPanel,
  quickActionsFor,
  sortTriggerLabel,
  sortOptionFor,
  SORT_OPTIONS,
  DEFAULT_SORT_KEY,
  type ServiceAction,
  type ServiceView,
} from './service.view';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
/** Gap between the header and the first row. Lives on the header via `gapBelow`, never in the
 *  list's contentContainerStyle — content padding scrolls away with the rows and lets a card ride
 *  up flush against the search field. */
const LIST_TOP_PAD = 12;
const LIST_BOTTOM_PAD = 32;
const SEARCH_DEBOUNCE_MS = 300;
/** Remembered so the menu reopens in the view the owner last used. */
const VIEW_MODE_KEY = 'session:services:view';

/**
 * Decorative thumbnail glyphs.
 *
 * The mockup gives each service a semantic icon — scissors for threading, a droplet for a hair spa.
 * The only signal that could drive that is categories, and those arrive as bare IDs because the
 * mappers never populate names. Picking from this pool by a hash of the name keeps a service's
 * glyph stable and the list visually varied, which is what the thumbnails communicate at a glance.
 */
const THUMB_ICONS = [Sparkles, Droplet, Droplets, Scissors, Wind, Hand, Flower2, Layers];

type ViewMode = 'list' | 'grid';

/** `accent` is not a palette role — it lives on `colors.primary`. Everything else is. */
function tintOf(theme: AppTheme, tint: ServiceAction['tint']): string {
  return tint === 'accent' ? theme.colors.primary : theme.palette[tint];
}

// ─── Screen ──────────────────────────────────────────────────────────────────

interface ServicesScreenProps {
  /** Optional so the web preview can mount the list standalone, with no navigator around it. */
  navigation?: {
    navigate: (route: string, params?: Record<string, unknown>) => void;
    addListener?: (event: string, cb: () => void) => () => void;
  };
}

export function ServicesScreen({ navigation }: ServicesScreenProps = {}) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { palette, colors } = theme;
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  // Two-way. Parlour and pharmacy are the only modules Modulex implements.
  const activeModule = selectedModule === 'PHARMACY' ? pharmacy : parlour;

  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortKey, setSortKey] = useState(DEFAULT_SORT_KEY);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [sheet, setSheet] = useState<null | 'actions' | 'sort'>(null);
  const [activeService, setActiveService] = useState<ServiceRow | null>(null);
  const [dialog, setDialog] = useState<null | 'delete'>(null);

  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const sawLoadingRef = useRef(false);

  const totalElements = activeModule.servicesTotalElements;

  // ── View state ─────────────────────────────────────────────────────────────

  const view: ServiceView = deriveServiceView({
    mode: searching ? 'search' : 'browse',
    query: debouncedSearch,
    rowCount: rows.length,
    loadedOnce,
    hasError: !!activeModule.error && !activeModule.loading,
  });

  // ── Restore the remembered view mode ───────────────────────────────────────

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(VIEW_MODE_KEY)
      .then((stored) => {
        if (alive && (stored === 'list' || stored === 'grid')) setViewMode(stored);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const pickViewMode = useCallback((next: ViewMode) => {
    setViewMode(next);
    // Fire-and-forget: a storage failure must not stop the toggle from working.
    AsyncStorage.setItem(VIEW_MODE_KEY, next).catch(() => {});
  }, []);

  // ── Search debounce ────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  /**
   * The whole options object swaps between modes rather than being merged, so a sort chosen while
   * browsing cannot silently reorder a search — and so the server's `id asc` default (oldest first)
   * is never inherited by accident.
   */
  const listOpts = useMemo<ServiceListOptions>(() => {
    const sort = sortOptionFor(sortKey);
    if (searching) {
      return debouncedSearch ? { search: debouncedSearch } : {};
    }
    return { sortBy: sort.sortBy, sortDir: sort.sortDir };
  }, [searching, debouncedSearch, sortKey]);

  const load = useCallback(
    (page: number) => {
      pageRef.current = page;
      activeModule.loadServices(page, PAGE_SIZE, listOpts);
    },
    [activeModule, listOpts],
  );

  const reload = useCallback(() => {
    setLoadedOnce(false);
    sawLoadingRef.current = false;
    load(1);
  }, [load]);

  // Refetch whenever the query shape changes. In search mode with an empty box there is nothing to
  // ask for, so the request is skipped entirely — SEARCH_IDLE renders instead.
  useEffect(() => {
    if (searching && !debouncedSearch) return;
    setLoadedOnce(false);
    sawLoadingRef.current = false;
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listOpts, searching]);

  // Map the hook's raw rows, appending on page 2+.
  useEffect(() => {
    const mapped = (activeModule.services as any[]).map(toServiceRow);
    setRows((prev) => (pageRef.current <= 1 ? mapped : [...prev, ...mapped]));
    loadingMoreRef.current = false;
  }, [activeModule.services]);

  /**
   * Refetch when the user comes back from the detail screen, so an edit or a delete is reflected
   * in the list. The first focus is skipped — the mount effect has already loaded, and refetching
   * on top of it would double the request. Optional chaining throughout because the screen also
   * mounts standalone in the web preview, with no navigator to hook into.
   */
  const hasFocusedRef = useRef(false);
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        return;
      }
      load(1);
    });
    return unsubscribe;
  }, [navigation, load]);

  // `loading` is false on the very first render, so a plain `!loading` marks the screen loaded
  // before any request exists and flashes the empty hero. Track the true→false transition instead.
  useEffect(() => {
    if (activeModule.loading) sawLoadingRef.current = true;
    else if (sawLoadingRef.current) setLoadedOnce(true);
  }, [activeModule.loading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    load(1);
    setRefreshing(false);
  }, [load]);

  const onEndReached = useCallback(() => {
    if (loadingMoreRef.current || activeModule.loading) return;
    if (pageRef.current >= (activeModule.servicesTotalPages ?? 1)) return;
    loadingMoreRef.current = true;
    load(pageRef.current + 1);
  }, [activeModule, load]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const closeSheets = useCallback(() => {
    setSheet(null);
    setActiveService(null);
    setDialog(null);
  }, []);

  const openActions = useCallback((row: ServiceRow) => {
    setActiveService(row);
    setSheet('actions');
  }, []);

  const runAvailability = useCallback(
    async (row: ServiceRow) => {
      const next = !row.availability;
      const res = await activeModule.updateServiceAvailability?.(row.id, next);
      closeSheets();
      if (res?.success) {
        showToast(next ? 'Marked available' : 'Marked unavailable', 'success');
        load(1);
      } else {
        showToast(res?.error || "Couldn't update availability", 'error');
      }
    },
    [activeModule, closeSheets, load, showToast],
  );

  const onPickAction = useCallback(
    (action: ServiceAction) => {
      if (action.key === 'edit' && activeService) {
        // Close the sheet BEFORE navigating. A Modal left mounted keeps its portal over the next
        // route on react-native-web, so the detail screen would render behind a dead overlay.
        const id = activeService.id;
        closeSheets();
        navigation?.navigate('ServiceDetail', { serviceId: id, mode: 'edit' });
        return;
      }
      if (action.todo) {
        showToast('Booking from a service is coming soon', 'info');
        closeSheets();
        return;
      }
      if (action.confirm) {
        // Drop the sheet before raising the dialog. Two stacked Modals leave the sheet painted over
        // the dialog — the dialog mounts, the user sees nothing, and confirming reads as a dead tap.
        setSheet(null);
        setDialog(action.confirm);
        return;
      }
      if (action.key === 'availability' && activeService) runAvailability(activeService);
    },
    [activeService, closeSheets, navigation, runAvailability, showToast],
  );

  const runDelete = useCallback(async () => {
    if (!activeService) return;
    const name = activeService.name;
    const res = await activeModule.deleteService(activeService.id);
    closeSheets();
    if (res?.success) {
      showToast(`${name} deleted`, 'success');
      load(1);
    } else {
      // A service delete is routinely refused because appointments, packages or bills still
      // reference it. That reason is the whole message — surface it, don't flatten it.
      showToast(res?.error || "Couldn't delete service", 'error');
    }
  }, [activeService, activeModule, closeSheets, load, showToast]);

  const onAdd = useCallback(() => {
    navigation?.navigate('ServiceDetail', { mode: 'add' });
  }, [navigation]);

  /** Tapping a row opens the record; the quick-actions sheet moves to a long press. */
  const openDetail = useCallback(
    (row: ServiceRow) => {
      navigation?.navigate('ServiceDetail', { serviceId: row.id, mode: 'view' });
    },
    [navigation],
  );

  // ── Layout ─────────────────────────────────────────────────────────────────

  const { headerProps, listProps, headerHeight } = useCollapsingHeader({
    pinned: !serviceHeaderCollapses(view),
    refreshing,
    contentBottomPadding: LIST_BOTTOM_PAD,
  });
  const bodyInset = useMemo(() => ({ paddingTop: headerHeight }), [headerHeight]);

  const openSearch = useCallback(() => setSearching(true), []);
  const closeSearch = useCallback(() => {
    setSearching(false);
    setSearch('');
    setDebouncedSearch('');
  }, []);

  const renderRow = useCallback(
    (row: ServiceRow) =>
      viewMode === 'grid' ? (
        <GridCard
          row={row}
          styles={styles}
          theme={theme}
          onPress={openDetail}
          onLongPress={openActions}
        />
      ) : (
        <ListRow
          row={row}
          styles={styles}
          theme={theme}
          onPress={openDetail}
          onLongPress={openActions}
        />
      ),
    [viewMode, styles, theme, openDetail, openActions],
  );

  // ── Body ───────────────────────────────────────────────────────────────────

  let body: React.ReactNode;

  if (view === 'ERROR') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<CircleX size={40} color={palette.muted} />}
        headline="Couldn't load services"
        sub="Something went wrong while loading. Check your connection and try again."
        ctaLabel="Retry"
        onCta={reload}
        colors={colors}
      />
    );
  } else if (view === 'LOADING' || view === 'SEARCHING') {
    body = (
      <View style={[styles.center, bodyInset]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  } else if (view === 'SEARCH_IDLE') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<Search size={40} color={palette.muted} />}
        headline="Search your menu"
        sub="Find a service by its name."
        colors={colors}
      />
    );
  } else if (view === 'NO_RESULTS') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<Layers size={40} color={palette.muted} />}
        headline="No services found"
        sub={`No services match '${debouncedSearch}'. Try a different name.`}
        colors={colors}
      />
    );
  } else if (view === 'EMPTY') {
    body = (
      <HeroBlock
        styles={styles}
        style={bodyInset}
        icon={<Layers size={40} color={palette.muted} />}
        headline="No services yet"
        sub="Add your first service to start building your menu."
        ctaLabel="Add Service"
        onCta={onAdd}
        colors={colors}
      />
    );
  } else {
    body = (
      <AnimatedFlatList<ServiceRow>
        data={rows}
        // Remounting on a column change is mandatory: FlatList caches cell layout by index and
        // silently keeps the old geometry otherwise.
        key={viewMode}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        keyExtractor={(item: ServiceRow) => String(item.id)}
        renderItem={({ item }: { item: ServiceRow }) => renderRow(item)}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            progressViewOffset={headerHeight}
          />
        }
        {...listProps}
      />
    );
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  const header = (
    <CollapsingHeader {...headerProps} backgroundColor={palette.background} gapBelow={LIST_TOP_PAD}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>CATALOG</Text>
          <Text style={styles.title}>Services</Text>
          <Text style={styles.subtitle}>Manage your service menu</Text>
        </View>

        <View style={styles.viewToggle}>
          {(['list', 'grid'] as ViewMode[]).map((mode) => {
            const Icon = mode === 'list' ? ListIcon : LayoutGrid;
            const active = viewMode === mode;
            return (
              <Pressable
                key={mode}
                style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                onPress={() => pickViewMode(mode)}
                accessibilityRole="button"
                accessibilityLabel={mode === 'list' ? 'List view' : 'Grid view'}
                accessibilityState={{ selected: active }}
              >
                <Icon size={18} color={active ? palette.onBackground : palette.muted} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.searchRow}>
        {searching ? (
          <View style={styles.searchField}>
            <Search size={17} color={palette.muted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search services..."
              placeholderTextColor={palette.muted}
              autoFocus
              returnKeyType="search"
            />
            <Pressable
              onPress={closeSearch}
              accessibilityRole="button"
              accessibilityLabel="Close search"
            >
              <X size={18} color={palette.muted} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.searchField}
            onPress={openSearch}
            accessibilityRole="button"
            accessibilityLabel="Search services"
          >
            <Search size={17} color={palette.muted} />
            {/* Name only — that is all the server matches, and the no-results copy says so too. */}
            <Text style={styles.searchPlaceholder}>Search services...</Text>
          </Pressable>
        )}

        {showsServiceAdd(view) && (
          <Pressable
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="Add service"
          >
            <Plus size={22} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </CollapsingHeader>
  );

  /**
   * The menu band sits below the collapsing header and rides up with it, coming to rest at the top
   * once the header is hidden — which is exactly where the set's Scroll Down screen draws it, with
   * the title and search gone but this band still present.
   *
   * It carries the header's OWN animated style so the two translate in lockstep. A static
   * `top: headerHeight` instead leaves it stranded mid-list with rows scrolling both behind and in
   * front of it. `headerProps.onLayout` is deliberately NOT spread here — that measures the header,
   * and letting this band report its height too would corrupt the list inset.
   *
   * `insets.top` is part of the anchor for the same reason `CollapsingHeader` applies it to its own
   * wrapper: safe-area-context supplies the inset as Yoga PADDING, and an absolutely positioned
   * child resolves `top` against the parent's border edge, outside that padding. Without the term
   * this band sat one status-bar too high — hidden behind the header at rest, and painted over the
   * status bar itself once the header collapsed and it came to rest at y=0.
   */
  const band = (children: React.ReactNode, style: object) => (
    <Animated.View
      style={[style, { top: insets.top + headerHeight }, headerProps.animatedStyle]}
      pointerEvents="box-none"
    >
      {children}
    </Animated.View>
  );

  const panel = showsServiceMenuPanel(view)
    ? band(
        <>
          <View style={styles.panelTitles}>
            <Text style={styles.panelTitle}>Service Menu</Text>
            {/* Only when the server actually sent the count. Falling back to the loaded row count
                would print "20 services" for a 30-service menu and tick upward as you scrolled — a
                wrong number is worse than no number. Absent on a backend without totalElements. */}
            {totalElements != null && (
              <Text style={styles.panelSub}>{servicesHeaderLine(totalElements)}</Text>
            )}
          </View>
          <Pressable
            style={styles.sortBtn}
            onPress={() => setSheet('sort')}
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${sortTriggerLabel(sortKey)}`}
          >
            <ArrowUpDown size={14} color={palette.muted} />
            <Text style={styles.sortLabel}>{sortTriggerLabel(sortKey)}</Text>
            <ChevronDown size={14} color={palette.muted} />
          </Pressable>
        </>,
        styles.panelHeader,
      )
    : null;

  const resultLine =
    view === 'SEARCH_RESULTS'
      ? band(
          <Text style={styles.resultLine}>{servicesResultLine(rows.length, debouncedSearch)}</Text>,
          styles.resultBand,
        )
      : null;

  // The band is an overlay, so the list needs to start below it or the first row hides underneath.
  const bandHeight = panel ? 58 : resultLine ? 30 : 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={[styles.bodyFill, { paddingTop: bandHeight }]}>{body}</View>

      {header}
      {panel}
      {resultLine}

      {/* Gated at render level rather than on Modal's `visible` prop alone: react-native-web keeps a
          Modal's portal mounted after `visible` flips false, which leaves stale sheets stacked on
          screen intercepting taps. */}
      {sheet === 'actions' && activeService && (
        <ActionsSheet
          row={activeService}
          styles={styles}
          theme={theme}
          insets={insets}
          onClose={closeSheets}
          onPick={onPickAction}
        />
      )}

      {sheet === 'sort' && (
        <SortSheet
          styles={styles}
          theme={theme}
          insets={insets}
          current={sortKey}
          onClose={() => setSheet(null)}
          onPick={(key) => {
            setSortKey(key);
            setSheet(null);
          }}
        />
      )}

      <ConfirmDialog
        visible={dialog === 'delete'}
        title="Delete this service?"
        message={
          activeService
            ? `“${activeService.name}” will be removed from your service menu. This can’t be undone.`
            : ''
        }
        confirmLabel="Delete service"
        cancelLabel="Keep"
        danger
        onConfirm={runDelete}
        onCancel={closeSheets}
      />
    </SafeAreaView>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function AvailabilityBadge({
  state,
  styles,
  theme,
}: {
  state: AvailabilityState;
  styles: any;
  theme: AppTheme;
}) {
  const tint = theme.palette[AVAILABILITY_TINT[state]];
  return (
    <View style={[styles.badge, { backgroundColor: tint + '22' }]}>
      <View style={[styles.badgeDot, { backgroundColor: tint }]} />
      <Text style={[styles.badgeLabel, { color: tint }]} numberOfLines={1}>
        {AVAILABILITY_LABEL[state]}
      </Text>
    </View>
  );
}

/**
 * Not themed — the tile's colour comes from the per-row hue, so only the layout is static. Kept
 * outside createStyles because Thumb takes the theme as a prop rather than through the hook.
 */
const thumbStyles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  /** Grid card — fills the column, so the width is a percentage rather than the square's side. */
  lg: { width: '100%', height: 72, borderRadius: 10 },
  /** List row — a fixed square. */
  sm: { width: 44, height: 44, borderRadius: 12 },
});

function Thumb({ row, theme, size }: { row: ServiceRow; theme: AppTheme; size: 'sm' | 'lg' }) {
  // The avatar pool gives a vivid hue in `bg` and a contrast colour in `text` — right for a filled
  // initials circle, wrong here. The mockup tints the tile with the hue at ~13% and draws the glyph
  // in the hue itself, so the hue is taken from `bg` and used for both.
  const hue = theme.avatar.forName(row.name).bg;
  // Hashed separately from the hue so colour and glyph vary independently down the list.
  const Icon = THUMB_ICONS[serviceTintIndex(row.name, THUMB_ICONS.length)];
  return (
    <View
      style={[
        thumbStyles.box,
        size === 'lg' ? thumbStyles.lg : thumbStyles.sm,
        // The only genuinely dynamic part: the row's own hue at ~13% opacity.
        { backgroundColor: hue + '22' },
      ]}
    >
      <Icon size={size === 'lg' ? 26 : 20} color={hue} />
    </View>
  );
}

function Duration({ row, styles, theme }: { row: ServiceRow; styles: any; theme: AppTheme }) {
  const text = formatDuration(row.duration);
  if (!text) return null;
  return (
    <View style={styles.durRow}>
      <Clock size={12} color={theme.palette.muted} />
      <Text style={styles.durText}>{text}</Text>
    </View>
  );
}

function ListRow({
  row,
  styles,
  theme,
  onPress,
  onLongPress,
}: {
  row: ServiceRow;
  styles: any;
  theme: AppTheme;
  onPress: (row: ServiceRow) => void;
  onLongPress: (row: ServiceRow) => void;
}) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => onPress(row)}
      onLongPress={() => onLongPress(row)}
      accessibilityRole="button"
      accessibilityLabel={row.name}
    >
      <Thumb row={row} theme={theme} size="sm" />
      <View style={styles.rowMid}>
        <Text style={styles.rowName} numberOfLines={1}>
          {row.name}
        </Text>
        {/* The mockup puts categories here; they arrive as bare IDs, so the description takes the
            slot and the line simply goes away when there is none. */}
        {!!row.description && (
          <Text style={styles.rowSub} numberOfLines={1}>
            {row.description}
          </Text>
        )}
        <View style={styles.badgeRow}>
          <AvailabilityBadge state={availabilityStateFor(row)} styles={styles} theme={theme} />
          <Duration row={row} styles={styles} theme={theme} />
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowPrice}>{formatPrice(row.price)}</Text>
      </View>
    </Pressable>
  );
}

function GridCard({
  row,
  styles,
  theme,
  onPress,
  onLongPress,
}: {
  row: ServiceRow;
  styles: any;
  theme: AppTheme;
  onPress: (row: ServiceRow) => void;
  onLongPress: (row: ServiceRow) => void;
}) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => onPress(row)}
      onLongPress={() => onLongPress(row)}
      accessibilityRole="button"
      accessibilityLabel={row.name}
    >
      <Thumb row={row} theme={theme} size="lg" />
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {row.description}
        </Text>
      </View>
      <View style={styles.cardFoot}>
        <Text style={styles.cardPrice}>{formatPrice(row.price)}</Text>
        <Duration row={row} styles={styles} theme={theme} />
      </View>
    </Pressable>
  );
}

const ACTION_ICON: Record<ServiceAction['key'], React.ComponentType<any>> = {
  edit: Pencil,
  availability: CircleSlash2,
  book: CalendarPlus,
  delete: Trash2,
};

function ActionsSheet({
  row,
  styles,
  theme,
  insets,
  onClose,
  onPick,
}: {
  row: ServiceRow;
  styles: any;
  theme: AppTheme;
  insets: { bottom: number };
  onClose: () => void;
  onPick: (action: ServiceAction) => void;
}) {
  const actions = quickActionsFor(row);
  const sub = [row.description, formatDuration(row.duration), formatPrice(row.price)]
    .filter(Boolean)
    .join(' · ');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetGrip} />

        <View style={styles.sheetHead}>
          <Thumb row={row} theme={theme} size="sm" />
          <View style={styles.sheetHeadText}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={styles.sheetSub} numberOfLines={1}>
              {sub}
            </Text>
          </View>
        </View>

        {actions.map((a) => {
          const Icon = ACTION_ICON[a.key];
          return (
            <Pressable key={a.key} style={styles.actionRow} onPress={() => onPick(a)}>
              <Icon size={19} color={tintOf(theme, a.tint)} />
              <Text style={[styles.actionLabel, a.danger && { color: theme.palette.error }]}>
                {a.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

function SortSheet({
  styles,
  theme,
  insets,
  current,
  onClose,
  onPick,
}: {
  styles: any;
  theme: AppTheme;
  insets: { bottom: number };
  current: string;
  onClose: () => void;
  onPick: (key: string) => void;
}) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetGrip} />
        <Text style={styles.sheetSection}>SORT BY</Text>
        {SORT_OPTIONS.map((opt) => {
          const active = opt.key === current;
          return (
            <Pressable key={opt.key} style={styles.actionRow} onPress={() => onPick(opt.key)}>
              <Text style={[styles.actionLabel, active && { color: theme.colors.primary }]}>
                {opt.label}
              </Text>
              {active && <Check size={18} color={theme.colors.primary} />}
            </Pressable>
          );
        })}
      </View>
    </Modal>
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (theme: AppTheme) => {
  const dim = theme.palette.muted + '8A';
  return StyleSheet.create({
    // Opaque, matching Products, Billing and Appointments. The tab navigator sets `sceneStyle`
    // transparent and keeps every tab mounted, so a transparent screen lets the previously-focused
    // tab show through the gaps between rows.
    screen: { flex: 1, backgroundColor: theme.palette.background },
    /** Fills the screen under the collapsing header; the top pad varies with the band's height. */
    bodyFill: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Header
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    titleBlock: { flex: 1, gap: 2 },
    eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1, color: dim },
    title: { fontSize: 27, fontWeight: '700', color: theme.palette.onBackground },
    subtitle: { fontSize: 13, color: theme.palette.muted },

    viewToggle: {
      flexDirection: 'row',
      padding: 3,
      borderRadius: 11,
      backgroundColor: theme.palette.surface,
      marginTop: 14,
    },
    toggleBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 9,
    },
    toggleBtnActive: { backgroundColor: theme.palette.surfaceElevated },

    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      marginTop: 12,
    },
    searchField: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: theme.palette.surface,
    },
    searchInput: { flex: 1, fontSize: 14, color: theme.palette.onBackground, padding: 0 },
    searchPlaceholder: { flex: 1, fontSize: 14, color: theme.palette.muted },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Menu panel — pinned below the collapsing header, present in both scroll states.
    panelHeader: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 58,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      backgroundColor: theme.palette.background,
      zIndex: 9,
    },
    panelTitles: { gap: 3 },
    panelTitle: { fontSize: 14, fontWeight: '600', color: theme.palette.onBackground },
    panelSub: { fontSize: 11, color: dim },
    sortBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 31,
      paddingHorizontal: 12,
      borderRadius: 9,
      backgroundColor: theme.palette.surface,
    },
    sortLabel: { fontSize: 12, color: theme.palette.muted },

    resultBand: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 30,
      justifyContent: 'center',
      paddingHorizontal: 16,
      backgroundColor: theme.palette.background,
      zIndex: 9,
    },
    resultLine: { fontSize: 12, color: theme.palette.muted },

    // List row
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 16,
      marginBottom: 10,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.palette.surface,
    },
    rowMid: { flex: 1, gap: 3 },
    rowName: { fontSize: 14, fontWeight: '600', color: theme.palette.onBackground },
    rowSub: { fontSize: 12, color: theme.palette.muted },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
    durRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    durText: { fontSize: 12, color: theme.palette.muted },
    rowRight: { alignItems: 'flex-end' },
    rowPrice: { fontSize: 15, fontWeight: '600', color: theme.palette.onBackground },

    // Grid
    gridRow: { paddingHorizontal: 16, gap: 12 },
    card: {
      flex: 1,
      gap: 10,
      marginBottom: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.palette.surface,
    },
    cardInfo: { gap: 2 },
    cardName: { fontSize: 13, fontWeight: '600', color: theme.palette.onBackground },
    cardSub: { fontSize: 11, color: theme.palette.muted },
    cardFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    cardPrice: { fontSize: 14, fontWeight: '700', color: theme.palette.onBackground },

    // Badge
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeLabel: { fontSize: 11, fontWeight: '600' },

    // Hero
    hero: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      gap: 10,
    },
    heroIcon: {
      width: 84,
      height: 84,
      borderRadius: 42,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surface,
      marginBottom: 6,
    },
    heroHeadline: { fontSize: 18, fontWeight: '700', color: theme.palette.onBackground },
    heroSub: { fontSize: 13, color: theme.palette.muted, textAlign: 'center', lineHeight: 19 },
    heroCta: { marginTop: 10, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
    heroCtaLabel: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

    // Sheets
    sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000099' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 8,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
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
      gap: 12,
      paddingHorizontal: 22,
      paddingBottom: 14,
      marginBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider,
    },
    sheetHeadText: { flex: 1, gap: 2 },
    sheetTitle: { fontSize: 15, fontWeight: '700', color: theme.palette.onBackground },
    sheetSub: { fontSize: 12, color: theme.palette.muted },
    sheetSection: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1,
      color: dim,
      paddingHorizontal: 22,
      paddingBottom: 4,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 22,
      paddingVertical: 14,
    },
    actionLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.palette.onBackground },
  });
};
