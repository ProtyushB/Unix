import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Info, Search, Users, X } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../theme/theme.types';
import { AnimatedFlatList, CollapsingHeader } from '../../../components/layout/CollapsingHeader';
import { useCollapsingHeader } from '../../../hooks/useCollapsingHeader';
import { getSelectedBusinessId } from '../../../backend/modules/shared/hook/useModuleService';
import { getPersonService } from '../../../backend/person';
import type { CustomerDto } from '../../../backend/person';
import { Badge } from '../shared/detail/parts/Badge';
import { useAppContext } from '../../../context/AppContext';
import { moduleLabel } from '../expenses/detail/expenseDetail.modules';
import { cardFooterLine, toCustomerRow, type CustomerRow } from './customer.model';
import {
  DERIVED_NOTE,
  EMPTY_BODY,
  EMPTY_TITLE,
  ERROR_BODY,
  ERROR_CTA,
  ERROR_TITLE,
  LIST_SUBTITLE,
  NO_RESULTS_BODY,
  SEARCH_IDLE_BODY,
  SEARCH_IDLE_TITLE,
  SEARCH_PLACEHOLDER,
  deriveCustomersView,
  headerCollapses,
  noResultsTitle,
} from './customer.view';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const LIST_BOTTOM_PAD = 100;

// Same Content-column rhythm as the stock-ops screens, applied PER ELEMENT.
const SECTION_GAP = 18;
const FILTER_GAP = 12;
const CARD_GAP = 12;
const LIST_TOP_PAD = SECTION_GAP;
const SIDE_PAD = 16;

interface Props {
  navigation?: { navigate?: (screen: string, params?: Record<string, unknown>) => void };
}

/**
 * The Customers list.
 *
 * ⚠️ NO FAB and NO filter button, and both absences are decisions:
 *
 *   • A customer row is born server-side from the first order, booking or bill. A person created
 *     from here would not appear in this list at all, so a create affordance would look broken.
 *   • The endpoint takes `businessId`, `page`, `limit` and `search` — nothing else — and sorts by
 *     `lastActivityAt DESC` with no way to change it. A filter or sort control would do nothing.
 *
 * Unlike every other list screen in the app, this one calls `PersonService` directly rather than
 * `activeModule`: customers are module-NEUTRAL server-side (one shared controller under
 * `/businesses/{id}/customers`, not a parlour/pharmacy pair), so there is no module slice to read.
 */
export function CustomersScreen({ navigation }: Props) {
  const theme = useTheme();
  const { colors } = theme;
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { selectedModule } = useAppContext();

  const [businessId, setBusinessId] = useState<number | null>(null);
  const [mode, setMode] = useState<'browse' | 'search'>('browse');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [records, setRecords] = useState<CustomerDto[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

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

  const load = useCallback(
    async (page: number, append: boolean) => {
      if (businessId == null) return;
      pageRef.current = page;
      setLoading(true);
      setError(null);
      try {
        const res = await getPersonService().getCustomersByBusiness(
          businessId,
          page,
          PAGE_SIZE,
          debouncedSearch || undefined,
        );
        if (res?.success) {
          const data = (res.data ?? []) as CustomerDto[];
          setRecords((prev) => (append ? [...prev, ...data] : data));
          // `totalPages` is the ONLY stop signal — the endpoint reports no row count.
          setTotalPages(res.totalPages ?? 1);
        } else {
          setError(res?.error || 'Could not load customers.');
          if (!append) setRecords([]);
        }
      } finally {
        setLoading(false);
        setLoadedOnce(true);
        loadingMoreRef.current = false;
      }
    },
    [businessId, debouncedSearch],
  );

  const reload = useCallback(() => {
    load(1, false);
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    setRows(records.map(toCustomerRow));
  }, [records]);

  const onEndReached = useCallback(() => {
    if (loadingMoreRef.current || loading) return;
    if (pageRef.current >= (totalPages || 1)) return;
    loadingMoreRef.current = true;
    void load(pageRef.current + 1, true);
  }, [loading, totalPages, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(1, false);
    setRefreshing(false);
  }, [load]);

  const view = deriveCustomersView({
    mode,
    loading,
    loadedOnce,
    hasError: !!error && rows.length === 0,
    hasRows: rows.length > 0,
    hasQuery: !!debouncedSearch,
  });

  const { headerProps, listProps, headerHeight } = useCollapsingHeader({
    pinned: !headerCollapses(view),
    refreshing,
    contentBottomPadding: insets.bottom + LIST_BOTTOM_PAD,
  });

  const openProfile = useCallback(
    (record: CustomerDto) => {
      // The whole record travels — the profile cannot refetch it. See `CustomerProfileScreen`.
      navigation?.navigate?.('CustomerProfile', { customer: record });
    },
    [navigation],
  );

  const bodyInset: StyleProp<ViewStyle> = { paddingTop: headerHeight + LIST_TOP_PAD };

  const list = (
    <AnimatedFlatList
      {...listProps}
      showsVerticalScrollIndicator={false}
      data={rows}
      keyExtractor={(item: CustomerRow, index: number) => String(item.personId ?? index)}
      renderItem={({ item, index }: { item: CustomerRow; index: number }) => (
        <CustomerCard row={item} styles={styles} onPress={() => openProfile(records[index])} />
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
        loading && rows.length > 0 ? (
          <ActivityIndicator style={styles.footerSpinner} color={colors.primary} />
        ) : null
      }
    />
  );

  let body: React.ReactNode;
  if (view === 'LOADING' || view === 'SEARCHING') {
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
        {/* No CTA — there is no action a person can take here. A customer appears on their own. */}
        <HeroBlock styles={styles} title={EMPTY_TITLE} body={EMPTY_BODY} />
      </View>
    );
  } else if (view === 'SEARCH_IDLE') {
    body = (
      <View style={[styles.bodyPad, bodyInset]}>
        <HeroBlock styles={styles} title={SEARCH_IDLE_TITLE} body={SEARCH_IDLE_BODY} />
      </View>
    );
  } else if (view === 'NO_RESULTS') {
    body = (
      <View style={[styles.bodyPad, bodyInset]}>
        <HeroBlock styles={styles} title={noResultsTitle(debouncedSearch)} body={NO_RESULTS_BODY} />
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
            <Text style={styles.title}>Customers</Text>
            <Badge label={moduleLabel(String(selectedModule || ''))} tone="accent" />
          </View>
          {/* No count — the endpoint reports totalPages and never totalElements. */}
          <Text style={styles.subtitle}>{LIST_SUBTITLE}</Text>
        </View>

        {/* Search only. No filter button: there is nothing to filter and the sort is fixed. */}
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
              autoCapitalize="none"
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
        </View>

        <View style={styles.noteRow}>
          <Info size={13} color={theme.palette.muted} />
          <Text style={styles.noteText}>{DERIVED_NOTE}</Text>
        </View>
      </CollapsingHeader>
    </SafeAreaView>
  );
}

// ─── File-local pieces ───────────────────────────────────────────────────────

type Styles = ReturnType<typeof createStyles>;

function CustomerCard({
  row,
  styles,
  onPress,
}: {
  row: CustomerRow;
  styles: Styles;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.totalSpentText}, ${row.activityText}`}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{row.initials}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={styles.cardContact} numberOfLines={1}>
            {row.contact}
          </Text>
        </View>
        <View style={styles.cardTrailing}>
          <Text style={styles.cardSpend}>{row.totalSpentText}</Text>
          <Text style={styles.cardActivity}>{row.activityText}</Text>
        </View>
      </View>
      {cardFooterLine(row) ? (
        <Text style={styles.cardFooter} numberOfLines={1}>
          {cardFooterLine(row)}
        </Text>
      ) : null}
    </Pressable>
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
        <Users size={22} color="#F97316" />
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
      marginBottom: FILTER_GAP,
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

    noteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginBottom: FILTER_GAP,
      paddingHorizontal: SIDE_PAD,
      flexShrink: 0,
    },
    noteText: { fontSize: 11.5, color: palette.muted },

    card: {
      marginHorizontal: SIDE_PAD,
      marginBottom: CARD_GAP,
      padding: 14,
      borderRadius: 16,
      gap: 10,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.softBg,
    },
    avatarText: { fontSize: 13.5, fontWeight: '700', color: colors.primary },
    cardBody: { flex: 1, gap: 3 },
    cardName: { fontSize: 15, fontWeight: '700', color: palette.onSurface },
    cardContact: { fontSize: 11.5, color: palette.muted },
    cardTrailing: { alignItems: 'flex-end', gap: 3 },
    cardSpend: { fontSize: 14.5, fontWeight: '800', color: palette.onBackground },
    cardActivity: { fontSize: 11, color: palette.muted },
    cardFooter: { fontSize: 11.5, color: palette.muted },

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
  });
}
