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
import { formatAmount } from '../../order.model';

/** One pickable product. Loose `saleUnits` — the caller passes the catalog row straight through. */
export interface PickableProduct {
  id: number;
  name: string;
  brand: string;
  price: number;
  /** null when the business has inventory off, or the product is untracked. */
  availableQuantity: number | null;
  saleUnits?: unknown;
}

interface Props {
  visible: boolean;
  subtitle: string;
  products: PickableProduct[];
  loading: boolean;
  error: string | null;
  /** Already on the order. Shown ticked and inert — adding one twice folds into the same line. */
  alreadyAdded: number[];
  onAdd: (products: PickableProduct[]) => void;
  onClose: () => void;
  onRetry?: () => void;
}

/**
 * Pick products to put on an order.
 *
 * Multi-select with a sticky "Add N products" footer, as drawn. Search is CLIENT-side over the
 * page already loaded: `getAllProducts({search})` runs the batched stock enrich server-side and is
 * the expensive call in the catalog, so re-running it per keystroke to filter a list already in
 * memory would be the wrong trade.
 *
 * Quantity and sale unit are deliberately NOT set here — the mockup's own helper text says "set
 * sale-unit & quantity on the line after adding". A picker that also priced things would be two
 * screens in one.
 *
 * ⚠️ Modal insets and the never-two-Modals rule: see `OptionSheet`.
 */
export function ProductPickerSheet({
  visible,
  subtitle,
  products,
  loading,
  error,
  alreadyAdded,
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
    if (!q) return products;
    // Name and brand only, matching what the server's own product search matches — so the client
    // filter and a future server filter cannot disagree about what "found" means.
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q),
    );
  }, [products, query]);

  const toggle = (id: number) => {
    if (added.has(id)) return;
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const confirm = () => {
    const chosen = products.filter((p) => picked.includes(p.id));
    onAdd(chosen);
    setPicked([]);
    setQuery('');
    onClose();
  };

  const dismiss = () => {
    setPicked([]);
    setQuery('');
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
            accessibilityLabel="Close product picker"
          >
            <ChevronLeft size={20} color={theme.palette.onSurface} />
          </Pressable>
          <View style={styles.appBarCopy}>
            <Text style={styles.appBarTitle}>Add products</Text>
            <Text style={styles.appBarSubtitle}>{subtitle}</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Search size={15} color={theme.palette.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search products…"
            placeholderTextColor={theme.palette.muted}
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.helper}>
          Tap to select — set sale-unit &amp; quantity on the line after adding
        </Text>

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
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isPicked || isAdded, disabled: isAdded }}
                accessibilityLabel={item.name}
              >
                <View style={[styles.check, (isPicked || isAdded) && styles.checkOn]}>
                  {isPicked || isAdded ? (
                    <Check size={12} color={theme.colors.onAccent ?? '#FFFFFF'} />
                  ) : null}
                </View>
                <View style={styles.thumb}>
                  <ImageIcon size={15} color={theme.palette.muted} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.rowMeta}>
                    {item.brand ? <Text style={styles.rowBrand}>{item.brand}</Text> : null}
                    <StockChip quantity={item.availableQuantity} styles={styles} />
                    {isAdded ? <Text style={styles.addedNote}>Already added</Text> : null}
                  </View>
                </View>
                <Text style={styles.rowPrice}>{formatAmount(item.price)}</Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            loading ? null : (
              <Text style={styles.empty}>
                {query ? `No product matches “${query}”.` : 'No products in this catalog yet.'}
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
              accessibilityLabel={`Add ${picked.length} product${picked.length === 1 ? '' : 's'}`}
            >
              <Plus size={16} color={theme.colors.onAccent ?? '#FFFFFF'} />
              <Text style={styles.addButtonText}>
                Add {picked.length} product{picked.length === 1 ? '' : 's'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * `null` is not zero. It means the business has inventory off, or this product is untracked —
 * rendering "Out of stock" for either would be a lie that stops a sale.
 */
function StockChip({
  quantity,
  styles,
}: {
  quantity: number | null;
  styles: ReturnType<typeof createStyles>;
}) {
  if (quantity === null || quantity === undefined) return null;
  if (quantity <= 0) return <Text style={styles.stockOut}>Out of stock</Text>;
  if (quantity <= 5) return <Text style={styles.stockLow}>Low stock</Text>;
  return <Text style={styles.stockIn}>In stock</Text>;
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
    rowBrand: { fontSize: 11.5, color: theme.palette.muted },
    rowPrice: { fontSize: 13.5, fontWeight: '700', color: theme.colors.primary },
    addedNote: { fontSize: 11, color: theme.palette.muted },
    stockIn: { fontSize: 11, fontWeight: '600', color: theme.palette.success },
    stockLow: { fontSize: 11, fontWeight: '600', color: theme.palette.warning },
    stockOut: { fontSize: 11, fontWeight: '600', color: theme.palette.error },
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
