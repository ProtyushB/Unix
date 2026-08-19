import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  ChevronLeft,
  FileText,
  History,
  Image as ImageIcon,
  Minus,
  Package,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  User,
  X,
} from 'lucide-react-native';
import { useIsTabEnabled } from '../../../../backend/tab-config';
import { customerPickable, showsCustomerCard } from '../../shared/detail/customerGate';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import { DetailCard } from '../../shared/detail/parts/DetailCard';
import { DetailField } from '../../shared/detail/parts/DetailField';
import { Badge, type BadgeTone } from '../../shared/detail/parts/Badge';
import {
  billLine,
  formatAmount,
  formatOrderDate,
  formatOrderStamp,
  initialsOf,
  itemCountLabel,
  itemStatusLabel,
  orderTotal,
  statusLabel,
  type OrderDetailItem,
  type OrderFormState,
} from './orderDetail.model';
import {
  appBarSubtitle,
  appBarTitle,
  isEditable,
  saveLabel,
  showsDelete,
  showsEditCta,
  type DetailMode,
} from './orderDetail.view';
import {
  canMarkDelivered,
  displayUnitLines,
  lineTotal,
  unitSummary,
  type OrderLine,
  type SaleUnit,
} from './orderLineUnits';

/** Module-level so the default prop is a stable reference and cannot re-render every row. */
const EMPTY_IDS: number[] = [];

/**
 * What a line needs from the catalog in order to render.
 *
 * Resolved by the screen, not fetched here: a saved line carries `productSnapshot`, which survives
 * the product being deleted, so the snapshot is the source of truth and the live catalog row is
 * only consulted for the sale-unit ladder the user can switch between.
 */
export interface LineDisplay {
  name: string;
  brand: string;
  units: SaleUnit[];
}

export interface OrderDetailSlots {
  /** The module chip beside "New Order" in add mode. Data, not JSX — the row owns its tinting. */
  moduleLabel?: string;
}

interface OrderDetailBaseProps {
  mode: DetailMode;
  item: OrderDetailItem | null;
  form: OrderFormState;
  errors: Record<string, string>;
  passthrough: Record<string, unknown>[];
  slots?: OrderDetailSlots;
  /** Per-line display data, keyed by productId. Missing entries fall back to the line's snapshot. */
  display: Record<number, LineDisplay>;

  onFieldChange: (field: 'orderStatus' | 'notes', value: string) => void;
  onPickCustomer?: () => void;
  onAddItem?: () => void;
  onRemoveLine?: (index: number) => void;
  onUnitQty?: (lineIndex: number, unitIndex: number, qty: number) => void;
  onRemoveUnit?: (lineIndex: number, unitIndex: number) => void;
  onAddUnit?: (lineIndex: number) => void;
  onPickStatus?: () => void;
  /** View mode only. Flips one line to DELIVERED and re-saves — see `markItemDelivered`. */
  onMarkDelivered?: (productId: number) => void;
  /** productIds with a delivery in flight, so the row that was tapped is the row that spins. */
  deliveringIds?: number[];

  onBack: () => void;
  onEdit?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  saving?: boolean;
}

/**
 * The order detail screen, in whichever mode it was asked for.
 *
 * One scroll of cards, and every field rendered by a component that knows how to be both read-only
 * and editable — which is what collapses the six drawn screens into one. Same shape as the product
 * and service detail screens; the divergence is the ITEMS section, where a line can carry several
 * sale units at once.
 */
export function OrderDetailBase({
  mode,
  item,
  form,
  errors,
  passthrough,
  slots,
  display,
  onFieldChange,
  onPickCustomer,
  onAddItem,
  onRemoveLine,
  onUnitQty,
  onRemoveUnit,
  onAddUnit,
  onPickStatus,
  onMarkDelivered,
  deliveringIds = EMPTY_IDS,
  onBack,
  onEdit,
  onSave,
  onDelete,
  saving = false,
}: OrderDetailBaseProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const editable = isEditable(mode);

  // Read unconditionally, never behind `&&` — a hook whose call depends on a flag changes hook
  // order the moment the flag flips, which crashes React. Same reasoning as ProductDetailScreen.
  const customersEnabled = useIsTabEnabled('CUSTOMERS');
  const showCustomerCard = showsCustomerCard(customersEnabled, form.customerId != null);
  const customerEditable = customerPickable(editable, customersEnabled);
  const showsFab = showsEditCta(mode) && !!onEdit;

  const orderNumber = String(item?.orderNumber ?? '');
  const total = orderTotal(form.lines, passthrough);

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

        <View style={[styles.appBarCopy, !editable && styles.appBarCopyCentered]}>
          <View style={styles.appBarTitleRow}>
            <Text style={editable ? styles.appBarTitleForm : styles.appBarTitleRead}>
              {appBarTitle(mode, orderNumber)}
            </Text>
            {/* Only add mode names the module — an existing order's number already identifies it. */}
            {mode === 'add' && slots?.moduleLabel ? (
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
            accessibilityLabel={saveLabel(mode)}
            style={[styles.saveButton, saving && styles.saveButtonBusy]}
          >
            <Check size={15} color={theme.colors.onAccent ?? '#FFFFFF'} />
            <Text style={styles.saveLabel}>{saveLabel(mode)}</Text>
          </Pressable>
        ) : (
          <View style={styles.iconButtonSpacer} />
        )}
      </View>

      {/*
        The screen claims no bottom safe-area edge, so the scroll runs under a translucent system
        nav bar — but the LAST element still has to clear it, or Delete sits under the nav bar and
        cannot be tapped. The inset always applies; the extra 78 is the floating button's own room.
      */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (showsFab ? 102 : 24) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!editable ? (
          <View style={styles.titleBlock}>
            <View style={styles.titleRow}>
              <StatusPill status={form.orderStatus} />
              <Text style={styles.titleDate}>
                {formatOrderDate((item?.orderDate as string) ?? null)
                  ? `· ${formatOrderDate((item?.orderDate as string) ?? null)}`
                  : ''}
              </Text>
            </View>
          </View>
        ) : null}

        {/* ── Customer ───────────────────────────────────────────────────────
            Absent entirely when the Customers module is off AND this order has nobody on it —
            that business does not track customers, so every order is anonymous and there is no
            choice to offer. One that already CARRIES a customer still shows them, read-only. */}
        {showCustomerCard ? (
          <DetailCard title="Customer" icon={User} gap={customerEditable ? 13 : 12}>
            <CustomerRow
              form={form}
              editable={customerEditable}
              error={errors.customer}
              onPress={onPickCustomer}
              styles={styles}
              theme={theme}
            />
          </DetailCard>
        ) : null}

        {/* ── Items ────────────────────────────────────────────────────────── */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>ITEMS</Text>
          {editable ? (
            <Pressable
              onPress={onAddItem}
              style={styles.addItemButton}
              accessibilityRole="button"
              accessibilityLabel="Add item"
            >
              <Plus size={13} color={theme.colors.primary} />
              <Text style={styles.addItemLabel}>Add item</Text>
            </Pressable>
          ) : (
            <Text style={styles.sectionCount}>{itemCountLabel(form.lines, passthrough)}</Text>
          )}
        </View>

        {errors.items ? <Text style={styles.sectionError}>{errors.items}</Text> : null}

        {form.lines.map((line, index) => (
          <ItemRow
            key={`${line.productId}-${index}`}
            line={line}
            index={index}
            display={display[line.productId]}
            editable={editable}
            error={errors[`line.${index}.quantity`]}
            styles={styles}
            theme={theme}
            onRemoveLine={onRemoveLine}
            onUnitQty={onUnitQty}
            onRemoveUnit={onRemoveUnit}
            onAddUnit={onAddUnit}
            onMarkDelivered={onMarkDelivered}
            delivering={deliveringIds.includes(line.productId)}
          />
        ))}

        {/* Packages, service plans and subscriptions: shown so the total makes sense, never
            editable — there is no mobile UI to build one, and the picker only offers products. */}
        {passthrough.map((row, index) => (
          <PassthroughRow key={`pt-${index}`} row={row} styles={styles} theme={theme} />
        ))}

        {editable && !form.lines.length && !passthrough.length ? (
          <Pressable onPress={onAddItem} style={styles.emptyItems} accessibilityRole="button">
            <Plus size={16} color={theme.palette.muted} />
            <Text style={styles.emptyItemsLabel}>Add product</Text>
          </Pressable>
        ) : null}

        {/* ── Order card (edit only) ───────────────────────────────────────── */}
        {editable ? (
          <DetailCard title="Order" icon={Package} gap={13}>
            <Pressable
              onPress={onPickStatus}
              accessibilityRole="button"
              accessibilityLabel="Order status"
            >
              <DetailField
                label="Order Status"
                value={statusLabel(form.orderStatus)}
                editable={false}
                error={errors.status}
              />
            </Pressable>
            <DetailField
              label="Notes"
              value={form.notes}
              editable
              multiline
              maxLength={1000}
              onChange={(v) => onFieldChange('notes', v)}
              placeholder="Add a note to this order…"
              readLayout="block"
            />
          </DetailCard>
        ) : null}

        {/* ── Grand total ──────────────────────────────────────────────────── */}
        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>Grand Total</Text>
          <Text style={styles.totalValue}>{formatAmount(total)}</Text>
        </View>

        {/* ── Read-only tail ───────────────────────────────────────────────── */}
        {!editable ? (
          <>
            <DetailCard title="Notes" icon={FileText} gap={12}>
              <Text style={styles.notes}>{form.notes || 'No notes added'}</Text>
            </DetailCard>

            <View style={styles.billStrip}>
              <Receipt size={14} color={theme.palette.muted} />
              <Text style={styles.billText}>{billLine(item)}</Text>
            </View>

            <DetailCard title="System Information" icon={History} gap={12}>
              <DetailField
                label="Created"
                value={formatOrderStamp(item?.createdAt as string)}
                editable={false}
              />
              <DetailField
                label="Updated"
                value={formatOrderStamp(item?.updatedAt as string)}
                editable={false}
              />
              {/* Read-only by design: `OrderMapper.toEntity` never copies orderDate, so @PrePersist
                  stamps it and anything a client sends is ignored. The web portal has no picker
                  either. */}
              <DetailField
                label="Order date"
                value={formatOrderDate(item?.orderDate as string)}
                editable={false}
              />
            </DetailCard>
          </>
        ) : null}

        {showsDelete(mode) && onDelete ? (
          <Pressable
            onPress={onDelete}
            style={styles.deleteButton}
            accessibilityRole="button"
            accessibilityLabel="Delete order"
          >
            <Trash2 size={16} color={theme.palette.error} />
            <Text style={styles.deleteLabel}>Delete Order</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Yoga resolves an absolutely positioned child against the BORDER edge, outside the
          SafeAreaView's padding, so this pays the bottom inset itself. */}
      {showsFab ? (
        <Pressable
          onPress={onEdit}
          style={[styles.editFab, { bottom: insets.bottom + 20 }]}
          accessibilityRole="button"
          accessibilityLabel="Edit order"
        >
          <Pencil size={20} color={theme.colors.onAccent ?? '#FFFFFF'} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof createStyles>;

/** Order status → badge tone. Cancelled and rejected are the only ones that read as a problem. */
function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
    case 'REJECTED':
      return 'error';
    case 'PROCESSING':
      return 'info';
    case 'CONFIRMED':
      return 'accent';
    default:
      return 'neutral';
  }
}

function StatusPill({ status }: { status: string }) {
  return <Badge label={statusLabel(status)} tone={statusTone(status)} />;
}

function CustomerRow({
  form,
  editable,
  error,
  onPress,
  styles,
  theme,
}: {
  form: OrderFormState;
  editable: boolean;
  error?: string;
  onPress?: () => void;
  styles: Styles;
  theme: AppTheme;
}) {
  const hasCustomer = form.customerId != null;
  const contact = [form.customerPhone, form.customerEmail].filter(Boolean).join(' · ');

  const body = (
    <View style={styles.customerRow}>
      {hasCustomer ? (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(form.customerName)}</Text>
        </View>
      ) : (
        <View style={styles.avatarEmpty}>
          <User size={16} color={theme.palette.muted} />
        </View>
      )}
      <View style={styles.customerBody}>
        <Text style={hasCustomer ? styles.customerName : styles.customerPlaceholder}>
          {hasCustomer ? form.customerName : 'Select customer'}
        </Text>
        {contact ? (
          <Text style={styles.customerContact} numberOfLines={1}>
            {contact}
          </Text>
        ) : null}
      </View>
      {editable ? <Text style={styles.chevron}>⌄</Text> : null}
    </View>
  );

  if (!editable) return body;
  return (
    <>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Select customer">
        {body}
      </Pressable>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </>
  );
}

function ItemRow({
  line,
  index,
  display,
  editable,
  error,
  styles,
  theme,
  onRemoveLine,
  onUnitQty,
  onRemoveUnit,
  onAddUnit,
  onMarkDelivered,
  delivering = false,
}: {
  line: OrderLine;
  index: number;
  display?: LineDisplay;
  editable: boolean;
  error?: string;
  styles: Styles;
  theme: AppTheme;
  onMarkDelivered?: (productId: number) => void;
  delivering?: boolean;
  onRemoveLine?: (index: number) => void;
  onUnitQty?: (lineIndex: number, unitIndex: number, qty: number) => void;
  onRemoveUnit?: (lineIndex: number, unitIndex: number) => void;
  onAddUnit?: (lineIndex: number) => void;
}) {
  // The snapshot wins over the live catalog row: it is frozen at order time and survives the
  // product being deleted, which is exactly when a name matters most.
  const snapshot = line.productSnapshot as { name?: string; brand?: string } | undefined;
  const name = snapshot?.name || display?.name || `Product #${line.productId}`;
  const brand = snapshot?.brand || display?.brand || '';
  const units = displayUnitLines(line);
  const status = String(line.status ?? '');
  const showsDeliver = !editable && !!onMarkDelivered && canMarkDelivered(line);

  return (
    <View style={styles.itemRow}>
      <View style={styles.itemHead}>
        <View style={styles.thumb}>
          <ImageIcon size={16} color={theme.palette.muted} />
        </View>
        <View style={styles.itemBody}>
          <Text style={styles.itemName} numberOfLines={1}>
            {name}
          </Text>
          {brand ? (
            <Text style={styles.itemBrand} numberOfLines={1}>
              {brand}
            </Text>
          ) : null}
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.itemPrice}>{formatAmount(lineTotal(line))}</Text>
          {!editable && status ? (
            <Text style={styles.itemStatus}>{itemStatusLabel(status).toUpperCase()}</Text>
          ) : null}
        </View>
        {editable && onRemoveLine ? (
          <Pressable
            onPress={() => onRemoveLine(index)}
            style={styles.rowRemove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${name}`}
          >
            <X size={14} color={theme.palette.muted} />
          </Pressable>
        ) : null}
      </View>

      {!editable ? (
        <Text style={styles.itemMeta}>{unitSummary(line, formatAmount)}</Text>
      ) : (
        <View style={styles.unitList}>
          {units.map((unit, unitIndex) => (
            <View key={`${unit.unit}-${unitIndex}`} style={styles.unitRow}>
              <View style={styles.unitChip}>
                {/* Removing the last unit leaves an empty line, which validation then flags —
                    better than silently deleting a row the user only meant to re-unit. */}
                <Pressable
                  onPress={() => onRemoveUnit?.(index, unitIndex)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${unit.unit}`}
                >
                  <X size={11} color={theme.palette.muted} />
                </Pressable>
                <Text style={styles.unitChipText}>
                  {unit.unit} · {formatAmount(unit.price)}
                </Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => onUnitQty?.(index, unitIndex, unit.qty - 1)}
                  style={styles.stepperButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease ${unit.unit}`}
                >
                  <Minus size={12} color={theme.palette.onSurface} />
                </Pressable>
                <Text style={styles.stepperValue}>{unit.qty}</Text>
                <Pressable
                  onPress={() => onUnitQty?.(index, unitIndex, unit.qty + 1)}
                  style={styles.stepperButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Increase ${unit.unit}`}
                >
                  <Plus size={12} color={theme.palette.onSurface} />
                </Pressable>
              </View>
            </View>
          ))}
          {/* Only offered when the product has another rung to add — a single-unit product would
              just fold back into the row it already has. */}
          {(display?.units.length ?? 0) > units.length && onAddUnit ? (
            <Pressable
              onPress={() => onAddUnit(index)}
              style={styles.addUnit}
              accessibilityRole="button"
              accessibilityLabel={`Add another unit to ${name}`}
            >
              <Plus size={12} color={theme.colors.primary} />
              <Text style={styles.addUnitLabel}>add unit</Text>
            </Pressable>
          ) : null}
          {error ? <Text style={styles.fieldError}>{error}</Text> : null}
        </View>
      )}

      {/* View mode only, and only while the line can still move. The mirror of the appointment
          screen's per-service "Mark completed" — see `canMarkDelivered` for why this one rides the
          ordinary save rather than an endpoint of its own. */}
      {showsDeliver ? (
        <Pressable
          onPress={() => onMarkDelivered?.(line.productId)}
          disabled={delivering}
          style={[styles.deliverButton, delivering && styles.deliverButtonBusy]}
          accessibilityRole="button"
          accessibilityLabel={`Mark ${name} delivered`}
        >
          <Check size={13} color={theme.palette.success} />
          <Text style={styles.deliverLabel}>{delivering ? 'Marking…' : 'Mark delivered'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PassthroughRow({
  row,
  styles,
  theme,
}: {
  row: Record<string, unknown>;
  styles: Styles;
  theme: AppTheme;
}) {
  const label =
    String(row.packageName ?? row.planName ?? row.itemName ?? '') ||
    `${String(row.type ?? 'Item')} #${String(row.packageId ?? row.itemId ?? '')}`;
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemHead}>
        <View style={styles.thumb}>
          <Package size={16} color={theme.palette.muted} />
        </View>
        <View style={styles.itemBody}>
          <Text style={styles.itemName} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.itemBrand}>Managed on the web portal</Text>
        </View>
        <Text style={styles.itemPrice}>{formatAmount(Number(row.totalPrice ?? 0))}</Text>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.palette.background },

    appBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    iconButtonSpacer: { width: 36, height: 36 },
    appBarCopy: { flex: 1, gap: 2 },
    appBarCopyCentered: { alignItems: 'center' },
    appBarTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    appBarTitleRead: { fontSize: 15, fontWeight: '700', color: theme.palette.onBackground },
    appBarTitleForm: { fontSize: 16, fontWeight: '700', color: theme.palette.onBackground },
    appBarSubtitle: { fontSize: 12, color: theme.palette.muted },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: theme.colors.primary,
    },
    saveButtonBusy: { opacity: 0.6 },
    saveLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.onAccent ?? '#FFFFFF' },

    content: { paddingHorizontal: 16, gap: 12 },

    titleBlock: { gap: 8 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    titleDate: { fontSize: 13, color: theme.palette.muted },

    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: theme.palette.muted,
    },
    sectionCount: { fontSize: 12, color: theme.palette.muted },
    sectionError: { fontSize: 12, color: theme.palette.error },
    addItemButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addItemLabel: { fontSize: 12.5, fontWeight: '600', color: theme.colors.primary },

    customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    customerBody: { flex: 1, gap: 2 },
    customerName: { fontSize: 14, fontWeight: '600', color: theme.palette.onSurface },
    customerPlaceholder: { fontSize: 14, color: theme.palette.muted },
    customerContact: { fontSize: 12, color: theme.palette.muted },
    chevron: { fontSize: 16, color: theme.palette.muted, marginTop: -6 },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.softBg,
    },
    avatarText: { fontSize: 12.5, fontWeight: '700', color: theme.colors.primary },
    avatarEmpty: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    fieldError: { fontSize: 12, color: theme.palette.error },

    itemRow: {
      gap: 8,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    thumb: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceElevated,
    },
    itemBody: { flex: 1, gap: 1 },
    itemName: { fontSize: 13.5, fontWeight: '600', color: theme.palette.onSurface },
    itemBrand: { fontSize: 11.5, color: theme.palette.muted },
    itemRight: { alignItems: 'flex-end', gap: 2 },
    itemPrice: { fontSize: 13.5, fontWeight: '700', color: theme.colors.primary },
    itemStatus: {
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: theme.palette.muted,
    },
    itemMeta: { fontSize: 11.5, color: theme.palette.muted },
    rowRemove: { padding: 4 },

    unitList: { gap: 8 },
    unitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    unitChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    unitChipText: { fontSize: 11.5, color: theme.palette.onSurface },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 'auto',
      borderRadius: 10,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    stepperButton: { width: 30, height: 28, alignItems: 'center', justifyContent: 'center' },
    stepperValue: {
      minWidth: 22,
      textAlign: 'center',
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.palette.onSurface,
    },
    addUnit: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addUnitLabel: { fontSize: 11.5, fontWeight: '600', color: theme.colors.primary },

    deliverButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.palette.success + '18',
    },
    deliverButtonBusy: { opacity: 0.6 },
    deliverLabel: { fontSize: 12.5, fontWeight: '700', color: theme.palette.success },

    emptyItems: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.palette.divider,
    },
    emptyItemsLabel: { fontSize: 13, color: theme.palette.muted },

    totalBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.colors.softBg,
    },
    totalLabel: { fontSize: 14, fontWeight: '700', color: theme.palette.onSurface },
    totalValue: { fontSize: 18, fontWeight: '800', color: theme.colors.primary },

    notes: { fontSize: 13, lineHeight: 19, color: theme.palette.onSurface },

    billStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    billText: { fontSize: 12.5, color: theme.palette.muted },

    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.palette.error + '55',
      backgroundColor: theme.palette.error + '11',
    },
    deleteLabel: { fontSize: 14, fontWeight: '700', color: theme.palette.error },

    editFab: {
      position: 'absolute',
      right: 20,
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
  });
}
