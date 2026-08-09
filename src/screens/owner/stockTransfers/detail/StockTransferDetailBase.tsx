import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  Package,
  Trash2,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import type {
  InventoryType,
  StockUnitLine,
} from '../../../../backend/modules/shared/inventory.types';
import { POOL_OPTIONS } from '../../../../backend/modules/shared/inventory.types';
import type {
  StockTransferDto,
  StockTransferReason,
} from '../../../../backend/modules/shared/stockTransfer.types';
import { STOCK_TRANSFER_REASONS } from '../../../../backend/modules/shared/stockTransfer.types';
import { Badge } from '../../shared/detail/parts/Badge';
import { DetailCard } from '../../shared/detail/parts/DetailCard';
import { DetailField } from '../../shared/detail/parts/DetailField';
import { SegmentedField } from '../../shared/detail/parts/SegmentedField';
import { UnitRowsEditor } from '../../shared/detail/parts/UnitRowsEditor';
import { formatStamp } from '../../inventory/batch.model';
import { recordQtyLabel } from '../../inventory/batchUnits';
import { poolLabel, reasonLabel } from '../stockTransfer.view';
import type { StockTransferFormState } from './stockTransferDetail.model';
import {
  HOP_DEST_LABEL,
  HOP_SOURCE_LABEL,
  hasLedger,
  reversalNote,
  toTransferHops,
} from './stockTransferLedger';
import {
  appBarSubtitle,
  appBarTitle,
  isEditable,
  movedHeadline,
  movingSummary,
  oppositePool,
  reasonHelper,
  showsDelete,
  type DetailMode,
} from './stockTransferDetail.view';

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
  /**
   * "Available: 6,000 ml across 3 batches · drawn FEFO (soonest expiry first)." — already composed
   * by `availabilityHelper`, because it is copy and copy belongs where a test can pin it.
   */
  availabilityText?: string | null;

  onFieldChange: <K extends keyof StockTransferFormState>(
    field: K,
    value: StockTransferFormState[K],
  ) => void;
  /** Sets source, destination AND reason together — see `useStockTransferDetailForm`. */
  onChangeDirection: (source: InventoryType) => void;
  /** Sets the reason, and the pools with it when the reason names a direction. */
  onChangeReason: (reason: StockTransferReason) => void;
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
  availabilityText = null,
  onFieldChange,
  onChangeDirection,
  onChangeReason,
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

  const headline = movedHeadline(item, baseUnit);
  const hops = toTransferHops(item?.lines, baseUnit);
  const reversal = reversalNote(item, baseUnit);

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
          {editable ? <Text style={styles.appBarSubtitle}>{appBarSubtitle(mode)}</Text> : null}
        </View>

        {editable && onSave ? (
          <Pressable
            onPress={onSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Transfer stock"
            style={[styles.saveButton, saving && styles.saveButtonBusy]}
          >
            <Check size={15} color={theme.colors.onAccent ?? '#FFFFFF'} />
            <Text style={styles.saveLabel}>Transfer</Text>
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
            {/*
              ── Direction ────────────────────────────────────────────────────
              Two selectors that MIRROR each other, not two independent pickers. Picking either end
              flips the other, because a transfer is always cross-pool — and both go through the
              same `onChangeDirection(source)`, which sets source, destination AND reason together.
              Letting the three be set independently is exactly what produces a record whose reason
              contradicts its pools, which the server accepts and nothing later can detect.

              The `→` below is a direction arrow, NOT a quantity separator — the `·` convention
              applies to quantity expressions only.
            */}
            <DetailCard title="Direction" icon={ArrowLeftRight} gap={13}>
              <PoolSelector
                label="Source pool"
                value={form.sourceType}
                onChange={onChangeDirection}
              />
              <PoolSelector
                label="Destination pool"
                value={form.destType}
                // The mirror: choosing a destination is choosing the other pool as the source.
                onChange={(dest) => onChangeDirection(oppositePool(dest))}
              />
              <View style={styles.movingRow}>
                <Text style={styles.movingLabel}>Moving</Text>
                <Text style={styles.movingValue}>
                  {movingSummary(form.sourceType, form.destType)}
                </Text>
              </View>
              {errors.sourceType ? <Text style={styles.error}>{errors.sourceType}</Text> : null}
            </DetailCard>

            {/* ── Item ──────────────────────────────────────────────────────── */}
            <DetailCard title="Item" icon={Package} gap={11}>
              {/* The picker is a Modal owned by the route screen — this only asks for it. */}
              <Pressable
                onPress={onPickProduct}
                style={[styles.picker, !!errors.itemId && styles.pickerError]}
                accessibilityRole="button"
                accessibilityLabel={form.itemName || 'Select product'}
              >
                <Text
                  style={[styles.pickerValue, !form.itemName && styles.pickerPlaceholder]}
                  numberOfLines={1}
                >
                  {form.itemName || 'Select product'}
                </Text>
                <ChevronRight size={16} color={theme.palette.muted} />
              </Pressable>
              {errors.itemId ? <Text style={styles.error}>{errors.itemId}</Text> : null}
              {/*
                What there is to move, and how it will be drawn. There is no batch picker on this
                form and there is not going to be one — the server chooses source batches
                soonest-expiry-first — so this sentence is the only place the user is told which
                stock actually leaves. Composed by `availabilityHelper`, where a test can pin it.
              */}
              {availabilityText ? <Text style={styles.helper}>{availabilityText}</Text> : null}
            </DetailCard>

            {/* ── Quantity ──────────────────────────────────────────────────── */}
            <DetailCard title="Quantity" icon={Layers} gap={11}>
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
            </DetailCard>

            {/* ── Details ───────────────────────────────────────────────────── */}
            <DetailCard title="Details" icon={Info} gap={13}>
              <View style={styles.field}>
                <Text style={styles.editLabel}>Reason</Text>
                {/*
                  ⚠️ The two DIRECTIONAL reasons move the pools with them — see `reasonSelection`.
                  Offering all five while letting the reason be set independently of the direction is
                  what produces `reason: PRODUCT_TO_RAW` alongside `sourceType: RAW_INVENTORY`: the
                  server accepts that pairing, and the lie survives in the audit log forever.
                */}
                <View style={styles.chipWrap}>
                  {STOCK_TRANSFER_REASONS.map((reason) => {
                    const active = form.reason === reason;
                    return (
                      <Pressable
                        key={reason}
                        onPress={() => onChangeReason(reason)}
                        style={[styles.chip, active && styles.chipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={reasonLabel(reason)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {reasonLabel(reason)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.helper}>{reasonHelper()}</Text>
                {errors.reason ? <Text style={styles.error}>{errors.reason}</Text> : null}
              </View>

              {/*
                No "when" input. `transferredAt` is left EMPTY so the SERVER stamps it, which is what
                an empty field means on the wire — a form pre-filled with a clock that keeps ticking
                would be stale by the time it was submitted. The read screen shows what was stamped.
              */}
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

            {/*
              The primary CTA, repeated at the foot of the form. The app bar's "Transfer" is only
              reachable with the keyboard down; this one sits where the user's eye finishes.
            */}
            {onSave ? (
              <Pressable
                onPress={onSave}
                disabled={saving}
                style={[styles.ctaButton, saving && styles.ctaButtonBusy]}
                accessibilityRole="button"
                accessibilityLabel="Transfer stock"
              >
                <ArrowLeftRight size={16} color={theme.colors.onAccent ?? '#FFFFFF'} />
                <Text style={styles.ctaLabel}>Transfer stock</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            {/* ── The move, at a glance ─────────────────────────────────────── */}
            <DetailCard title="Transfer" icon={ArrowLeftRight} gap={14}>
              <Text style={styles.stamp}>
                {`Transfer · ${formatStamp(item?.transferredAt) || '—'}`}
              </Text>

              {/*
                ⚠️ The pair is drawn from `sourceType` / `destType`, never from `reason`. A record can
                carry `reason: PRODUCT_TO_RAW` with `sourceType: RAW_INVENTORY`; the pools are the
                truth and the reason is a label on top of them.
              */}
              <View style={styles.poolPair}>
                <View style={styles.poolTile}>
                  <Text style={styles.poolTileCap}>From</Text>
                  <Text style={styles.poolTileName}>{poolLabel(item?.sourceType)}</Text>
                </View>
                <ArrowRight size={18} color={theme.colors.primary} />
                <View style={styles.poolTile}>
                  <Text style={styles.poolTileCap}>To</Text>
                  <Text style={styles.poolTileName}>{poolLabel(item?.destType)}</Text>
                </View>
              </View>

              <View style={styles.bigRow}>
                <Text style={styles.bigNumber}>{headline.amount}</Text>
                <Text style={styles.bigUnit}>{headline.unitText}</Text>
              </View>
            </DetailCard>

            {/* ── What was entered ──────────────────────────────────────────── */}
            <DetailCard title="Details" icon={Info}>
              <DetailField label="Item" value={item?.itemName ?? form.itemName} editable={false} />
              <DetailField label="Source" value={poolLabel(item?.sourceType)} editable={false} />
              <DetailField label="Destination" value={poolLabel(item?.destType)} editable={false} />
              <DetailField
                label="Quantity"
                value={recordQtyLabel(
                  {
                    quantity: item?.quantity,
                    unitName: item?.unitName,
                    unitLines: item?.unitLines,
                  },
                  baseUnit,
                )}
                editable={false}
              />
              <DetailField label="Reason" value={reasonLabel(item?.reason)} editable={false} />
              <DetailField
                label="Transferred At"
                value={formatStamp(item?.transferredAt)}
                editable={false}
              />
              <DetailField
                label="Notes"
                value={(item?.notes as string) ?? form.notes}
                editable={false}
                readLayout="block"
              />
            </DetailCard>

            {/*
              ── Batch breakdown ───────────────────────────────────────────────

              ⚠️ THIS ONE IS `item.lines`, NOT `item.deductions`, and each row is
              `{sourceBatchId, destBatchId, quantity}` — NOT `{batchId, qty}`. Consumption and
              wastage use the other name and the other amount key. In Centrix both blocks name the
              local `lines` and map it the same way, so they look copy-pasteable; a copy renders an
              EMPTY table with no error at all, or fills every amount cell with `undefined`. Every
              string below comes from `toTransferHops`, which reads the right ones and is tested.
            */}
            <DetailCard title="Batch breakdown" icon={Layers} gap={12}>
              {hasLedger(item) ? (
                hops.map((hop) => (
                  <View key={hop.key} style={styles.hop}>
                    <View style={styles.hopLine}>
                      <Text style={styles.hopCap}>{HOP_SOURCE_LABEL}</Text>
                      <Text style={styles.hopValue}>{`${hop.qtyText} · ${hop.sourceBatch}`}</Text>
                    </View>
                    <View style={styles.hopLine}>
                      <Text style={styles.hopCap}>{HOP_DEST_LABEL}</Text>
                      <View style={styles.hopValueRow}>
                        <Text style={styles.hopValue}>{hop.destBatch}</Text>
                        {hop.destIsNew ? <Badge label="New" tone="success" /> : null}
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                // A list row carries no ledger — only the GET-one read is enriched. Saying so beats
                // an empty card that reads as "this transfer moved nothing".
                <Text style={styles.placeholder}>No batch detail on this record.</Text>
              )}
            </DetailCard>
          </>
        )}

        {showsDelete(mode) && onDelete ? (
          <View style={styles.deleteBlock}>
            <Pressable
              onPress={onDelete}
              style={styles.deleteButton}
              accessibilityRole="button"
              accessibilityLabel="Delete and reverse this transfer"
            >
              <Trash2 size={16} color={theme.palette.error} />
              <Text style={styles.deleteLabel}>Delete &amp; reverse</Text>
            </Pressable>
            {/*
              "Delete" alone does not describe what this does. The sentence names the quantity and
              the batch it goes back to, because this is the one control on the screen that moves
              stock. Null when there is no ledger to back the promise — see `reversalNote`.
            */}
            {reversal ? <Text style={styles.deleteNote}>{reversal}</Text> : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * One end of the move: Product or Raw.
 *
 * Two of these are rendered and they MIRROR each other — the caller flips the pair, this only
 * reports a tap. Kept as a component rather than a loop so the two labels ("Source pool" /
 * "Destination pool") sit beside their own control rather than in an array the reader has to
 * unpick.
 */
function PoolSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: InventoryType;
  onChange: (pool: InventoryType) => void;
}) {
  // Kept as a named wrapper rather than inlining `SegmentedField` at both call sites: the two
  // controls mirror each other and reading `<PoolSelector label="Source pool" …>` twice says that
  // more plainly than two identical eight-prop elements would.
  return (
    <SegmentedField
      label={label}
      options={POOL_OPTIONS}
      value={value}
      onChange={onChange}
      required
    />
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

    appBarSubtitle: { fontSize: 12, color: palette.muted },

    content: { padding: 16, gap: 14 },
    field: { gap: 7 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    editLabel: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
    required: { fontSize: 12.5, color: palette.error },
    error: { fontSize: 11.5, color: palette.error },
    helper: { fontSize: 11.5, color: palette.muted, lineHeight: 16 },
    placeholder: { fontSize: 13, color: palette.muted },

    // The Product/Raw control's own styles moved to `SegmentedField` with the component.

    // The summary under the two selectors. Tinted rather than muted: it is the one line that says
    // what the pair adds up to, and it changes under the user's finger.
    movingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    movingLabel: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
    movingValue: { fontSize: 13.5, fontWeight: '700', color: colors.primary },

    picker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 44,
      paddingHorizontal: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.surfaceElevated,
    },
    pickerError: { borderColor: palette.error },
    pickerValue: { flex: 1, fontSize: 14, fontWeight: '500', color: palette.onSurface },
    pickerPlaceholder: { fontWeight: '400', color: palette.muted },

    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingVertical: 7,
      paddingHorizontal: 13,
      borderRadius: 999,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    chipActive: { backgroundColor: colors.softBg, borderColor: colors.primary },
    chipText: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
    chipTextActive: { color: colors.primary },

    ctaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 50,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    ctaButtonBusy: { opacity: 0.6 },
    ctaLabel: { fontSize: 15, fontWeight: '700', color: colors.onAccent ?? '#FFFFFF' },

    // ── Read view ────────────────────────────────────────────────────────────
    stamp: { fontSize: 12.5, color: palette.muted },
    poolPair: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    poolTile: {
      flex: 1,
      gap: 2,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    poolTileCap: { fontSize: 10.5, fontWeight: '700', color: palette.muted, letterSpacing: 0.4 },
    poolTileName: { fontSize: 14.5, fontWeight: '700', color: palette.onSurface },

    // The figure is the signal, so it is drawn three times the size of its unit — which is why
    // `movedHeadline` hands back the two halves separately rather than one string.
    bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    bigNumber: { fontSize: 34, fontWeight: '800', color: colors.primary },
    bigUnit: { fontSize: 13, color: palette.muted },

    hop: { gap: 4 },
    hopLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    hopCap: { fontSize: 12, color: palette.muted },
    hopValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    hopValue: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: palette.onSurface },

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
