import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Calendar,
  Check,
  ChevronLeft,
  FileText,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Zap,
} from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import { formatAmount } from './billDetail.model';

export type AddItemKind = 'ORDER' | 'APPOINTMENT' | 'PRODUCT' | 'SERVICE';

/** One pickable row, already flattened by the screen. Same contract as `CatalogRow`. */
export interface AddItemRow {
  id: number;
  title: string;
  subtitle: string;
  amount: number;
  badge?: { label: string; tone: 'success' | 'warning' | 'error' | 'info' | 'muted' };
  /** "Will create an order" — see `quickAddRouting.destinationNote`. Catalog rows only. */
  note?: string;
  /** The record the caller needs back. Passed through untouched. */
  raw?: unknown;
}

export interface AddItemSource {
  rows: AddItemRow[];
  loading: boolean;
  error: string | null;
  /** Already on the bill. Shown ticked and inert. */
  alreadyAdded: number[];
  onRetry?: () => void;
}

export type AddItemSelection = Record<AddItemKind, AddItemRow[]>;

interface Props {
  visible: boolean;
  /** "Billing · Anjali Rao". Empty until a customer is chosen. */
  customerName: string;
  sources: Record<AddItemKind, AddItemSource>;
  onAdd: (selection: AddItemSelection) => void;
  onClose: () => void;
  /** Fired when a tab is first shown, so the screen can fetch that list lazily. */
  onTabShown?: (kind: AddItemKind) => void;
}

const TOP_TABS = [
  { key: 'RECORDS' as const, label: 'Orders & Appts', icon: FileText },
  { key: 'CATALOG' as const, label: 'Quick Add', icon: Zap },
];

const SUB_TABS: Record<'RECORDS' | 'CATALOG', { key: AddItemKind; label: string }[]> = {
  RECORDS: [
    { key: 'ORDER', label: 'Orders' },
    { key: 'APPOINTMENT', label: 'Appointments' },
  ],
  CATALOG: [
    { key: 'PRODUCT', label: 'Products' },
    { key: 'SERVICE', label: 'Services' },
  ],
};

const KIND_ICON = {
  ORDER: ShoppingBag,
  APPOINTMENT: Calendar,
  PRODUCT: Package,
  SERVICE: Sparkles,
} as const;

const NOUN: Record<AddItemKind, string> = {
  ORDER: 'order',
  APPOINTMENT: 'appointment',
  PRODUCT: 'product',
  SERVICE: 'service',
};

const HELPER: Record<AddItemKind, string> = {
  ORDER: "This customer's unbilled orders",
  APPOINTMENT: "This customer's unbilled appointments",
  PRODUCT: 'Catalog — added as a bare line, or via a new order',
  SERVICE: 'Catalog — added as a bare line, or via a new appointment',
};

const EMPTY_SELECTION: AddItemSelection = {
  ORDER: [],
  APPOINTMENT: [],
  PRODUCT: [],
  SERVICE: [],
};

/**
 * Put things on a bill: attach an existing order or appointment, or quick-add straight from the
 * catalog.
 *
 * Four lists behind two tab levels, exactly as the mockups draw them, and the split is not
 * cosmetic — the two halves do genuinely different things. Attaching an order LINKS a record that
 * already exists and already deducted its stock. Quick-adding from the catalog creates something
 * new: either a bare line on the bill, or a whole auto-generated order the server spawns on save.
 * Which of those two a catalog row takes is the row's own property, not a choice, so each row says
 * what it will do rather than offering a switch.
 *
 * Selections accumulate ACROSS tabs. The footer counts everything picked anywhere, so attaching an
 * order and quick-adding a product is one trip through the sheet rather than two.
 *
 * ⚠️ Modal insets and the never-two-Modals rule: see `OptionSheet`.
 */
export function AddItemsSheet({
  visible,
  customerName,
  sources,
  onAdd,
  onClose,
  onTabShown,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const [top, setTop] = useState<'RECORDS' | 'CATALOG'>('RECORDS');
  const [kind, setKind] = useState<AddItemKind>('ORDER');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<AddItemSelection>(EMPTY_SELECTION);

  const source = sources[kind];
  const added = useMemo(() => new Set(source.alreadyAdded), [source.alreadyAdded]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return source.rows;
    return source.rows.filter(
      (r) => r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q),
    );
  }, [source.rows, query]);

  const totals = useMemo(() => {
    const rows = Object.values(picked).flat();
    return { count: rows.length, amount: rows.reduce((sum, r) => sum + r.amount, 0) };
  }, [picked]);

  const goTo = (nextKind: AddItemKind) => {
    setKind(nextKind);
    setQuery('');
    onTabShown?.(nextKind);
  };

  const reset = () => {
    setPicked(EMPTY_SELECTION);
    setQuery('');
    setTop('RECORDS');
    setKind('ORDER');
  };

  const toggle = (row: AddItemRow) => {
    if (added.has(row.id)) return;
    setPicked((prev) => {
      const current = prev[kind];
      const exists = current.some((r) => r.id === row.id);
      return {
        ...prev,
        [kind]: exists ? current.filter((r) => r.id !== row.id) : [...current, row],
      };
    });
  };

  const confirm = () => {
    onAdd(picked);
    reset();
    onClose();
  };

  const dismiss = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={dismiss}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.appBar}>
          <Pressable
            style={styles.iconButton}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Close add items"
          >
            <ChevronLeft size={20} color={theme.palette.onSurface} />
          </Pressable>
          <View style={styles.appBarCopy}>
            <Text style={styles.appBarTitle}>Add items</Text>
            <Text style={styles.appBarSubtitle}>
              {customerName ? `Billing · ${customerName}` : 'Billing'}
            </Text>
          </View>
        </View>

        <View style={styles.topTabs}>
          {TOP_TABS.map((tab) => {
            const active = top === tab.key;
            const Icon = tab.icon;
            return (
              <Pressable
                key={tab.key}
                style={[styles.topTab, active && styles.topTabOn]}
                onPress={() => {
                  setTop(tab.key);
                  goTo(SUB_TABS[tab.key][0].key);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.label}
              >
                <Icon
                  size={15}
                  color={active ? (theme.colors.onAccent ?? '#FFFFFF') : theme.palette.muted}
                />
                <Text style={active ? styles.topTabLabelOn : styles.topTabLabel}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.subTabs}>
          {SUB_TABS[top].map((tab) => {
            const active = kind === tab.key;
            const count = picked[tab.key].length;
            return (
              <Pressable
                key={tab.key}
                style={[styles.subTab, active && styles.subTabOn]}
                onPress={() => goTo(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.label}
              >
                <Text style={active ? styles.subTabLabelOn : styles.subTabLabel}>
                  {count ? `${tab.label} · ${count}` : tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.searchWrap}>
          <Search size={15} color={theme.palette.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${NOUN[kind]}s…`}
            placeholderTextColor={theme.palette.muted}
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.helper}>{HELPER[kind]}</Text>

        {source.error ? (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>{source.error}</Text>
            {source.onRetry ? (
              <Pressable onPress={source.onRetry} accessibilityRole="button">
                <Text style={styles.retry}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {source.loading ? <ActivityIndicator style={styles.spinner} size="small" /> : null}

        <FlatList
          data={filtered}
          keyExtractor={(row) => `${kind}-${row.id}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.list, { paddingBottom: 110 + insets.bottom }]}
          renderItem={({ item: row }) => {
            const isAdded = added.has(row.id);
            const isPicked = picked[kind].some((r) => r.id === row.id);
            const on = isPicked || isAdded;
            const Icon = KIND_ICON[kind];
            return (
              <Pressable
                style={[styles.row, on && styles.rowOn]}
                onPress={() => toggle(row)}
                disabled={isAdded}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: isAdded }}
                accessibilityLabel={row.title}
              >
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Check size={12} color={theme.colors.onAccent ?? '#FFFFFF'} /> : null}
                </View>
                <View style={styles.rowIcon}>
                  <Icon size={15} color={theme.palette.muted} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {row.title}
                  </Text>
                  <View style={styles.rowMeta}>
                    {row.subtitle ? <Text style={styles.rowSub}>{row.subtitle}</Text> : null}
                    {row.badge ? (
                      <Text style={[styles.badge, { color: toneColor(theme, row.badge.tone) }]}>
                        {row.badge.label}
                      </Text>
                    ) : null}
                    {isAdded ? <Text style={styles.rowSub}>Already on this bill</Text> : null}
                  </View>
                  {row.note ? <Text style={styles.rowNote}>{row.note}</Text> : null}
                </View>
                <Text style={styles.rowPrice}>{formatAmount(row.amount)}</Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            source.loading ? null : (
              <Text style={styles.empty}>
                {query ? `No ${NOUN[kind]} matches “${query}”.` : emptyLine(kind, customerName)}
              </Text>
            )
          }
        />

        {totals.count ? (
          <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
            <Pressable
              style={styles.addButton}
              onPress={confirm}
              accessibilityRole="button"
              accessibilityLabel={`Add ${totals.count} selected`}
            >
              <Plus size={16} color={theme.colors.onAccent ?? '#FFFFFF'} />
              <Text style={styles.addButtonText}>
                {`Add ${totals.count} selected · ${formatAmount(totals.amount)}`}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function emptyLine(kind: AddItemKind, customerName: string): string {
  const who = customerName || 'This customer';
  switch (kind) {
    case 'ORDER':
      return `${who} has no unbilled orders.`;
    case 'APPOINTMENT':
      return `${who} has no unbilled appointments.`;
    case 'PRODUCT':
      return 'No products in this catalog yet.';
    default:
      return 'No services in this catalog yet.';
  }
}

function toneColor(theme: AppTheme, tone: NonNullable<AddItemRow['badge']>['tone']): string {
  switch (tone) {
    case 'success':
      return theme.palette.success;
    case 'warning':
      return theme.palette.warning;
    case 'error':
      return theme.palette.error;
    case 'info':
      return theme.palette.info;
    default:
      return theme.palette.muted;
  }
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.palette.background },
    appBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    appBarCopy: { flex: 1, gap: 2 },
    appBarTitle: { fontSize: 16, fontWeight: '700', color: theme.palette.onBackground },
    appBarSubtitle: { fontSize: 12, color: theme.palette.muted },

    topTabs: {
      flexDirection: 'row',
      marginHorizontal: 16,
      padding: 4,
      borderRadius: 13,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    topTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      height: 38,
      borderRadius: 10,
    },
    topTabOn: { backgroundColor: theme.colors.primary },
    topTabLabel: { fontSize: 13, fontWeight: '600', color: theme.palette.muted },
    topTabLabelOn: { fontSize: 13, fontWeight: '700', color: theme.colors.onAccent ?? '#FFFFFF' },

    subTabs: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 },
    subTab: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    subTabOn: { borderColor: theme.colors.border, backgroundColor: theme.colors.softBg },
    subTabLabel: { fontSize: 12.5, fontWeight: '600', color: theme.palette.muted },
    subTabLabelOn: { fontSize: 12.5, fontWeight: '700', color: theme.colors.primary },

    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 12,
      height: 44,
      paddingHorizontal: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surfaceElevated,
    },
    searchInput: { flex: 1, color: theme.palette.onSurface, fontSize: 14 },
    helper: { marginHorizontal: 16, marginTop: 10, fontSize: 11.5, color: theme.palette.muted },

    errorBlock: { marginHorizontal: 16, marginTop: 10, gap: 4 },
    errorText: { fontSize: 12.5, color: theme.palette.error },
    retry: { fontSize: 12.5, fontWeight: '600', color: theme.colors.primary },
    spinner: { marginTop: 16 },

    list: { padding: 16, gap: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    rowOn: { borderColor: theme.colors.border, backgroundColor: theme.colors.softBg },
    check: {
      width: 20,
      height: 20,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    checkOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceElevated,
    },
    rowBody: { flex: 1, gap: 2 },
    rowTitle: { fontSize: 13.5, fontWeight: '600', color: theme.palette.onSurface },
    rowMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    rowSub: { fontSize: 11.5, color: theme.palette.muted },
    rowNote: { fontSize: 11, fontWeight: '600', color: theme.colors.primary },
    badge: { fontSize: 11, fontWeight: '600' },
    rowPrice: { fontSize: 13.5, fontWeight: '700', color: theme.colors.primary },
    empty: { fontSize: 13, color: theme.palette.muted, textAlign: 'center', marginTop: 32 },

    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: theme.palette.background,
      borderTopWidth: 1,
      borderTopColor: theme.palette.divider,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
    },
    addButtonText: { fontSize: 14, fontWeight: '700', color: theme.colors.onAccent ?? '#FFFFFF' },
  });
}
