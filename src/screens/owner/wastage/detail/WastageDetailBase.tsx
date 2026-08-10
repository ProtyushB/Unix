import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Info,
  Layers,
  Scale,
  Trash2,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import type { StockUnitLine } from '../../../../backend/modules/shared/inventory.types';
import { POOL_OPTIONS } from '../../../../backend/modules/shared/inventory.types';
import type { WastageDto, WastageReason } from '../../../../backend/modules/shared/wastage.types';
import { WASTAGE_REASON_CHOICES } from '../../../../backend/modules/shared/wastage.types';
import { Badge } from '../../shared/detail/parts/Badge';
import { DetailCard } from '../../shared/detail/parts/DetailCard';
import { DetailField } from '../../shared/detail/parts/DetailField';
import { SegmentedField } from '../../shared/detail/parts/SegmentedField';
import { UnitRowsEditor } from '../../shared/detail/parts/UnitRowsEditor';
import { formatStamp } from '../../inventory/batch.model';
import { poolLabel, reasonLabel } from '../wastage.view';
import type { WastageFormState } from './wastageDetail.model';
import { enteredAsLine, toBatchBreakdown, wastageBaseQty } from './wastageDetail.model';
import {
  appBarSubtitle,
  appBarTitle,
  batchBreakdownCaption,
  deleteCtaLabel,
  isEditable,
  notesLabel,
  notesRequired,
  poolDescription,
  restockSentence,
  saveCtaLabel,
  showsDelete,
  type DetailMode,
} from './wastageDetail.view';

export interface WastageDetailSlots {
  /** The module chip beside the title. Data, not JSX — the row owns its tinting. */
  moduleLabel?: string;
}

interface WastageDetailBaseProps {
  mode: DetailMode;
  item: WastageDto | null;
  form: WastageFormState;
  errors: Record<string, string>;
  slots?: WastageDetailSlots;

  /** How many rungs the chosen product's ladder offers — the Add-unit gate reads this. */
  ladderSize: number;
  /** The product's base unit name ("ml"), for every base-unit label. */
  baseUnit: string;
  /**
   * Stock on hand IN THE CHOSEN POOL, in base units. Null while no product is picked — null is NOT
   * zero. Switching the pool changes this number, so the caller must refetch on that field too.
   */
  availableBaseQty: number | null;
  /** "Available: 6,000 ml across 3 batches · written off oldest-first." Null before a product. */
  availabilityLine?: string | null;
  /**
   * Batch id → printed batch number, so the ledger can name batches instead of numbering them.
   *
   * The server's `deductions` carry ids only. An unresolved id falls back to `Batch #<id>` rather
   * than to a blank — see `toBatchBreakdown`.
   */
  batchNumbers?: Record<number, string>;

  onFieldChange: <K extends keyof WastageFormState>(field: K, value: WastageFormState[K]) => void;
  onPickProduct?: () => void;
  onChangeUnitRows: (rows: StockUnitLine[]) => void;
  onPickRowUnit: (index: number) => void;

  onBack: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  saving?: boolean;
}

/**
 * The wastage detail screen, in whichever mode it was asked for.
 *
 * Two modes, not three: a wastage is **immutable** after creation, so there is no edit. `editable`
 * therefore means "this is the record form", and every field renders read-only in view mode with no
 * way back into an input.
 *
 * The read screen's only write is Delete — which reverses the write-off rather than editing it.
 */
export function WastageDetailBase({
  mode,
  item,
  form,
  errors,
  slots,
  ladderSize,
  baseUnit,
  availableBaseQty,
  availabilityLine,
  batchNumbers,
  onFieldChange,
  onPickProduct,
  onChangeUnitRows,
  onPickRowUnit,
  onBack,
  onSave,
  onDelete,
  saving = false,
}: WastageDetailBaseProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const editable = isEditable(mode);

  // ⚠️ `deductions` with a `qty` per row — NOT a stock transfer's `lines` with a `quantity`. The
  // two blocks look copy-pasteable and a copy renders an empty table with no error at all.
  const ledger = toBatchBreakdown(item?.deductions, baseUnit, batchNumbers);
  const baseQty = wastageBaseQty(item);
  const enteredAs = enteredAsLine(item, baseUnit);

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
            <Text style={editable ? styles.appBarTitleForm : styles.appBarTitleRead}>
              {appBarTitle(mode, form.itemName)}
            </Text>
            {editable && slots?.moduleLabel ? (
              <Badge label={slots.moduleLabel} tone="accent" />
            ) : null}
          </View>
          {appBarSubtitle(mode) ? (
            <Text style={styles.appBarSubtitle}>{appBarSubtitle(mode)}</Text>
          ) : null}
        </View>

        {/* No Save button up here. The form's one CTA sits at the foot of the scroll and is named
            for what it does — two affordances for one action is what the FAB rule on the list
            screen exists to prevent, and the same reasoning applies within a form. */}
        <View style={styles.iconButtonSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── The read screen's hero: what was lost, how much, and when. ── */}
        {!editable ? (
          <View style={styles.hero}>
            <View style={styles.heroTitleRow}>
              <Text style={styles.heroName} numberOfLines={2}>
                {form.itemName || 'Wastage'}
              </Text>
              {item?.reason ? <Badge label={reasonLabel(item.reason)} tone="accent" /> : null}
            </View>
            {item?.reportedAt ? (
              <Text style={styles.heroStamp}>{formatStamp(item.reportedAt)}</Text>
            ) : null}

            <View style={styles.heroQtyRow}>
              <Text style={styles.heroQty}>
                {baseQty === null ? '—' : baseQty.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.heroUnit}>{baseUnit}</Text>
            </View>
            {/* Null when it would only restate the figure above it — see `enteredAsLine`. */}
            {enteredAs ? <Text style={styles.heroEntered}>{enteredAs}</Text> : null}
          </View>
        ) : null}

        <DetailCard title="Item" icon={AlertTriangle} gap={13}>
          <DetailField
            label="Item"
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
            What the chosen pool actually holds, and the one place the screen says the write-off can
            span several batches — which is why there is no batch picker to go looking for.
          */}
          {editable && availabilityLine ? (
            <Text style={styles.helper}>{availabilityLine}</Text>
          ) : null}

          {/*
            Inventory Type. Wastage is the ONLY one of the three features that asks — a consumption
            is always RAW and a transfer has two ends — and there is no safe default: the same
            product can hold stock in both, and writing off the wrong one is a silent loss of real
            stock. It does NOT travel on the payload; it decides which batch does.
          */}
          <SegmentedField
            label="Inventory Type"
            options={POOL_OPTIONS}
            value={form.inventoryType}
            onChange={(next) => onFieldChange('inventoryType', next)}
            editable={editable}
            // The saved record's pool, not the form's — a read screen describes what WAS written
            // off, and the form defaults to PRODUCT regardless of what the record says.
            readValue={poolLabel(item?.inventoryType ?? form.inventoryType)}
            required
            helper={poolDescription(form.inventoryType)}
            error={errors.inventoryType}
          />
        </DetailCard>

        <DetailCard title="Quantity" icon={Scale} gap={13}>
          {editable ? (
            <View style={styles.field}>
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
            <>
              <DetailField
                label="Quantity"
                value={baseQty === null ? '—' : `${baseQty.toLocaleString('en-IN')} ${baseUnit}`}
                editable={false}
              />
              <DetailField
                label="Reported At"
                value={formatStamp(item?.reportedAt) || '—'}
                editable={false}
              />
            </>
          )}
        </DetailCard>

        <DetailCard title="Details" icon={Info} gap={13}>
          {/*
            ⚠️ Chips from `WASTAGE_REASON_CHOICES` — SEVEN, not the eight-member union. CORRECTION
            is how a stock-count adjustment reaches the ledger; offering it here would invite
            someone reconciling a miscount to file it as wastage, and the write-off value would
            absorb an error that was never a loss.

            The read row below goes through `reasonLabel`, which DOES know all eight, so a record
            that already carries CORRECTION still renders its reason instead of a blank.
          */}
          {editable ? (
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.editLabel}>Reason</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <View style={styles.reasonWrap}>
                {WASTAGE_REASON_CHOICES.map((value: WastageReason) => {
                  const active = form.reason === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => onFieldChange('reason', value)}
                      style={[styles.reasonChip, active && styles.reasonChipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.reasonChipText, active && styles.reasonChipTextActive]}>
                        {reasonLabel(value)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {errors.reason ? <Text style={styles.error}>{errors.reason}</Text> : null}
            </View>
          ) : (
            <DetailField label="Reason" value={reasonLabel(item?.reason)} editable={false} />
          )}

          {/*
            The label carries the requirement, so it changes with the reason: "Other" on its own
            records that something was lost and nothing about what, which makes the row
            unauditable. `notesLabel` and the validator both read `notesRequired`, so the asterisk
            and the refusal cannot disagree.
          */}
          <DetailField
            label={notesLabel(form.reason)}
            value={form.notes}
            editable={editable}
            onChange={(text) => onFieldChange('notes', text)}
            placeholder="Anything worth recording"
            required={editable && notesRequired(form.reason)}
            error={errors.notes}
            multiline
            readLayout="block"
          />
        </DetailCard>

        {/*
          The FEFO ledger, view mode only.

          ⚠️ Built by `toBatchBreakdown` off `item.deductions` — rows of `{batchId, qty}`. A stock
          transfer's ledger is `item.lines` with `sourceBatchId` / `destBatchId` / `quantity`. The
          two blocks look copy-pasteable and are not: a copy renders an EMPTY table with no error at
          all, because `record.lines` is undefined here.
        */}
        {!editable && ledger.length ? (
          <DetailCard title="Batch breakdown" icon={Layers} gap={10}>
            <Text style={styles.helper}>{batchBreakdownCaption(ledger.length)}</Text>
            {ledger.map((row) => (
              <View key={row.batchId} style={styles.ledgerRow}>
                <Text style={styles.ledgerBatch} numberOfLines={1}>
                  {row.batchLabel}
                </Text>
                <Text style={styles.ledgerQty}>{row.qtyText}</Text>
              </View>
            ))}
          </DetailCard>
        ) : null}

        {/* The form's one CTA, named for what it does rather than "Save". */}
        {editable && onSave ? (
          <Pressable
            onPress={onSave}
            disabled={saving}
            style={[styles.saveButton, saving && styles.saveButtonBusy]}
            accessibilityRole="button"
            accessibilityLabel={saveCtaLabel()}
          >
            <Check size={16} color={theme.colors.onAccent ?? '#FFFFFF'} />
            <Text style={styles.saveLabel}>{saveCtaLabel()}</Text>
          </Pressable>
        ) : null}

        {showsDelete(mode) && onDelete ? (
          <View style={styles.deleteBlock}>
            <Pressable
              onPress={onDelete}
              style={styles.deleteButton}
              accessibilityRole="button"
              accessibilityLabel={deleteCtaLabel()}
            >
              <Trash2 size={16} color={theme.palette.error} />
              <Text style={styles.deleteLabel}>{deleteCtaLabel()}</Text>
            </Pressable>
            {/* Built from the same ledger the table above draws, so the promise and the table can
                never disagree. Empty when the record carries no ledger to promise anything from. */}
            {restockSentence(ledger) ? (
              <Text style={styles.deleteNote}>{restockSentence(ledger)}</Text>
            ) : null}
          </View>
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
    appBarSubtitle: { fontSize: 12, color: palette.muted },

    // ── Read hero ──
    hero: { gap: 6, paddingHorizontal: 2 },
    heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heroName: { flex: 1, fontSize: 19, fontWeight: '800', color: palette.onBackground },
    heroStamp: { fontSize: 12, color: palette.muted },
    // Baseline-aligned so the unit sits on the numeral's foot rather than floating beside it.
    heroQtyRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
    heroQty: { fontSize: 34, fontWeight: '800', color: palette.onBackground },
    heroUnit: { fontSize: 15, fontWeight: '600', color: palette.muted },
    heroEntered: { fontSize: 12.5, color: palette.muted },

    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    saveButtonBusy: { opacity: 0.6 },
    saveLabel: { fontSize: 14.5, fontWeight: '700', color: colors.onAccent ?? '#FFFFFF' },

    // ── Reason chips ──
    reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    reasonChip: {
      paddingVertical: 7,
      paddingHorizontal: 13,
      borderRadius: 999,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    reasonChipActive: { backgroundColor: colors.softBg, borderColor: colors.primary },
    reasonChipText: { fontSize: 13, fontWeight: '600', color: palette.muted },
    reasonChipTextActive: { color: colors.primary },

    // ── Batch breakdown ──
    ledgerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    ledgerBatch: { flex: 1, fontSize: 13, color: palette.onSurface },
    ledgerQty: { fontSize: 13, fontWeight: '700', color: palette.onSurface },

    content: { padding: 16, gap: 14 },
    field: { gap: 7 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    editLabel: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
    required: { fontSize: 12.5, color: palette.error },
    helper: { fontSize: 11.5, color: palette.muted },
    error: { fontSize: 11.5, color: palette.error },
    placeholder: { fontSize: 13, color: palette.muted },

    // The Inventory Type control's own styles moved to `SegmentedField` with the component.

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

    deleteBlock: { gap: 8 },
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
    deleteNote: { fontSize: 11.5, color: palette.muted, textAlign: 'center', lineHeight: 17 },
  });
}
