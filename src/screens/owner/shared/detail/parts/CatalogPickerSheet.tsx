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
import { Check, ChevronLeft, Image as ImageIcon, Plus, Search } from 'lucide-react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';
import { formatCurrency } from '../../../../../utils/formatters';

/**
 * One pickable catalog row, already flattened by the caller.
 *
 * Flattened rather than generic-over-the-DTO on purpose: a product's second line is its brand and
 * a service's is its duration, and a picker that knew about both would grow a branch per resource.
 * The caller owns the mapping, this owns the interaction.
 */
export interface CatalogRow {
  id: number;
  name: string;
  price: number;
  /** Second line — a brand, a duration, whatever identifies the row. */
  subtitle?: string;
  /** Small tinted chip: stock for a product, availability for a service. */
  badge?: { label: string; tone: 'success' | 'warning' | 'error' | 'muted' };
  /** Anything the caller needs back on selection. Passed through untouched. */
  raw?: unknown;
}

interface Props {
  visible: boolean;
  title: string;
  subtitle: string;
  /** Sits under the search box. The mockups use it to explain what happens AFTER adding. */
  helper: string;
  searchPlaceholder: string;
  /** "product" / "service" — pluralised into the footer button. */
  noun: string;
  rows: CatalogRow[];
  loading: boolean;
  error: string | null;
  /** Already on the record. Shown ticked and inert. */
  alreadyAdded: number[];
  /**
   * One row only: tapping confirms immediately and there is no footer button.
   *
   * For records that hold exactly one catalog row — an inventory batch belongs to a single product.
   * Left multi-select by default because orders, appointments and bills all add several at once,
   * and a footer reading "Add 1 product" after every tap would be noise there.
   */
  singleSelect?: boolean;
  onAdd: (rows: CatalogRow[]) => void;
  onClose: () => void;
  onRetry?: () => void;
}

/**
 * Pick catalog rows to put on an order, an appointment or a bill.
 *
 * Search is CLIENT-side over the page already loaded. The server's own catalog search runs the
 * batched stock enrich and is the expensive call in the module, so re-running it per keystroke to
 * filter a list already in memory would be the wrong trade.
 *
 * Quantity and sale unit are deliberately not set here — every mockup's helper text says to set
 * them on the line after adding. A picker that also priced things would be two screens in one.
 *
 * ⚠️ Modal insets and the never-two-Modals rule: see `OptionSheet`.
 */
export function CatalogPickerSheet({
  visible,
  title,
  subtitle,
  helper,
  searchPlaceholder,
  noun,
  rows,
  loading,
  error,
  alreadyAdded,
  singleSelect = false,
  onAdd,
  onClose,
  onRetry,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<number[]>([]);

  const added = useMemo(() => new Set(alreadyAdded), [alreadyAdded]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.subtitle ?? '').toLowerCase().includes(q),
    );
  }, [rows, query]);

  const reset = () => {
    setPicked([]);
    setQuery('');
  };

  const toggle = (id: number) => {
    if (added.has(id)) return;
    if (singleSelect) {
      // Confirm on tap. Selecting then hunting for a footer button is a step too many when the
      // answer can only ever be one row.
      const row = rows.find((r) => r.id === id);
      if (row) {
        onAdd([row]);
        reset();
        onClose();
      }
      return;
    }
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const confirm = () => {
    onAdd(rows.filter((r) => picked.includes(r.id)));
    reset();
    onClose();
  };

  const dismiss = () => {
    reset();
    onClose();
  };

  const plural = picked.length === 1 ? noun : `${noun}s`;

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
            accessibilityLabel={`Close ${title.toLowerCase()}`}
          >
            <ChevronLeft size={20} color={theme.palette.onSurface} />
          </Pressable>
          <View style={styles.appBarCopy}>
            <Text style={styles.appBarTitle}>{title}</Text>
            <Text style={styles.appBarSubtitle}>{subtitle}</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Search size={15} color={theme.palette.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={theme.palette.muted}
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.helper}>{helper}</Text>

        {error ? (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>{error}</Text>
            {onRetry ? (
              <Pressable onPress={onRetry} accessibilityRole="button">
                <Text style={styles.retry}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {loading ? <ActivityIndicator style={styles.spinner} size="small" /> : null}

        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.list, { paddingBottom: 110 + insets.bottom }]}
          renderItem={({ item }) => {
            const isAdded = added.has(item.id);
            const isPicked = picked.includes(item.id);
            return (
              <Pressable
                style={[styles.row, (isPicked || isAdded) && styles.rowPicked]}
                onPress={() => toggle(item.id)}
                disabled={isAdded}
                // Single-select confirms on tap, so it is a button, not a checkbox — and a
                // screen reader announcing "checkbox, unchecked" would promise a selection step
                // that does not exist.
                accessibilityRole={singleSelect ? 'button' : 'checkbox'}
                accessibilityState={
                  singleSelect
                    ? { disabled: isAdded }
                    : { checked: isPicked || isAdded, disabled: isAdded }
                }
                accessibilityLabel={item.name}
              >
                {/* The empty tick box is the multi-select affordance; in single-select it would
                    imply a selection you then have to confirm. Kept for an already-added row,
                    where it explains why the row is inert. */}
                {!singleSelect || isAdded ? (
                  <View style={[styles.check, (isPicked || isAdded) && styles.checkOn]}>
                    {isPicked || isAdded ? (
                      <Check size={12} color={theme.colors.onAccent ?? '#FFFFFF'} />
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.thumb}>
                  <ImageIcon size={15} color={theme.palette.muted} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.rowMeta}>
                    {item.subtitle ? <Text style={styles.rowSub}>{item.subtitle}</Text> : null}
                    {item.badge ? (
                      <Text style={[styles.badge, { color: toneColor(theme, item.badge.tone) }]}>
                        {item.badge.label}
                      </Text>
                    ) : null}
                    {isAdded ? <Text style={styles.rowSub}>Already added</Text> : null}
                  </View>
                </View>
                <Text style={styles.rowPrice}>{money(item.price)}</Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            loading ? null : (
              <Text style={styles.empty}>
                {query ? `No ${noun} matches “${query}”.` : `No ${noun}s in this catalog yet.`}
              </Text>
            )
          }
        />

        {picked.length ? (
          <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
            <Pressable
              style={styles.addButton}
              onPress={confirm}
              accessibilityRole="button"
              accessibilityLabel={`Add ${picked.length} ${plural}`}
            >
              <Plus size={16} color={theme.colors.onAccent ?? '#FFFFFF'} />
              <Text style={styles.addButtonText}>
                Add {picked.length} {plural}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/** Whole rupees, paise kept when real — the same contract the list rows use. */
function money(n: number): string {
  return formatCurrency(n).replace(/\.00$/, '');
}

function toneColor(theme: AppTheme, tone: NonNullable<CatalogRow['badge']>['tone']): string {
  switch (tone) {
    case 'success':
      return theme.palette.success;
    case 'warning':
      return theme.palette.warning;
    case 'error':
      return theme.palette.error;
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

    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
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
    rowPicked: { borderColor: theme.colors.border, backgroundColor: theme.colors.softBg },
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
    thumb: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceElevated,
    },
    rowBody: { flex: 1, gap: 2 },
    rowName: { fontSize: 13.5, fontWeight: '600', color: theme.palette.onSurface },
    rowMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    rowSub: { fontSize: 11.5, color: theme.palette.muted },
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
