import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Search } from 'lucide-react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';
import { filterSheetOptions, noOptionMatchText } from '../optionSheet.view';

export interface SheetOption {
  value: string;
  label: string;
  /** Optional second line, for an option whose consequence is not obvious from its name. */
  sub?: string;
  /**
   * A filled dot before the label, in the option's own colour. Status sheets pass the theme's
   * `StatusColorSet.text` here so the row matches the chip it produces; see `statusSheetOptions`.
   */
  dotColor?: string;
  /**
   * Label colour. OUTRANKS the selected-row accent: without it, picking a status repainted the one
   * row the reader is most likely to look at, and it then disagreed with the chip behind the sheet.
   * The check mark and the tinted row still mark the selection.
   */
  textColor?: string;
}

interface Props {
  visible: boolean;
  title: string;
  options: SheetOption[];
  selected?: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
  /**
   * Supplying this turns on a search box, using the string as its placeholder. OPT-IN: most callers
   * list four to eight statuses, where a search box is clutter. It exists for lists long enough to
   * scroll — the expense category picker is fifteen.
   */
  searchPlaceholder?: string;
}

/**
 * A single-select bottom sheet.
 *
 * Exists because the detail screens draw several dropdowns — order status, appointment status, and
 * a bill's two independent status axes — and a native `<select>` has no equivalent here. Generic
 * rather than one sheet per field, since every one of them is "pick a string from a short list".
 *
 * ⚠️ A `Modal` renders in its own window, OUTSIDE the screen's SafeAreaView, so it gets no inset
 * from anywhere. The bottom inset is read and applied here.
 *
 * ⚠️ Never mount this while another Modal is up — on react-native-web the previous one's portal
 * stays mounted after `visible` flips false and silently eats taps.
 */
export function OptionSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  searchPlaceholder,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  // Clear the box each time the sheet opens. A sheet that reopens still filtered looks like it has
  // lost options, and the query is not a setting the user asked to keep.
  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const shown = filterSheetOptions(options, searchPlaceholder ? query : '');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
          <Text style={styles.title}>{title}</Text>
          {searchPlaceholder ? (
            <View style={styles.searchRow}>
              <Search size={16} color={theme.palette.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={theme.palette.muted}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                accessibilityLabel={searchPlaceholder}
              />
            </View>
          ) : null}
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            {shown.length === 0 ? (
              <Text style={styles.empty}>{noOptionMatchText(query)}</Text>
            ) : null}
            {shown.map((option) => {
              const active = option.value === selected;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={option.label}
                >
                  {option.dotColor ? (
                    <View style={[styles.dot, { backgroundColor: option.dotColor }]} />
                  ) : null}
                  <View style={styles.optionBody}>
                    <Text
                      style={[
                        active ? styles.labelActive : styles.label,
                        option.textColor ? { color: option.textColor } : null,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {option.sub ? <Text style={styles.sub}>{option.sub}</Text> : null}
                  </View>
                  {active ? <Check size={16} color={option.textColor ?? theme.colors.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.palette.overlay },
    sheet: {
      maxHeight: '70%',
      paddingHorizontal: 16,
      paddingTop: 20,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: theme.palette.surface,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.palette.onBackground,
      marginBottom: 12,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginBottom: 12,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    searchInput: { flex: 1, fontSize: 13.5, color: theme.palette.onSurface, padding: 0 },
    empty: { fontSize: 12.5, color: theme.palette.muted, paddingVertical: 18, textAlign: 'center' },
    optionActive: { backgroundColor: theme.colors.softBg, borderColor: theme.colors.border },
    dot: { width: 8, height: 8, borderRadius: 4 },
    optionBody: { flex: 1, gap: 2 },
    label: { fontSize: 14, fontWeight: '600', color: theme.palette.onSurface },
    labelActive: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
    sub: { fontSize: 11.5, color: theme.palette.muted },
  });
}
