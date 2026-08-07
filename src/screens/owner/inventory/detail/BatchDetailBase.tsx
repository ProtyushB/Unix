import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  History,
  Info,
  Lock,
  Package,
  ShieldAlert,
  Trash2,
  Wallet,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import { Badge } from '../../shared/detail/parts/Badge';
import { DateField } from '../../shared/detail/parts/DateField';
import { DetailCard } from '../../shared/detail/parts/DetailCard';
import { DetailField } from '../../shared/detail/parts/DetailField';
import type { InventoryStatus } from '../../../../backend/modules/shared/inventory.types';
import { formatCurrency } from '../../../../utils/formatters';
import { formatBatchDate, formatStamp, type BatchDto } from '../batch.model';
import { statusLabel, transitionLabel } from '../batch.view';
import { daysToExpiry, remainingPercent, remainingRatio, remainingState } from '../batchHealth';
import {
  baseEquivalenceLabel,
  displayLevel,
  formatStockedQty,
  perUnitLabel,
  priceFieldLabel,
  quantityFieldLabel,
  unitHelperLine,
  unitPickerValue,
  showsUnitPicker,
  stockValueAtCost,
  type SaleUnit,
} from '../batchUnits';
import { sourceLabel, type BatchFormState } from './batchDetail.model';
import {
  appBarSubtitle,
  appBarTitle,
  dateBounds,
  isEditable,
  showsDelete,
  typeDescription,
  type DetailMode,
} from './batchDetail.view';

export interface BatchDetailSlots {
  /** The module chip beside "Add Batch". Data, not JSX — the row owns its tinting. */
  moduleLabel?: string;
}

interface BatchDetailBaseProps {
  mode: DetailMode;
  item: BatchDto | null;
  form: BatchFormState;
  errors: Record<string, string>;
  slots?: BatchDetailSlots;
  /** The chosen product's sale-unit ladder, for the Stock-in Unit picker. */
  saleUnits: SaleUnit[];
  /** The product's base unit name ("sachet"), for every base-unit label. */
  baseUnit: string;

  onFieldChange: <K extends keyof BatchFormState>(field: K, value: BatchFormState[K]) => void;
  onPickProduct?: () => void;
  onPickUnit?: () => void;

  /**
   * View mode: the moves this batch may make, from the server.
   *
   * `null` means "still loading" and is meaningfully different from `[]`, which means the server
   * answered and there are genuinely none — the two render different copy. Defaulted rather than
   * optional so `undefined` cannot smuggle in a third, unhandled state.
   */
  transitions?: InventoryStatus[] | null;
  transitionsError?: boolean;
  onRetryTransitions?: () => void;
  onChangeStatus?: (next: InventoryStatus) => void;

  onBack: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  deleteBlockedReason?: string | null;
  saving?: boolean;
}

/**
 * The batch detail screen, in whichever mode it was asked for.
 *
 * Two modes, not three: a batch is **immutable** after creation, so there is no edit. `editable`
 * therefore means "this is the add form", and every field renders read-only in view mode with no
 * way back into an input.
 *
 * The read screen's only writes are the status buttons and Delete — both of which change lifecycle
 * rather than content.
 */
export function BatchDetailBase({
  mode,
  item,
  form,
  errors,
  slots,
  saleUnits,
  baseUnit,
  onFieldChange,
  onPickProduct,
  onPickUnit,
  transitions = null,
  transitionsError = false,
  onRetryTransitions,
  onChangeStatus,
  onBack,
  onSave,
  onDelete,
  deleteBlockedReason = null,
  saving = false,
}: BatchDetailBaseProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const editable = isEditable(mode);

  const batchNumber = String(item?.batchNumber ?? '');
  const status = (item?.status ?? 'ACTIVE') as InventoryStatus;
  const st = theme.status[status] ?? theme.status.FALLBACK;

  const level = editable
    ? form.stockInUnit
      ? { unit: form.stockInUnit, perStock: form.stockInMultiplier }
      : null
    : displayLevel(item ?? {});

  const purchased = Number(item?.purchasedQuantity ?? 0);
  const remaining = Number(item?.remainingQuantity ?? 0);
  const pct = remainingPercent(purchased, remaining);
  const fillTint = {
    healthy: theme.palette.success,
    low: theme.palette.warning,
    critical: theme.palette.error,
    none: theme.palette.muted,
  }[remainingState(purchased, remaining)];

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
              {appBarTitle(mode, batchNumber)}
            </Text>
            {editable && slots?.moduleLabel ? (
              <Badge label={slots.moduleLabel} tone="accent" />
            ) : null}
          </View>
          {editable ? (
            <Text style={styles.appBarSubtitle}>{appBarSubtitle(mode)}</Text>
          ) : (
            <View style={styles.appBarStatusRow}>
              <View style={[styles.pill, { backgroundColor: st.bg, borderColor: st.border }]}>
                <Text style={[styles.pillText, { color: st.text }]}>{statusLabel(status)}</Text>
              </View>
              <Text style={styles.appBarProduct} numberOfLines={1}>
                · {item?.itemName ?? ''}
              </Text>
            </View>
          )}
        </View>

        {editable && onSave ? (
          <Pressable
            onPress={onSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save batch"
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
        {/* ── Stock (view only) ────────────────────────────────────────────── */}
        {!editable ? (
          <DetailCard title="Stock" icon={Boxes} gap={12}>
            <View style={styles.bigRow}>
              <View style={styles.bigLeft}>
                {/* Tinted by health state, like the list row — the figure IS the signal. */}
                <Text style={[styles.bigNumber, { color: fillTint }]}>
                  {formatStockedQty(remaining, level, baseUnit).split(' ')[0]}
                </Text>
                <Text style={styles.bigOf}>
                  / {formatStockedQty(purchased, level, baseUnit)} left
                </Text>
              </View>
              {pct !== null ? (
                <Text style={[styles.bigPct, { color: fillTint }]}>{Math.round(pct)}%</Text>
              ) : null}
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.trackFill,
                  {
                    width: `${Math.round(remainingRatio(purchased, remaining) * 100)}%`,
                    backgroundColor: fillTint,
                  },
                ]}
              />
            </View>
            {level && level.perStock > 1 ? (
              <Text style={styles.equivalence}>
                {remaining} of {purchased} {baseUnit}s remaining · {perUnitLabel(level, baseUnit)}
              </Text>
            ) : null}
          </DetailCard>
        ) : null}

        {/* ── Batch Info ───────────────────────────────────────────────────── */}
        <DetailCard title="Batch Info" icon={editable ? Boxes : Info} gap={editable ? 13 : 12}>
          {editable ? (
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.editLabel}>Inventory Type</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <View style={styles.segment}>
                {(
                  [
                    ['PRODUCT_INVENTORY', 'Product'],
                    ['RAW_INVENTORY', 'Raw'],
                  ] as const
                ).map(([key, label]) => {
                  const active = form.inventoryType === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => onFieldChange('inventoryType', key)}
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
              <Text style={styles.explainer}>{typeDescription(form.inventoryType)}</Text>
            </View>
          ) : null}

          {/*
            Read mode leads with the PRODUCT, add mode with the type — the design's order, and it
            follows the task: composing, the type decides which pool you are stocking into and so
            comes first; reading, the product is what identifies the batch.
          */}
          {!editable ? (
            <>
              <DetailField label="Product" value={item?.itemName ?? ''} editable={false} />
              <DetailField
                label="Inventory Type"
                value={form.inventoryType === 'RAW_INVENTORY' ? 'Raw' : 'Product'}
                editable={false}
              />
            </>
          ) : null}

          {editable ? (
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.editLabel}>Product</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <Pressable
                onPress={onPickProduct}
                style={[styles.picker, !!errors.itemId && styles.pickerError]}
                accessibilityRole="button"
                accessibilityLabel={form.itemName || 'Select product'}
              >
                <View style={styles.pickerThumb}>
                  <Package size={13} color={theme.palette.muted} />
                </View>
                <Text
                  style={[styles.pickerValue, !form.itemName && styles.pickerPlaceholder]}
                  numberOfLines={1}
                >
                  {form.itemName || 'Select product'}
                </Text>
                <ChevronDown size={16} color={theme.palette.muted} />
              </Pressable>
              {errors.itemId ? <Text style={styles.fieldError}>{errors.itemId}</Text> : null}
            </View>
          ) : null}

          <DetailField
            label="Supplier"
            value={editable ? form.supplierName : (item?.supplierName ?? '')}
            editable={editable}
            onChange={(t) => onFieldChange('supplierName', t)}
            placeholder="Supplier name (optional)"
          />

          <DateField
            label={editable ? 'Manufacture Date' : 'Manufactured'}
            value={form.manufactureDate}
            editable={editable}
            onChange={(v) => onFieldChange('manufactureDate', v)}
            error={errors.manufactureDate}
            format={formatBatchDate}
            {...dateBounds('manufactureDate', form)}
          />

          {editable ? (
            <DateField
              label="Expiry Date"
              value={form.expiryDate}
              editable
              onChange={(v) => onFieldChange('expiryDate', v)}
              error={errors.expiryDate}
              format={formatBatchDate}
              {...dateBounds('expiryDate', form)}
            />
          ) : (
            <DetailField
              label="Expires"
              value={expiryValueLabel(item)}
              editable={false}
              tint={expiryTint(item)}
            />
          )}

          <DateField
            label={editable ? 'Received Date' : 'Received'}
            value={form.receivedDate}
            editable={editable}
            onChange={(v) => onFieldChange('receivedDate', v)}
            error={errors.receivedDate}
            format={formatBatchDate}
            {...dateBounds('receivedDate', form)}
          />

          {!editable ? (
            <DetailField label="Batch No." value={batchNumber} editable={false} />
          ) : null}
        </DetailCard>

        {/* ── Stock & Pricing ──────────────────────────────────────────────── */}
        <DetailCard
          title={editable ? 'Stock & Pricing' : 'Pricing'}
          icon={Wallet}
          gap={editable ? 13 : 12}
        >
          {editable ? (
            <>
              {/* Only when the product HAS a ladder to choose from — a lone option is furniture. */}
              {showsUnitPicker(saleUnits) ? (
                <View style={styles.field}>
                  <Text style={styles.editLabel}>Stock-in Unit</Text>
                  <Pressable
                    onPress={onPickUnit}
                    style={styles.picker}
                    accessibilityRole="button"
                    accessibilityLabel={`Stock-in unit, ${form.stockInUnit || 'not set'}`}
                  >
                    <Text style={styles.pickerValue} numberOfLines={1}>
                      {unitPickerValue(level)}
                    </Text>
                    <ChevronDown size={16} color={theme.palette.muted} />
                  </Pressable>
                  {/* The sentence that makes the conversion legible before anything is typed. */}
                  {unitHelperLine(level, baseUnit) ? (
                    <Text style={styles.explainer}>{unitHelperLine(level, baseUnit)}</Text>
                  ) : null}
                </View>
              ) : null}

              <DetailField
                label={quantityFieldLabel('Purchased Quantity', level)}
                value={form.purchasedQuantity}
                editable
                required
                onChange={(t) => onFieldChange('purchasedQuantity', t)}
                keyboardType="number-pad"
                error={errors.purchasedQuantity}
                placeholder="0"
              />
              {baseEquivalenceLabel(form.purchasedQuantity, form.stockInMultiplier) ? (
                <Text style={styles.equivalenceAccent}>
                  {baseEquivalenceLabel(form.purchasedQuantity, form.stockInMultiplier)}
                </Text>
              ) : null}

              <DetailField
                label={quantityFieldLabel('Remaining Quantity', level)}
                value={form.remainingQuantity}
                editable
                onChange={(t) => onFieldChange('remainingQuantity', t)}
                keyboardType="number-pad"
                error={errors.remainingQuantity}
                placeholder={form.purchasedQuantity || '0'}
              />

              <View style={styles.priceRow}>
                <View style={styles.priceCell}>
                  <DetailField
                    label={priceFieldLabel('Cost Price', level)}
                    value={form.costPrice}
                    editable
                    onChange={(t) => onFieldChange('costPrice', t)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
                <View style={styles.priceCell}>
                  <DetailField
                    label={priceFieldLabel('Selling Price', level)}
                    value={form.sellingPrice}
                    editable
                    onChange={(t) => onFieldChange('sellingPrice', t)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
              </View>

              <Text style={styles.note}>
                Batch number is generated automatically. New batches start Active.
              </Text>
            </>
          ) : (
            <>
              <DetailField
                label="Cost Price"
                value={perUnitPrice(item?.costPrice, level, baseUnit)}
                editable={false}
              />
              <DetailField
                label="Selling Price"
                value={perUnitPrice(item?.sellingPrice, level, baseUnit)}
                editable={false}
              />
              <DetailField
                label="Stock value (at cost)"
                value={
                  stockValueAtCost(remaining, item?.costPrice) === null
                    ? ''
                    : formatCurrency(stockValueAtCost(remaining, item?.costPrice) as number)
                }
                editable={false}
              />
            </>
          )}
        </DetailCard>

        {/* ── Status (view only) ───────────────────────────────────────────── */}
        {!editable ? (
          <DetailCard title="Status" icon={CircleCheck} gap={12}>
            <View style={styles.statusCurrent}>
              <Text style={styles.statusCurrentLabel}>Current</Text>
              <View style={[styles.pill, { backgroundColor: st.bg, borderColor: st.border }]}>
                <Text style={[styles.pillText, { color: st.text }]}>{statusLabel(status)}</Text>
              </View>
            </View>

            <Text style={styles.statusHint}>CHANGE STATUS TO</Text>

            {/*
              Driven entirely by the server's `allowedTransitions`. On an error this renders NO
              buttons and offers a retry — a hardcoded matrix would offer moves the PATCH refuses,
              because the server also applies state guards this screen cannot see.
            */}
            {transitionsError ? (
              <View style={styles.statusNotice}>
                <Text style={styles.statusNoticeText}>
                  Couldn’t load the available status changes.
                </Text>
                {onRetryTransitions ? (
                  <Pressable onPress={onRetryTransitions} accessibilityRole="button">
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : transitions === null ? (
              <Text style={styles.statusNoticeText}>Checking allowed transitions…</Text>
            ) : transitions.length === 0 ? (
              <Text style={styles.statusNoticeText}>
                No status change is available for this batch right now.
              </Text>
            ) : (
              <View style={styles.statusButtons}>
                {transitions.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => onChangeStatus?.(s)}
                    style={styles.statusButton}
                    accessibilityRole="button"
                  >
                    {s === 'ON_HOLD' ? (
                      <Lock size={16} color={theme.palette.warning} />
                    ) : (
                      <ShieldAlert size={16} color={theme.colors.primary} />
                    )}
                    <Text style={styles.statusButtonLabel}>{transitionLabel(s)}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.note}>
              Transitions are server-driven. Dispose (expired) and Delete (untouched) don’t apply to
              a batch already in use.
            </Text>
          </DetailCard>
        ) : null}

        {/* ── System Information (view only) ───────────────────────────────── */}
        {!editable ? (
          <DetailCard title="System Information" icon={History} gap={12}>
            <DetailField label="Created" value={formatStamp(item?.createdAt)} editable={false} />
            {/*
              "Last movement" and not "Last updated", which is what this said before the mockup was
              revised. It reads as a rename but it is a claim about the data: batches are IMMUTABLE
              (there is no PUT), so the only things that touch `updatedAt` are stock deductions and
              status changes — movements, both of them. The mockup's wording is the accurate one
              here in a way it would not be on an editable record.
            */}
            <DetailField
              label="Last movement"
              value={formatStamp(item?.updatedAt)}
              editable={false}
            />
            <DetailField label="Source" value={sourceLabel(item?.source)} editable={false} />
          </DetailCard>
        ) : null}

        {/* ── Delete ───────────────────────────────────────────────────────── */}
        {showsDelete(mode) && onDelete ? (
          <Pressable
            onPress={onDelete}
            disabled={!!deleteBlockedReason}
            style={[styles.deleteButton, !!deleteBlockedReason && styles.deleteButtonDisabled]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!deleteBlockedReason }}
            accessibilityLabel="Delete batch"
          >
            <Trash2 size={16} color={theme.palette.error} />
            <Text style={styles.deleteLabel}>Delete batch</Text>
          </Pressable>
        ) : null}
        {/* Rendered rather than hidden: a missing button reads as a missing feature, a disabled one
            with a reason teaches why THIS batch is protected. */}
        {showsDelete(mode) && deleteBlockedReason ? (
          <Text style={styles.deleteReason}>{deleteBlockedReason}</Text>
        ) : null}

        {editable && onSave ? (
          <Pressable
            onPress={onSave}
            disabled={saving}
            style={[styles.saveWide, saving && styles.saveButtonBusy]}
            accessibilityRole="button"
          >
            <Check size={17} color={theme.colors.onAccent ?? '#FFFFFF'} />
            <Text style={styles.saveWideLabel}>Save batch</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** "30 Sep 2026 · 55d" — the countdown only while it is still ahead. */
function expiryValueLabel(item: BatchDto | null): string {
  if (!item?.expiryDate) return '';
  const base = formatBatchDate(item.expiryDate);
  const days = daysToExpiry(item.expiryDate);
  if (days === null || days < 0) return base;
  return `${base} · ${days}d`;
}

function expiryTint(item: BatchDto | null): 'error' | 'warning' | 'primary' {
  if (!item?.expiryDate) return 'primary';
  const days = daysToExpiry(item.expiryDate);
  if (days === null) return 'primary';
  if (days <= 0) return 'error';
  return days <= 30 ? 'warning' : 'primary';
}

/** "₹420.00 / box" — the price the user entered, reconstructed from the per-base one. */
function perUnitPrice(
  perBase: number | null | undefined,
  level: SaleUnit | null,
  baseUnit: string,
): string {
  if (perBase === null || perBase === undefined) return '';
  const mult = level?.perStock ?? 1;
  const unit = level && mult > 1 ? level.unit : baseUnit;
  return `${formatCurrency(Number(perBase) * mult)} / ${unit}`;
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
    appBarCopyCentered: { alignItems: 'center' },
    appBarTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    appBarTitleForm: { fontSize: 17, fontWeight: '800', color: palette.onBackground },
    appBarTitleRead: { fontSize: 15.5, fontWeight: '800', color: palette.onBackground },
    appBarSubtitle: { fontSize: 12, color: palette.muted },
    appBarStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    appBarProduct: { flexShrink: 1, fontSize: 12, color: palette.muted },

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
    saveLabel: { fontSize: 13.5, fontWeight: '700', color: colors.onAccent ?? '#FFFFFF' },

    content: { paddingHorizontal: 16, gap: 12 },

    pill: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1 },
    pillText: { fontSize: 11, fontWeight: '700' },

    // ── Stock card ──
    bigRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    bigLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    bigNumber: { fontSize: 28, fontWeight: '800', color: palette.onSurface },
    bigOf: { fontSize: 13, color: palette.muted },
    bigPct: { fontSize: 15, fontWeight: '700' },
    track: {
      height: 8,
      borderRadius: 4,
      backgroundColor: palette.surfaceElevated,
      overflow: 'hidden',
    },
    trackFill: { height: '100%', borderRadius: 4 },
    equivalence: { fontSize: 12, color: palette.muted },
    // The base-unit conversion is drawn in the ACCENT, not muted — it is the one line telling the
    // user the number they typed means something different once stored.
    equivalenceAccent: { fontSize: 11.5, fontWeight: '600', color: colors.primary },

    // ── Form bits ──
    field: { gap: 6 },
    labelRow: { flexDirection: 'row', gap: 3 },
    editLabel: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
    // Accent, not error-red. The asterisk marks a field as required; it is not an error state, and
    // rendering it red means a pristine form opens looking like it has already failed validation.
    required: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
    explainer: { fontSize: 11.5, color: palette.muted },
    fieldError: { fontSize: 12, color: palette.error },
    note: { fontSize: 11.5, color: palette.muted, lineHeight: 16 },

    segment: {
      flexDirection: 'row',
      gap: 6,
      padding: 3,
      borderRadius: 12,
      backgroundColor: palette.surfaceElevated,
    },
    segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
    segmentItemActive: { backgroundColor: colors.softBg },
    segmentLabel: { fontSize: 13, fontWeight: '600', color: palette.muted },
    segmentLabelActive: { color: colors.primary },

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
    pickerThumb: {
      width: 24,
      height: 24,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
    },
    pickerValue: { flex: 1, fontSize: 14, color: palette.onSurface },
    pickerPlaceholder: { color: palette.muted },

    priceRow: { flexDirection: 'row', gap: 10 },
    priceCell: { flex: 1 },

    // ── Status card ──
    statusCurrent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statusCurrentLabel: { fontSize: 13, color: palette.muted },
    statusHint: { fontSize: 11, fontWeight: '700', color: palette.muted, letterSpacing: 0.4 },
    statusButtons: { flexDirection: 'row', gap: 10 },
    statusButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 10,
      borderRadius: 11,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    statusButtonLabel: { fontSize: 13, fontWeight: '600', color: palette.onSurface },
    statusNotice: { gap: 8 },
    statusNoticeText: { fontSize: 12.5, color: palette.muted },
    retryText: { fontSize: 13, fontWeight: '600', color: colors.primary },

    // ── Delete / save ──
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: palette.error + '14',
      borderWidth: 1,
      borderColor: palette.error + '40',
    },
    deleteButtonDisabled: { opacity: 0.45 },
    deleteLabel: { fontSize: 14, fontWeight: '700', color: palette.error },
    deleteReason: { fontSize: 11.5, color: palette.muted, textAlign: 'center', lineHeight: 16 },

    saveWide: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    saveWideLabel: { fontSize: 15, fontWeight: '700', color: colors.onAccent ?? '#FFFFFF' },
  });
}
