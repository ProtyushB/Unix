import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeftRight, Check, ChevronLeft, Info, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import type {
  InventoryType,
  StockUnitLine,
} from '../../../../backend/modules/shared/inventory.types';
import type { StockTransferDto } from '../../../../backend/modules/shared/stockTransfer.types';
import { Badge } from '../../shared/detail/parts/Badge';
import { DetailCard } from '../../shared/detail/parts/DetailCard';
import { DetailField } from '../../shared/detail/parts/DetailField';
import { UnitRowsEditor } from '../../shared/detail/parts/UnitRowsEditor';
import { recordQtyLabel } from '../../inventory/batchUnits';
import type { StockTransferFormState } from './stockTransferDetail.model';
import { isEditable, showsDelete, type DetailMode } from './stockTransferDetail.view';

export interface StockTransferDetailSlots {
  /** The module chip beside the title. Data, not JSX — the row owns its tinting. */
  moduleLabel?: string;
}

interface StockTransferDetailBaseProps {
  mode: DetailMode;
  item: StockTransferDto | null;
  form: StockTransferFormState;
  errors: Record<string, string>;
  slots?: StockTransferDetailSlots;

  /** How many rungs the chosen product's ladder offers. Passed on for the row's unit picker. */
  ladderSize: number;
  /** The product's base unit name ("ml"), for every base-unit label. */
  baseUnit: string;
  /**
   * Stock on hand IN THE SOURCE POOL, in base units. Null while no product is picked — null is NOT
   * zero. Flipping the direction changes this number, so the caller must refetch on that too.
   */
  availableBaseQty: number | null;

  onFieldChange: <K extends keyof StockTransferFormState>(
    field: K,
    value: StockTransferFormState[K],
  ) => void;
  /** Sets source, destination AND reason together — see `useStockTransferDetailForm`. */
  onChangeDirection: (source: InventoryType) => void;
  onPickProduct?: () => void;
  onChangeUnitRows: (rows: StockUnitLine[]) => void;
  onPickRowUnit: (index: number) => void;

  onBack: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  saving?: boolean;
}

/**
 * The stock transfer detail screen, in whichever mode it was asked for.
 *
 * Two modes, not three: a transfer is **immutable** after creation, so there is no edit. `editable`
 * therefore means "this is the transfer form", and every field renders read-only in view mode with
 * no way back into an input.
 *
 * The read screen's only write is Delete — which reverses the move rather than editing it, and
 * which the server refuses once the destination batch has been drawn from.
 */
export function StockTransferDetailBase({
  mode,
  item,
  form,
  errors,
  slots,
  ladderSize,
  baseUnit,
  availableBaseQty,
  onFieldChange,
  onChangeDirection,
  onPickProduct,
  onChangeUnitRows,
  onPickRowUnit,
  onBack,
  onSave,
  onDelete,
  saving = false,
}: StockTransferDetailBaseProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const editable = isEditable(mode);
  const poolName = (p: InventoryType | null | undefined) =>
    p === 'RAW_INVENTORY' ? 'Raw' : 'Product';

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
            {/* FEATURE: the title and subtitle. Put them in `stockTransferDetail.view.ts` as
                `appBarTitle(mode, item)` / `appBarSubtitle(mode)` so a test can pin the copy. */}
            <Text style={editable ? styles.appBarTitleForm : styles.appBarTitleRead}>
              {editable ? 'Transfer Stock' : form.itemName || 'Transfer'}
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
            accessibilityLabel="Save transfer"
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
        <DetailCard title={editable ? 'What is moving' : 'Transfer'} icon={ArrowLeftRight} gap={13}>
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

          {/*
            Direction. ONE control, not two pickers: the destination is the other pool and the reason
            is derived from the pair — see `useStockTransferDetailForm.setDirection`. Letting the
            three be set independently is what produces a record whose reason contradicts its pools,
            which the server accepts and nothing later can detect.

            The `→` here is a direction arrow, NOT a quantity separator — the `·` convention applies
            to quantity expressions only.
          */}
          {editable ? (
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.editLabel}>Direction</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <View style={styles.segment}>
                {(
                  [
                    ['PRODUCT_INVENTORY', 'Product → Raw'],
                    ['RAW_INVENTORY', 'Raw → Product'],
                  ] as [InventoryType, string][]
                ).map(([key, label]) => {
                  const active = form.sourceType === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => onChangeDirection(key)}
                      style={[styles.segmentItem, active && styles.segmentItemActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {errors.sourceType ? <Text style={styles.error}>{errors.sourceType}</Text> : null}
            </View>
          ) : (
            <DetailField
              label="Direction"
              value={`${poolName(form.sourceType)} → ${poolName(form.destType)}`}
              editable={false}
            />
          )}

          {editable ? (
            <View style={styles.field}>
              <Text style={styles.editLabel}>Quantity</Text>
              {/*
                ⚠️ `allowMultiple={false}` — the only place in the app that passes it.

                The server DISCARDS `unitLines` on a transfer and rebuilds the destination batch from
                the scalar total, so a second row would be typed, sent, dropped, and missing from the
                detail screen the user lands on. The UI must not promise a breakdown the round trip
                will lose.
              */}
              <UnitRowsEditor
                rows={form.unitRows}
                ladderSize={ladderSize}
                availableBaseQty={availableBaseQty}
                baseUnit={baseUnit}
                allowMultiple={false}
                onChangeQty={(index, qty) =>
                  onChangeUnitRows(
                    form.unitRows.map((r, i) =>
                      i === index ? { ...r, qty: Number(qty) || 0 } : r,
                    ),
                  )
                }
                onPickUnit={onPickRowUnit}
                // Never reached while `allowMultiple` is false — `showsAddUnitRow` returns false —
                // but the prop is required, and a throw here would be a landmine if that ever flips.
                onAddRow={() => {}}
                onRemoveRow={(index) =>
                  onChangeUnitRows(form.unitRows.filter((_, i) => i !== index))
                }
              />
              {errors.quantity ? <Text style={styles.error}>{errors.quantity}</Text> : null}
            </View>
          ) : (
            <DetailField
              label="Moved"
              value={recordQtyLabel(
                { quantity: item?.quantity, unitName: item?.unitName, unitLines: item?.unitLines },
                baseUnit,
              )}
              editable={false}
            />
          )}

          {/* FEATURE: the Reason picker (add) and the reason row (view). ⚠️ If the form offers the
              non-directional reasons (REBALANCE / CORRECTION / OTHER), it must still not let the
              reason contradict the pools — see `directionalReason`. */}
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

          ⚠️ THIS ONE IS `item.lines`, NOT `item.deductions`, and each row is
          `{sourceBatchId, destBatchId, quantity}` — NOT `{batchId, qty}`. Consumption and wastage
          use the other name and the other amount key. In Centrix both blocks name the local `lines`
          and map it the same way, so they look copy-pasteable; a copy renders an EMPTY table with no
          error at all, or fills every amount cell with `undefined`.
        */}
        {!editable ? (
          <DetailCard title="Batches moved" icon={Info}>
            <Text style={styles.placeholder}>
              {/* FEATURE: the source → destination rows. */}
              {item?.lines?.length
                ? `${item.lines.length} batch${item.lines.length === 1 ? '' : 'es'}`
                : '—'}
            </Text>
          </DetailCard>
        ) : null}

        {showsDelete(mode) && onDelete ? (
          <Pressable
            onPress={onDelete}
            style={styles.deleteButton}
            accessibilityRole="button"
            accessibilityLabel="Delete transfer"
          >
            <Trash2 size={16} color={theme.palette.error} />
            <Text style={styles.deleteLabel}>Delete transfer</Text>
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
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    editLabel: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
    required: { fontSize: 12.5, color: palette.error },
    error: { fontSize: 11.5, color: palette.error },
    placeholder: { fontSize: 13, color: palette.muted },

    segment: {
      flexDirection: 'row',
      gap: 3,
      padding: 3,
      borderRadius: 12,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
    segmentItemActive: { backgroundColor: colors.softBg },
    segmentLabel: { fontSize: 13, fontWeight: '600', color: palette.muted },
    segmentLabelActive: { color: colors.primary },

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
