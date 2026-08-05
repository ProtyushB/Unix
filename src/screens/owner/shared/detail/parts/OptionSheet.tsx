import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';

export interface SheetOption {
  value: string;
  label: string;
  /** Optional second line, for an option whose consequence is not obvious from its name. */
  sub?: string;
}

interface Props {
  visible: boolean;
  title: string;
  options: SheetOption[];
  selected?: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
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
export function OptionSheet({ visible, title, options, selected, onSelect, onClose }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

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
          <ScrollView bounces={false}>
            {options.map((option) => {
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
                  <View style={styles.optionBody}>
                    <Text style={active ? styles.labelActive : styles.label}>{option.label}</Text>
                    {option.sub ? <Text style={styles.sub}>{option.sub}</Text> : null}
                  </View>
                  {active ? <Check size={16} color={theme.colors.primary} /> : null}
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
    optionActive: { backgroundColor: theme.colors.softBg, borderColor: theme.colors.border },
    optionBody: { flex: 1, gap: 2 },
    label: { fontSize: 14, fontWeight: '600', color: theme.palette.onSurface },
    labelActive: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
    sub: { fontSize: 11.5, color: theme.palette.muted },
  });
}
