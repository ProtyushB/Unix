import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Beaker, Check, ChevronLeft, Info, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import type { ConsumptionDto } from '../../../../backend/modules/shared/consumption.types';
import type { StockUnitLine } from '../../../../backend/modules/shared/inventory.types';
import { Badge } from '../../shared/detail/parts/Badge';
import { DetailCard } from '../../shared/detail/parts/DetailCard';
import { DetailField } from '../../shared/detail/parts/DetailField';
import { UnitRowsEditor } from '../../shared/detail/parts/UnitRowsEditor';
import { recordQtyLabel } from '../../inventory/batchUnits';
import type { ConsumptionFormState } from './consumptionDetail.model';
import { isEditable, showsDelete, type DetailMode } from './consumptionDetail.view';

export interface ConsumptionDetailSlots {
  /** The module chip beside the title. Data, not JSX — the row owns its tinting. */
  moduleLabel?: string;
}

interface ConsumptionDetailBaseProps {
  mode: DetailMode;
  item: ConsumptionDto | null;
  form: ConsumptionFormState;
  errors: Record<string, string>;
  slots?: ConsumptionDetailSlots;

  /** How many rungs the chosen product's ladder offers — the Add-unit gate reads this. */
  ladderSize: number;
  /** The product's base unit name ("g"), for every base-unit label. */
  baseUnit: string;
  /** RAW stock on hand, in base units. Null while no product is picked — null is NOT zero. */
  availableBaseQty: number | null;

  onFieldChange: <K extends keyof ConsumptionFormState>(
    field: K,
    value: ConsumptionFormState[K],
  ) => void;
  onPickProduct?: () => void;
  onChangeUnitRows: (rows: StockUnitLine[]) => void;
  onPickRowUnit: (index: number) => void;

  onBack: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  saving?: boolean;
}

/**
 * The consumption detail screen, in whichever mode it was asked for.
 *
 * Two modes, not three: a consumption is **immutable** after creation, so there is no edit.
 * `editable` therefore means "this is the record form", and every field renders read-only in view
 * mode with no way back into an input.
 *
 * The read screen's only write is Delete — which reverses the movement rather than editing it.
 */
export function ConsumptionDetailBase({
  mode,
  item,
  form,
  errors,
  slots,
  ladderSize,
  baseUnit,
  availableBaseQty,
  onFieldChange,
  onPickProduct,
  onChangeUnitRows,
  onPickRowUnit,
  onBack,
  onSave,
  onDelete,
  saving = false,
}: ConsumptionDetailBaseProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const editable = isEditable(mode);

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
            {/* FEATURE: the title and subtitle. Put them in `consumptionDetail.view.ts` as
                `appBarTitle(mode, item)` / `appBarSubtitle(mode)` so a test can pin the copy —
                see `batchDetail.view.ts`. */}
            <Text style={editable ? styles.appBarTitleForm : styles.appBarTitleRead}>
              {editable ? 'Record Consumption' : form.itemName || 'Consumption'}
            </Text>
            {editable && slots?.moduleLabel ? (
              <Badge label={slots.moduleLabel} tone="accent" />
            ) : null}
          </View>
        </View>

        {editable && onSave ? (
          <Pressable
            onPress={onSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save consumption"
            style={[styles.saveButton, saving && styles.saveButtonBusy]}
          >
            <Check size={15} color={theme.colors.onAccent ?? '#FFFFFF'} />
            <Text style={styles.saveLabel}>Save</Text>
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
        <DetailCard title={editable ? 'What was used' : 'Consumption'} icon={Beaker} gap={13}>
          <DetailField
            label="Product"
            value={form.itemName}
            editable={false}
            required={editable}
            error={errors.itemId}
          />
          {/* The picker is a Modal owned by the route screen — this only asks for it. */}
          {editable && onPickProduct ? (
            <Pressable
              onPress={onPickProduct}
              style={styles.pickerButton}
              accessibilityRole="button"
              accessibilityLabel="Select product"
            >
              <Text style={styles.pickerLabel}>
                {form.itemId == null ? 'Select product' : 'Change product'}
              </Text>
            </Pressable>
          ) : null}

          {editable ? (
            <View style={styles.field}>
              <Text style={styles.editLabel}>Quantity</Text>
              <UnitRowsEditor
                rows={form.unitRows}
                ladderSize={ladderSize}
                availableBaseQty={availableBaseQty}
                baseUnit={baseUnit}
                onChangeQty={(index, qty) =>
                  onChangeUnitRows(
                    form.unitRows.map((r, i) =>
                      i === index ? { ...r, qty: Number(qty) || 0 } : r,
                    ),
                  )
                }
                onPickUnit={onPickRowUnit}
                // FEATURE: seed the new row from the next unused rung of the product's ladder.
                onAddRow={() =>
                  onChangeUnitRows([...form.unitRows, { unit: '', perStock: 1, qty: 0 }])
                }
                onRemoveRow={(index) =>
                  onChangeUnitRows(form.unitRows.filter((_, i) => i !== index))
                }
              />
              {errors.quantity ? <Text style={styles.error}>{errors.quantity}</Text> : null}
            </View>
          ) : (
            <DetailField
              label="Quantity used"
              value={recordQtyLabel(
                { quantity: item?.quantity, unitName: item?.unitName, unitLines: item?.unitLines },
                baseUnit,
              )}
              editable={false}
            />
          )}

          {/* FEATURE: the Reason picker (add) and the reason row (view). Chips or an OptionSheet
              driven by `CONSUMPTION_REASONS`; the label belongs in `consumption.view.ts`. */}
          {/* FEATURE: the "when" field. */}

          {/* Notes needs no design decision, so it is wired rather than left as a hole — it is also
              the example of how `onFieldChange` reaches the rest of the form. */}
          <DetailField
            label="Notes"
            value={form.notes}
            editable={editable}
            onChange={(text) => onFieldChange('notes', text)}
            placeholder="Anything worth recording"
            multiline
            readLayout="block"
          />
        </DetailCard>

        {/*
          FEATURE: the FEFO ledger card, view mode only.

          ⚠️ Read the field names off `ConsumptionDeduction`, not off the stock-transfer screen:
          this record's ledger is `item.deductions` with a `qty` per row. A transfer's is
          `item.lines` with `sourceBatchId` / `destBatchId` / `quantity`. The two blocks look
          copy-pasteable and are not — a copy renders an EMPTY table with no error at all.
        */}
        {!editable ? (
          <DetailCard title="Drawn from" icon={Info}>
            <Text style={styles.placeholder}>
              {/* FEATURE: the batch rows. */}
              {item?.deductions?.length
                ? `${item.deductions.length} batch${item.deductions.length === 1 ? '' : 'es'}`
                : '—'}
            </Text>
          </DetailCard>
        ) : null}

        {showsDelete(mode) && onDelete ? (
          <Pressable
            onPress={onDelete}
            style={styles.deleteButton}
            accessibilityRole="button"
            accessibilityLabel="Delete consumption"
          >
            <Trash2 size={16} color={theme.palette.error} />
            <Text style={styles.deleteLabel}>Delete consumption</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    iconButtonSpacer: { width: 36, height: 36 },
    appBarCopy: { flex: 1, gap: 2 },
    appBarTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    appBarTitleForm: { fontSize: 17, fontWeight: '800', color: palette.onBackground },
    appBarTitleRead: { fontSize: 15.5, fontWeight: '800', color: palette.onBackground },

    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 34,
      paddingHorizontal: 13,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    saveButtonBusy: { opacity: 0.6 },
    saveLabel: { fontSize: 13, fontWeight: '700', color: colors.onAccent ?? '#FFFFFF' },

    content: { padding: 16, gap: 14 },
    field: { gap: 7 },
    editLabel: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
    error: { fontSize: 11.5, color: palette.error },
    placeholder: { fontSize: 13, color: palette.muted },

    pickerButton: {
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 13,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: colors.softBg,
      borderColor: colors.primary + '40',
    },
    pickerLabel: { fontSize: 12.5, fontWeight: '600', color: colors.primary },

    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.error + '55',
    },
    deleteLabel: { fontSize: 14, fontWeight: '600', color: palette.error },
  });
}
