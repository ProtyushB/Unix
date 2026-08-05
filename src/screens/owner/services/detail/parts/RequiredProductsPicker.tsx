import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Search, X } from 'lucide-react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';
import {
  filterProductOptions,
  resolveProductName,
  toggleProductId,
  type ProductOption,
} from '../serviceDetail.model';

/**
 * How many filtered rows are rendered at once.
 *
 * The web portal scrolls this list inside a `max-h-56` box. That does not port: the whole screen is
 * one ScrollView, and a nested vertical scroller inside it fights the parent for the gesture. So
 * the list is capped and search does the narrowing instead — which is also fewer taps.
 */
const VISIBLE_LIMIT = 8;

interface RequiredProductsPickerProps {
  editable: boolean;
  /** Selected product ids, in the order they were added. */
  value: number[];
  /** `{id, name}` for the business's products. Empty while loading, or after a failure. */
  options: ProductOption[];
  optionsLoading: boolean;
  optionsError: string | null;
  /** True when the business has more products than the single page that was fetched. */
  truncated?: boolean;
  onRetryOptions?: () => void;
  onChange: (next: number[]) => void;
}

/**
 * The products a service consumes. IDs only — the server stores no quantities, and it does not
 * deduct stock either; recording the consumption is a separate, manual act.
 *
 * The card and its title live in the screen, as `SaleUnitsEditor`'s do, so this owns only the body.
 */
export function RequiredProductsPicker({
  editable,
  value,
  options,
  optionsLoading,
  optionsError,
  truncated = false,
  onRetryOptions,
  onChange,
}: RequiredProductsPickerProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');

  const chips = value.length ? (
    <View style={styles.chipWrap}>
      {value.map((id) => (
        <View key={id} style={styles.chip}>
          {/*
            Falls back to `#12` when the id resolves to nothing. Not an edge case: the column is
            bare jsonb with no foreign key, so a deleted product leaves its id here for good.
          */}
          <Text style={styles.chipLabel}>{resolveProductName(options, id)}</Text>
          {editable ? (
            <Pressable
              onPress={() => onChange(toggleProductId(value, id))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${resolveProductName(options, id)}`}
            >
              <X size={12} color={theme.colors.primary} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  ) : (
    <Text style={styles.empty}>No required products</Text>
  );

  if (!editable) {
    return (
      <View style={styles.block}>
        {chips}
        <Text style={styles.help}>Raw products consumed per booking (IDs only).</Text>
      </View>
    );
  }

  const matches = filterProductOptions(options, query);
  const shown = matches.slice(0, VISIBLE_LIMIT);
  const overflow = matches.length - shown.length;

  return (
    <View style={styles.block}>
      {chips}

      <View style={styles.search}>
        <Search size={16} color={theme.palette.muted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search products…"
          placeholderTextColor={theme.palette.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {optionsLoading && options.length === 0 ? (
        <Text style={styles.note}>Loading products…</Text>
      ) : null}

      {optionsError ? (
        <View style={styles.errorRow}>
          {/* The save is never blocked by this: the payload reads the id list, not these names. */}
          <Text style={styles.error}>{optionsError}</Text>
          {onRetryOptions ? (
            <Pressable onPress={onRetryOptions} accessibilityRole="button">
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!optionsLoading && !optionsError && options.length === 0 ? (
        <Text style={styles.note}>No products in this business yet.</Text>
      ) : null}

      {shown.map((option) => {
        const selected = value.includes(option.id);
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(toggleProductId(value, option.id))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
              {option.name}
            </Text>
            {selected ? <Check size={15} color={theme.colors.primary} /> : null}
          </Pressable>
        );
      })}

      {overflow > 0 ? (
        <Text style={styles.note}>{overflow} more — keep typing to narrow.</Text>
      ) : null}
      {truncated ? <Text style={styles.note}>Showing the first 500 products.</Text> : null}

      <Text style={styles.help}>Raw products this service consumes — IDs only.</Text>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    block: { gap: 10 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.colors.primary + '1F',
    },
    chipLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.primary },
    empty: { fontSize: 13, color: theme.palette.muted },
    // Same geometry as DetailField's input, so the search box lines up with every other control.
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      height: 44,
      paddingHorizontal: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surfaceElevated,
    },
    searchInput: { flex: 1, fontSize: 14, color: theme.palette.onSurface, padding: 0 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    optionSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '14',
    },
    optionLabel: { flex: 1, fontSize: 13, color: theme.palette.onSurface },
    optionLabelSelected: { fontWeight: '600', color: theme.colors.primary },
    note: { fontSize: 11, color: theme.palette.muted },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    error: { flex: 1, fontSize: 12, color: theme.palette.error },
    retry: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },
    help: { fontSize: 11, color: theme.palette.muted, lineHeight: 15.4 },
  });
}
