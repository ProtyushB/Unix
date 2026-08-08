import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Beaker,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Scale,
  Trash2,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import {
  CONSUMPTION_REASONS,
  type ConsumptionDto,
} from '../../../../backend/modules/shared/consumption.types';
import type { StockUnitLine } from '../../../../backend/modules/shared/inventory.types';
import { Badge } from '../../shared/detail/parts/Badge';
import { DateField } from '../../shared/detail/parts/DateField';
import { DetailCard } from '../../shared/detail/parts/DetailCard';
import { DetailField } from '../../shared/detail/parts/DetailField';
import { UnitRowsEditor } from '../../shared/detail/parts/UnitRowsEditor';
import { formatStamp } from '../../inventory/batch.model';
import { isMixedUnitLines, recordQtyLabel, type SaleUnit } from '../../inventory/batchUnits';
import { batchText, formatShortStamp, recordQtyParts } from '../consumption.model';
import { reasonLabel, reasonTone, type ReasonTone } from '../consumption.view';
import { formatClock, splitConsumedAt, type ConsumptionFormState } from './consumptionDetail.model';
import {
  appBarSubtitle,
  appBarTitle,
  deleteWarning,
  enteredAsLine,
  fefoHelperLine,
  isEditable,
  rawStockValue,
  showsDelete,
  type DetailMode,
} from './consumptionDetail.view';

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

  /**
   * The chosen product's ladder. Its LENGTH gates "Add unit" — a base-unit product has one rung, so
   * the button could only ever duplicate the row already there.
   *
   * The rungs themselves rather than a count, so the row the button creates is seeded from a real
   * rung instead of from `{unit: '', perStock: 1}`.
   */
  ladder: SaleUnit[];
  /** The product's base unit name ("g"), for every base-unit label. */
  baseUnit: string;
  /** RAW stock on hand, in base units. Null while no product is picked — null is NOT zero. */
  availableBaseQty: number | null;
  /** How many ACTIVE raw batches FEFO will draw from. Null while unknown — again, not zero. */
  activeBatchCount: number | null;

  onFieldChange: <K extends keyof ConsumptionFormState>(
    field: K,
    value: ConsumptionFormState[K],
  ) => void;
  onPickProduct?: () => void;
  onChangeUnitRows: (rows: StockUnitLine[]) => void;
  onAddUnitRow: () => void;
  onPickRowUnit: (index: number) => void;
  /** Writes the DATE half of `consumedAt`, seeding a clock if there is not one yet. */
  onChangeConsumedDate: (ymd: string) => void;
  /** Opens the caller's slot list. The sheet itself is the route screen's, not ours. */
  onPickConsumedTime: () => void;

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
 *
 * Every string with a decision behind it comes from `consumptionDetail.view.ts` or
 * `consumption.model.ts`. This file is JSX: `jest.config.js` collects `src/**\/*.test.ts` only, so a
 * rule written in here could not be tested at all.
 */
export function ConsumptionDetailBase({
  mode,
  item,
  form,
  errors,
  slots,
  ladder,
  baseUnit,
  availableBaseQty,
  activeBatchCount,
  onFieldChange,
  onPickProduct,
  onChangeUnitRows,
  onAddUnitRow,
  onPickRowUnit,
  onChangeConsumedDate,
  onPickConsumedTime,
  onBack,
  onSave,
  onDelete,
  saving = false,
}: ConsumptionDetailBaseProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const editable = isEditable(mode);

  const when = splitConsumedAt(form.consumedAt);
  const subtitle = appBarSubtitle(mode);

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
          {subtitle ? <Text style={styles.appBarSubtitle}>{subtitle}</Text> : null}
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
        {editable ? (
          <RecordForm
            form={form}
            errors={errors}
            styles={styles}
            theme={theme}
            ladder={ladder}
            baseUnit={baseUnit}
            availableBaseQty={availableBaseQty}
            activeBatchCount={activeBatchCount}
            when={when}
            onFieldChange={onFieldChange}
            onPickProduct={onPickProduct}
            onChangeUnitRows={onChangeUnitRows}
            onAddUnitRow={onAddUnitRow}
            onPickRowUnit={onPickRowUnit}
            onChangeConsumedDate={onChangeConsumedDate}
            onPickConsumedTime={onPickConsumedTime}
            onSave={onSave}
            saving={saving}
          />
        ) : (
          <ReadView item={item} form={form} styles={styles} theme={theme} baseUnit={baseUnit} />
        )}

        {showsDelete(mode) && onDelete ? (
          <View style={styles.deleteBlock}>
            <Pressable
              onPress={onDelete}
              style={styles.deleteButton}
              accessibilityRole="button"
              accessibilityLabel="Delete consumption and restock"
            >
              <Trash2 size={16} color={theme.palette.error} />
              <Text style={styles.deleteLabel}>Delete &amp; restock</Text>
            </Pressable>
            <Text style={styles.deleteNote}>
              {/* Names the amount in the units it was RECORDED in, which is what goes back. */}
              {deleteWarning({
                baseQty: recordQtyParts(item, baseUnit).value,
                baseUnit: recordQtyParts(item, baseUnit).unit,
                batchText: batchText(item),
              })}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type Styles = ReturnType<typeof createStyles>;

// ─── Record form ─────────────────────────────────────────────────────────────

/**
 * Item, Quantity, Details — the board's three sections, in its order.
 *
 * Split out of the parent rather than inlined behind a ternary so the read view beside it stays
 * readable; both branches are long and they share no markup at all.
 */
function RecordForm({
  form,
  errors,
  styles,
  theme,
  ladder,
  baseUnit,
  availableBaseQty,
  activeBatchCount,
  when,
  onFieldChange,
  onPickProduct,
  onChangeUnitRows,
  onAddUnitRow,
  onPickRowUnit,
  onChangeConsumedDate,
  onPickConsumedTime,
  onSave,
  saving,
}: {
  form: ConsumptionFormState;
  errors: Record<string, string>;
  styles: Styles;
  theme: AppTheme;
  ladder: SaleUnit[];
  baseUnit: string;
  availableBaseQty: number | null;
  activeBatchCount: number | null;
  when: { date: string; time: string };
  onFieldChange: ConsumptionDetailBaseProps['onFieldChange'];
  onPickProduct?: () => void;
  onChangeUnitRows: (rows: StockUnitLine[]) => void;
  onAddUnitRow: () => void;
  onPickRowUnit: (index: number) => void;
  onChangeConsumedDate: (ymd: string) => void;
  onPickConsumedTime: () => void;
  onSave?: () => void;
  saving: boolean;
}) {
  return (
    <>
      {/*
        ⚠️ NOT a `DetailField`. That component renders `required` and `error` only from its
        EDITABLE branch — a read-mode field drops both silently — and this control has to be read
        mode, because its value is written by a picker rather than typed. Wired as a `DetailField`
        it swallowed `errors.itemId`, which is the FIRST error the validator reports and the one
        the whole form depends on. One tappable row instead: label, value, and the error under it.
      */}
      <DetailCard title="Item" icon={Beaker} gap={13}>
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.editLabel}>Product</Text>
            <Text style={styles.required}>*</Text>
          </View>
          {/* The picker is a Modal owned by the route screen — this only asks for it. */}
          <Pressable
            onPress={onPickProduct}
            disabled={!onPickProduct}
            style={[styles.productButton, !!errors.itemId && styles.productButtonError]}
            accessibilityRole="button"
            accessibilityLabel={
              form.itemId == null ? 'Select product' : `Product, ${form.itemName}. Change product`
            }
          >
            <Text
              style={[styles.productValue, form.itemId == null && styles.productPlaceholder]}
              numberOfLines={1}
            >
              {form.itemName || 'Select product'}
            </Text>
            <ChevronRight size={16} color={theme.palette.muted} />
          </Pressable>
          {errors.itemId ? <Text style={styles.error}>{errors.itemId}</Text> : null}
        </View>

        {/* Not a `DetailField`: this is a fact about the shelf, not a value on the record, and it
            carries a helper line of its own underneath. */}
        <View style={styles.stockRow}>
          <Text style={styles.stockLabel}>Available in RAW stock</Text>
          <Text style={styles.stockValue}>{rawStockValue(availableBaseQty, baseUnit)}</Text>
        </View>
        <Text style={styles.helper}>{fefoHelperLine(activeBatchCount)}</Text>
      </DetailCard>

      <DetailCard title="Quantity" icon={Scale} gap={13}>
        <UnitRowsEditor
          rows={form.unitRows}
          ladderSize={ladder.length}
          availableBaseQty={availableBaseQty}
          baseUnit={baseUnit}
          onChangeQty={(index, qty) =>
            onChangeUnitRows(
              form.unitRows.map((r, i) => (i === index ? { ...r, qty: Number(qty) || 0 } : r)),
            )
          }
          onPickUnit={onPickRowUnit}
          onAddRow={onAddUnitRow}
          onRemoveRow={(index) => onChangeUnitRows(form.unitRows.filter((_, i) => i !== index))}
        />
        {errors.quantity ? <Text style={styles.error}>{errors.quantity}</Text> : null}

        {/* Read-only, and there is no picker behind it: the server chooses the batches, FEFO, and
            the payload carries no `batchId` at all. Saying so beats leaving the user to wonder
            which batch they just drew from. */}
        <DetailField label="Batch" value="Auto (FEFO)" editable={false} />
      </DetailCard>

      <DetailCard title="Details" icon={FileText} gap={13}>
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.editLabel}>Reason</Text>
            <Text style={styles.required}>*</Text>
          </View>
          <View style={styles.reasonWrap}>
            {CONSUMPTION_REASONS.map((r) => {
              const active = form.reason === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => onFieldChange('reason', r)}
                  style={[styles.reasonChip, active && styles.reasonChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.reasonChipText, active && styles.reasonChipTextActive]}>
                    {reasonLabel(r)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors.reason ? <Text style={styles.error}>{errors.reason}</Text> : null}
        </View>

        {/*
          A `YYYY-MM-DD` DateField beside a slot list, NOT a datetime component. `DateField` already
          owns the local-calendar contract that keeps an IST user off yesterday's date, and the
          clock is a list for the reason the appointment screen documents: a platform time picker
          hands back a `Date` in the DEVICE's zone, which is the conversion this field exists to
          avoid.
        */}
        <View style={styles.whenRow}>
          <View style={styles.whenDate}>
            <DateField
              label="Consumed At"
              value={when.date}
              editable
              required
              onChange={onChangeConsumedDate}
              error={errors.consumedAt}
            />
          </View>
          <View style={styles.whenTime}>
            <Text style={styles.editLabel}>Time</Text>
            <Pressable
              onPress={onPickConsumedTime}
              style={styles.timeButton}
              accessibilityRole="button"
              accessibilityLabel={`Time${when.time ? `, ${formatClock(when.time)}` : ', not set'}`}
            >
              <Text style={[styles.timeText, !when.time && styles.timePlaceholder]}>
                {formatClock(when.time) || 'Pick a time'}
              </Text>
              <Clock size={16} color={theme.palette.muted} />
            </Pressable>
          </View>
        </View>

        <DetailField
          label="Notes"
          value={form.notes}
          editable
          onChange={(text) => onFieldChange('notes', text)}
          placeholder="Anything worth recording"
          multiline
          readLayout="block"
        />
      </DetailCard>

      {/* The board's bottom CTA. The app-bar Save is the one a thumb reaches on a short form; this
          is the one it reaches after scrolling a long one. Both call the same thing. */}
      {onSave ? (
        <Pressable
          onPress={onSave}
          disabled={saving}
          style={[styles.cta, saving && styles.ctaBusy]}
          accessibilityRole="button"
          accessibilityLabel="Record consumption"
        >
          <Text style={styles.ctaLabel}>Record consumption</Text>
        </Pressable>
      ) : null}
    </>
  );
}

// ─── Read view ───────────────────────────────────────────────────────────────

function toneColor(theme: AppTheme, tone: ReasonTone): string {
  if (tone === 'accent') return theme.colors.primary;
  if (tone === 'info') return theme.palette.info;
  return theme.palette.muted;
}

/**
 * The saved record: what was used, how much, and out of what.
 *
 * ⚠️ There is NO batch-breakdown table here, and its absence is a decision rather than an omission.
 * A consumption's ledger is `deductions: {batchId, qty}[]`; a stock transfer's is
 * `lines: {sourceBatchId, destBatchId, quantity}[]`. The two blocks look copy-pasteable and are not
 * — a copy renders an EMPTY table with no error at all, because `record.lines` is undefined here.
 * One sentence, built by `enteredAsLine`, cannot fail that way.
 *
 * There is also no Appointment row: a consumption is not tied to one, and the payload carries no
 * `appointmentId` to put in it.
 */
function ReadView({
  item,
  form,
  styles,
  theme,
  baseUnit,
}: {
  item: ConsumptionDto | null;
  form: ConsumptionFormState;
  styles: Styles;
  theme: AppTheme;
  baseUnit: string;
}) {
  const tint = toneColor(theme, reasonTone(item?.reason));
  const qty = recordQtyParts(item, baseUnit);
  const qtyText = recordQtyLabel(
    { quantity: item?.quantity, unitName: item?.unitName, unitLines: item?.unitLines },
    baseUnit,
  );

  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroName} numberOfLines={2}>
            {form.itemName || 'Consumption'}
          </Text>
          <View style={[styles.heroChip, { backgroundColor: tint + '22' }]}>
            <Text style={[styles.heroChipText, { color: tint }]}>{reasonLabel(item?.reason)}</Text>
          </View>
        </View>
        <Text style={styles.heroWhen}>{formatShortStamp(item?.consumedAt)}</Text>

        {/* The figure and its unit are two Texts, not one string: the mockup sets them at different
            sizes, which one string cannot be. */}
        <View style={styles.heroQtyRow}>
          <Text style={styles.heroQty}>{qty.value === null ? '—' : String(qty.value)}</Text>
          {qty.value === null ? null : <Text style={styles.heroQtyUnit}>{qty.unit}</Text>}
        </View>

        <Text style={styles.heroLedger}>
          {enteredAsLine({
            qtyText,
            mixed: isMixedUnitLines(item?.unitLines),
            batchText: batchText(item),
          })}
        </Text>
      </View>

      <DetailCard title="Details" icon={FileText}>
        <DetailField label="Product" value={form.itemName} editable={false} />
        <DetailField label="Batch No." value={batchText(item)} editable={false} />
        <DetailField label="Reason" value={reasonLabel(item?.reason)} editable={false} />
        <DetailField label="Consumed At" value={formatStamp(item?.consumedAt)} editable={false} />
        <DetailField label="Created At" value={formatStamp(item?.createdAt)} editable={false} />
        <DetailField label="Notes" value={form.notes} editable={false} readLayout="block" />
      </DetailCard>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    appBarSubtitle: { fontSize: 11.5, color: palette.muted },

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
    labelRow: { flexDirection: 'row', gap: 3 },
    editLabel: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
    required: { fontSize: 12.5, fontWeight: '700', color: palette.error },
    error: { fontSize: 11.5, color: palette.error },
    helper: { fontSize: 11.5, color: palette.muted, lineHeight: 16 },

    // Same 44/12/divider geometry as `DetailField`'s TextInput, so the picker sits flush with the
    // real inputs below it rather than reading as a different kind of control.
    productButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      height: 44,
      paddingHorizontal: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.surfaceElevated,
    },
    productButtonError: { borderColor: palette.error },
    productValue: { flex: 1, fontSize: 14, color: palette.onSurface },
    productPlaceholder: { color: palette.muted },

    // The stock fact, drawn as a strip rather than a row so it reads as a lookup rather than as
    // another field the user is expected to fill in.
    stockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    stockLabel: { fontSize: 12.5, color: palette.muted },
    stockValue: { fontSize: 14, fontWeight: '700', color: palette.onSurface },

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

    whenRow: { flexDirection: 'row', gap: 10 },
    // 1.4 / 1: a date needs the room, a clock label does not.
    whenDate: { flex: 1.4 },
    whenTime: { flex: 1, gap: 6 },
    // Same 44/12/divider geometry as DateField's own input, so the pair sits flush.
    timeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      height: 44,
      paddingHorizontal: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.surfaceElevated,
    },
    timeText: { flex: 1, fontSize: 14, color: palette.onSurface },
    timePlaceholder: { color: palette.muted },

    cta: {
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    ctaBusy: { opacity: 0.6 },
    ctaLabel: { fontSize: 14.5, fontWeight: '700', color: colors.onAccent ?? '#FFFFFF' },

    // ── Read ──
    hero: {
      gap: 8,
      padding: 16,
      borderRadius: 16,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    heroName: { flex: 1, fontSize: 16, fontWeight: '700', color: palette.onSurface },
    heroChip: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999 },
    heroChipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
    heroWhen: { fontSize: 12, color: palette.muted },
    heroQtyRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
    heroQty: { fontSize: 32, fontWeight: '800', color: palette.onSurface },
    heroQtyUnit: { fontSize: 15, fontWeight: '600', color: palette.muted },
    heroLedger: { fontSize: 12, color: palette.muted, lineHeight: 17 },

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
    deleteNote: { fontSize: 11.5, color: palette.muted, textAlign: 'center', lineHeight: 16 },
  });
}
