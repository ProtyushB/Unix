import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Search } from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import { initialsOf } from '../../../../utils/formatters';
import {
  employeeMetaLine,
  filterEmployees,
  type EmployeeOption,
} from './employeePicker.model';

/**
 * Pick the staff member an expense reimburses.
 *
 * Deliberately NOT `CatalogPickerSheet`: that one requires a numeric `id` and a `price` it renders
 * unconditionally, so every row here would draw `₹0`, and it has no avatar slot at all — the 32×32
 * thumbnail was removed from it on purpose. Deliberately not `CustomerPickerSheet` either, which is
 * hard-wired to `useCustomerPicker` and carries a Centrix-wide lookup card and a create form that
 * have no meaning for staff.
 *
 * So: `OptionSheet`'s container (bottom sheet, own insets, `maxHeight: '70%'`) with
 * `CustomerPickerSheet`'s row (avatar initials, name, meta line).
 *
 * ⚠️ The `id` on each option is an `employments(id)`, not a person id — see `employeePicker.model`.
 *
 * ⚠️ A `Modal` renders outside the screen's SafeAreaView and gets no inset from anywhere; the
 * bottom one is read and applied here. Never mount this while another Modal is up — on
 * react-native-web the loser's portal stays mounted and silently eats taps.
 */

interface Props {
  visible: boolean;
  options: EmployeeOption[];
  /** The currently chosen `employments(id)`, if any. */
  selected?: number | null;
  loading?: boolean;
  error?: string | null;
  onSelect: (option: EmployeeOption) => void;
  onClose: () => void;
}

export function EmployeePickerSheet({
  visible,
  options,
  selected,
  loading = false,
  error = null,
  onSelect,
  onClose,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  // Clear on open — a sheet that reopens still filtered looks like it has lost people.
  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const shown = filterEmployees(options, query);

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
          <Text style={styles.title}>Reimburse to</Text>
          {/* Says what the field is FOR, because "reimburse to" alone invites picking whoever
              performed the service rather than whoever paid. */}
          <Text style={styles.note}>Only expenses a staff member paid can be reimbursed.</Text>

          <View style={styles.searchRow}>
            <Search size={16} color={theme.palette.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, email or role"
              placeholderTextColor={theme.palette.muted}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Search name, email or role"
            />
          </View>

          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={styles.state}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : null}

            {!loading && error ? <Text style={styles.error}>{error}</Text> : null}

            {!loading && !error && shown.length === 0 ? (
              <Text style={styles.empty}>
                {query.trim()
                  ? `No one matches “${query.trim()}”.`
                  : 'No active staff on this business yet.'}
              </Text>
            ) : null}

            {shown.map((option) => {
              const active = option.id === selected;
              const meta = employeeMetaLine(option);
              return (
                <Pressable
                  key={option.id}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => {
                    onSelect(option);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Select ${option.name}`}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initialsOf(option.name)}</Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={active ? styles.rowNameActive : styles.rowName} numberOfLines={1}>
                      {option.name}
                    </Text>
                    {meta ? (
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {meta}
                      </Text>
                    ) : null}
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
    title: { fontSize: 16, fontWeight: '700', color: theme.palette.onBackground },
    note: { fontSize: 11.5, color: theme.palette.muted, marginTop: 4, marginBottom: 12 },

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

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    rowActive: { backgroundColor: theme.colors.softBg, borderColor: theme.colors.border },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.softBg,
    },
    avatarText: { fontSize: 12.5, fontWeight: '700', color: theme.colors.primary },
    rowBody: { flex: 1, gap: 2 },
    rowName: { fontSize: 14, fontWeight: '600', color: theme.palette.onSurface },
    rowNameActive: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
    rowMeta: { fontSize: 11.5, color: theme.palette.muted },

    state: { paddingVertical: 28, alignItems: 'center' },
    error: { fontSize: 12.5, color: theme.palette.error, paddingVertical: 18, textAlign: 'center' },
    empty: { fontSize: 12.5, color: theme.palette.muted, paddingVertical: 18, textAlign: 'center' },
  });
}
