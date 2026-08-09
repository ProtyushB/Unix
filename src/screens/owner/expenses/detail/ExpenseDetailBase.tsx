import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Banknote,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  Clock,
  Pencil,
  Repeat,
  Trash2,
  User,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import type { ExpenseDto } from '../../../../backend/modules/shared/expense.types';
import {
  categoryLabel,
  paymentMethodLabel,
  recurrenceLabel,
  reimbursementState,
} from '../../../../backend/modules/shared/expense.types';
import { Badge } from '../../shared/detail/parts/Badge';
import { DateField } from '../../shared/detail/parts/DateField';
import { DetailCard } from '../../shared/detail/parts/DetailCard';
import { DetailField } from '../../shared/detail/parts/DetailField';
import { SegmentedField } from '../../shared/detail/parts/SegmentedField';
import { formatClock } from '../../shared/detail/wallClock';
import { formatAmount, formatExpenseStampLong } from '../expense.model';
import { reimbursementPill } from '../expense.view';
import type { ExpenseFormState } from './expenseDetail.model';
import {
  DELETE_CTA,
  EDIT_CTA,
  MARK_REIMBURSED_CTA,
  REIMBURSE_HELPER,
  REIMBURSE_QUESTION,
  appBarSubtitle,
  appBarTitle,
  isEditable,
  saveButtonLabel,
  saveCtaLabel,
  showsCategoryPicker,
  showsDelete,
  showsEditCta,
  showsEmployeePicker,
  showsMarkReimbursed,
  type DetailMode,
} from './expenseDetail.view';

export interface ExpenseDetailSlots {
  /** The module chip beside the title. Data, not JSX — the row owns its tinting. */
  moduleLabel?: string;
}

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

interface ExpenseDetailBaseProps {
  mode: DetailMode;
  item: ExpenseDto | null;
  form: ExpenseFormState;
  errors: Record<string, string>;
  slots?: ExpenseDetailSlots;

  /** Whether the platform's expenseCategory feature is on. Off ⇒ the picker is hidden entirely. */
  categoryEnabled: boolean;
  /** The resolved name for `form.paidByEmployeeId`, or null when nobody is chosen. */
  employeeName: string | null;

  onFieldChange: <K extends keyof ExpenseFormState>(field: K, value: ExpenseFormState[K]) => void;
  onChangeReimbursable: (next: boolean) => void;
  onPickCategory: () => void;
  onPickPaymentMethod: () => void;
  onPickRecurrence: () => void;
  onPickTime: () => void;
  onPickEmployee: () => void;

  onBack: () => void;
  onSave?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMarkReimbursed?: () => void;
  saving?: boolean;
}

/**
 * The Expense Detail screen, in whichever of its THREE modes it was asked for.
 *
 * Three, not two: an expense moves no stock, so unlike consumption / wastage / stock transfer it
 * can simply be corrected. `editable` therefore means add-or-edit, and the read screen has a real
 * Edit affordance beside its Delete.
 */
export function ExpenseDetailBase({
  mode,
  item,
  form,
  errors,
  slots,
  categoryEnabled,
  employeeName,
  onFieldChange,
  onChangeReimbursable,
  onPickCategory,
  onPickPaymentMethod,
  onPickRecurrence,
  onPickTime,
  onPickEmployee,
  onBack,
  onSave,
  onEdit,
  onDelete,
  onMarkReimbursed,
  saving = false,
}: ExpenseDetailBaseProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const editable = isEditable(mode);
  const pill = item ? reimbursementPill(reimbursementState(item)) : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.appBar}>
        <Pressable
          onPress={onBack}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={editable ? 'Cancel' : 'Back'}
        >
          {editable ? (
            <X size={18} color={theme.palette.onBackground} />
          ) : (
            <ChevronLeft size={20} color={theme.palette.onBackground} />
          )}
        </Pressable>

        <View style={styles.appBarCopy}>
          <View style={styles.appBarTitleRow}>
            <Text
              style={editable ? styles.appBarTitleForm : styles.appBarTitleRead}
              numberOfLines={1}
            >
              {appBarTitle(mode, item)}
            </Text>
            {editable && slots?.moduleLabel ? (
              <Badge label={slots.moduleLabel} tone="accent" />
            ) : null}
          </View>
          {appBarSubtitle(mode, item) ? (
            <Text style={styles.appBarSubtitle} numberOfLines={1}>
              {appBarSubtitle(mode, item)}
            </Text>
          ) : null}
        </View>

        {editable && onSave ? (
          <Pressable
            onPress={onSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={saveButtonLabel(mode)}
            style={[styles.saveButton, saving && styles.saveButtonBusy]}
          >
            <Check size={15} color={theme.colors.onAccent ?? '#FFFFFF'} />
            <Text style={styles.saveLabel}>{saveCtaLabel(mode)}</Text>
          </Pressable>
        ) : (
          <View style={styles.iconButtonSpacer} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {editable ? (
          <>
            <DetailCard title="Expense" icon={Banknote} gap={13}>
              <DetailField
                label="Title"
                value={form.title}
                editable
                required
                placeholder="e.g. March electricity bill"
                onChange={(t) => onFieldChange('title', t)}
                error={errors.title}
              />

              {showsCategoryPicker(categoryEnabled) ? (
                <PickerField
                  label="Category"
                  required
                  value={categoryLabel(form.category)}
                  onPress={onPickCategory}
                  styles={styles}
                  theme={theme}
                />
              ) : null}

              <View style={styles.row2}>
                <View style={styles.rowHalf}>
                  <DetailField
                    label="Amount (₹)"
                    value={form.amount}
                    editable
                    required
                    keyboardType="decimal-pad"
                    placeholder="0"
                    onChange={(t) => onFieldChange('amount', t)}
                    error={errors.amount}
                  />
                </View>
                <View style={styles.rowHalf}>
                  <PickerField
                    label="Payment Method"
                    value={paymentMethodLabel(form.paymentMethod)}
                    onPress={onPickPaymentMethod}
                    styles={styles}
                    theme={theme}
                  />
                </View>
              </View>

              {/*
                Date + a slot list rather than a platform datetime picker — a native one hands back
                a `Date` in the DEVICE's zone, which is the conversion this field exists to avoid.
                Same choice consumption and appointments made.
              */}
              <View style={styles.row2}>
                <View style={styles.rowHalf}>
                  <DateField
                    label="Expense Date"
                    value={form.date}
                    editable
                    onChange={(ymd) => onFieldChange('date', ymd)}
                  />
                </View>
                <View style={styles.rowHalf}>
                  <PickerField
                    label="Time"
                    value={formatClock(form.time) || 'Pick a time'}
                    onPress={onPickTime}
                    styles={styles}
                    theme={theme}
                    icon="clock"
                  />
                </View>
              </View>

              <DetailField
                label="Vendor"
                value={form.vendorName}
                editable
                placeholder="e.g. Tata Power"
                onChange={(t) => onFieldChange('vendorName', t)}
              />
            </DetailCard>

            <DetailCard title="Reimbursement" icon={User} gap={13}>
              <SegmentedField
                label={REIMBURSE_QUESTION}
                options={YES_NO}
                value={form.reimbursable ? 'yes' : 'no'}
                onChange={(next) => onChangeReimbursable(next === 'yes')}
                helper={REIMBURSE_HELPER}
              />
              {showsEmployeePicker(form) ? (
                <PickerField
                  label="Reimburse to"
                  required
                  value={employeeName ?? 'Choose a staff member'}
                  muted={!employeeName}
                  onPress={onPickEmployee}
                  error={errors.paidByEmployeeId}
                  styles={styles}
                  theme={theme}
                />
              ) : null}
            </DetailCard>

            <DetailCard title="More" icon={Repeat} gap={13}>
              <PickerField
                label="Recurring"
                value={recurrenceLabel(form.recurrence)}
                onPress={onPickRecurrence}
                styles={styles}
                theme={theme}
              />
              <DetailField
                label="Notes"
                value={form.notes}
                editable
                multiline
                placeholder="Anything the fields above do not capture"
                onChange={(t) => onFieldChange('notes', t)}
              />
            </DetailCard>

            {onSave ? (
              <Pressable
                onPress={onSave}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={saveButtonLabel(mode)}
                style={[styles.primaryButton, saving && styles.primaryButtonBusy]}
              >
                <Check size={16} color={theme.colors.onAccent ?? '#FFFFFF'} />
                <Text style={styles.primaryButtonText}>{saveButtonLabel(mode)}</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            {/* The amount is the headline of a spend record — it leads, and the pills under it say
                what kind of spend and whether anyone is owed. */}
            <View style={styles.hero}>
              <Text style={styles.heroAmount}>{formatAmount(item?.amount)}</Text>
              <View style={styles.heroPills}>
                <Badge label={categoryLabel(item?.category)} tone="neutral" />
                {pill ? <Badge label={pill.label} tone={pill.tone} /> : null}
              </View>
            </View>

            <DetailCard title="Details" icon={Banknote}>
              <DetailField label="Vendor" value={item?.vendorName || '—'} editable={false} />
              <DetailField
                label="Payment Method"
                value={paymentMethodLabel(item?.paymentMethod)}
                editable={false}
              />
              <DetailField
                label="Expense Date"
                value={formatExpenseStampLong(item?.expenseDate) || '—'}
                editable={false}
              />
              <DetailField
                label="Recurring"
                value={recurrenceLabel(item?.recurrence)}
                editable={false}
              />
              <DetailField
                label="Reimbursable"
                value={item?.reimbursable ? 'Yes' : 'No'}
                editable={false}
                tint={item?.reimbursable ? 'warning' : 'primary'}
              />
              {/* Only on a reimbursable expense — showing it always would ask the reader to
                  interpret a blank. */}
              {item?.reimbursable ? (
                <DetailField
                  label="Reimburse to"
                  value={employeeName ?? '—'}
                  editable={false}
                />
              ) : null}
              {item?.reimbursable ? (
                <DetailField
                  label="Reimbursed"
                  value={
                    item?.reimbursed
                      ? `Yes · ${formatExpenseStampLong(item?.reimbursedAt) || 'settled'}`
                      : 'No'
                  }
                  editable={false}
                  tint={item?.reimbursed ? 'success' : 'primary'}
                />
              ) : null}
              <DetailField
                label="Recorded At"
                value={formatExpenseStampLong(item?.createdAt) || '—'}
                editable={false}
              />
              {item?.notes ? (
                <DetailField
                  label="Notes"
                  value={String(item.notes)}
                  editable={false}
                  readLayout="block"
                />
              ) : null}
            </DetailCard>

            <View style={styles.actionRow}>
              {showsEditCta(mode) && onEdit ? (
                <Pressable
                  onPress={onEdit}
                  style={styles.secondaryButton}
                  accessibilityRole="button"
                  accessibilityLabel={EDIT_CTA}
                >
                  <Pencil size={15} color={theme.palette.onSurface} />
                  <Text style={styles.secondaryButtonText}>{EDIT_CTA}</Text>
                </Pressable>
              ) : null}
              {showsMarkReimbursed(mode, item) && onMarkReimbursed ? (
                <Pressable
                  onPress={onMarkReimbursed}
                  disabled={saving}
                  style={styles.successButton}
                  accessibilityRole="button"
                  accessibilityLabel={MARK_REIMBURSED_CTA}
                >
                  <CircleCheck size={15} color={theme.palette.success} />
                  <Text style={styles.successButtonText}>{MARK_REIMBURSED_CTA}</Text>
                </Pressable>
              ) : null}
            </View>

            {showsDelete(mode) && onDelete ? (
              <Pressable
                onPress={onDelete}
                disabled={saving}
                style={styles.dangerButton}
                accessibilityRole="button"
                accessibilityLabel={DELETE_CTA}
              >
                <Trash2 size={15} color={theme.palette.error} />
                <Text style={styles.dangerButtonText}>{DELETE_CTA}</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * A labelled row that opens a sheet — the form's stand-in for a `<select>`.
 *
 * Geometry matches `DetailField`'s input (44 high, 12 radius) so a form mixing the two reads as one
 * column rather than as two kinds of control.
 */
function PickerField({
  label,
  value,
  onPress,
  styles,
  theme,
  required,
  muted,
  error,
  icon,
}: {
  label: string;
  value: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
  required?: boolean;
  muted?: boolean;
  error?: string;
  icon?: 'clock';
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.editLabel}>{label}</Text>
        {required ? <Text style={styles.required}>*</Text> : null}
      </View>
      <Pressable
        onPress={onPress}
        style={styles.pickerBox}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
      >
        <Text style={muted ? styles.pickerPlaceholder : styles.pickerValue} numberOfLines={1}>
          {value}
        </Text>
        {icon === 'clock' ? (
          <Clock size={15} color={theme.palette.muted} />
        ) : (
          <ChevronDown size={16} color={theme.palette.muted} />
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, palette } = theme;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },

    appBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
    },
    iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    iconButtonSpacer: { width: 36 },
    appBarCopy: { flex: 1, gap: 2 },
    appBarTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    appBarTitleForm: { fontSize: 16, fontWeight: '700', color: palette.onBackground },
    appBarTitleRead: { fontSize: 16, fontWeight: '700', color: palette.onBackground, flexShrink: 1 },
    appBarSubtitle: { fontSize: 11.5, color: palette.muted },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    saveButtonBusy: { opacity: 0.6 },
    saveLabel: { fontSize: 13, fontWeight: '700', color: colors.onAccent ?? '#FFFFFF' },

    content: { padding: 16, gap: 14 },

    field: { gap: 6 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    editLabel: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
    required: { fontSize: 12.5, color: palette.error },
    error: { fontSize: 11.5, color: palette.error },

    row2: { flexDirection: 'row', gap: 12 },
    rowHalf: { flex: 1 },

    pickerBox: {
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    pickerValue: { flex: 1, fontSize: 13.5, color: palette.onSurface },
    pickerPlaceholder: { flex: 1, fontSize: 13.5, color: palette.muted },

    hero: {
      gap: 12,
      padding: 16,
      borderRadius: 16,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    heroAmount: { fontSize: 30, fontWeight: '800', color: palette.onBackground },
    heroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

    actionRow: { flexDirection: 'row', gap: 12 },
    secondaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      borderRadius: 14,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    secondaryButtonText: { fontSize: 13.5, fontWeight: '700', color: palette.onSurface },
    successButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      borderRadius: 14,
      backgroundColor: `${palette.success}22`,
      borderWidth: 1,
      borderColor: `${palette.success}55`,
    },
    successButtonText: { fontSize: 13.5, fontWeight: '700', color: palette.success },
    dangerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      borderRadius: 14,
      backgroundColor: `${palette.error}18`,
      borderWidth: 1,
      borderColor: `${palette.error}44`,
    },
    dangerButtonText: { fontSize: 13.5, fontWeight: '700', color: palette.error },

    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    primaryButtonBusy: { opacity: 0.6 },
    primaryButtonText: { fontSize: 14, fontWeight: '700', color: colors.onAccent ?? '#FFFFFF' },
  });
}
