import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Calendar,
  Check,
  ChevronLeft,
  FileText,
  History,
  Lock,
  Package,
  Pencil,
  Plus,
  Receipt,
  ShoppingBag,
  Sparkles,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import { DetailCard } from '../../shared/detail/parts/DetailCard';
import { DetailField } from '../../shared/detail/parts/DetailField';
import { Badge } from '../../shared/detail/parts/Badge';
import { AdhocLineRow } from '../../shared/detail/parts/AdhocLineRow';
import {
  attachedCount,
  formatAmount,
  formatBillDate,
  formatStamp,
  initialsOf,
  itemCountLabel,
  money,
  type BillDetailItem,
  type BillFormState,
} from './billDetail.model';
import {
  appBarSubtitle,
  appBarTitle,
  billStatusLabel,
  customerLocked,
  CUSTOMER_LOCK_NOTE,
  isEditable,
  paymentStatusLabel,
  saveLabel,
  showsDelete,
  showsEditCta,
  type DetailMode,
} from './billDetail.view';
import { balanceOf, discountLabel, showsSettlementInput } from './billMoney';
import type { BillLine } from './billLines';

export interface BillDetailSlots {
  moduleLabel?: string;
}

interface Props {
  mode: DetailMode;
  item: BillDetailItem | null;
  form: BillFormState;
  errors: Record<string, string>;
  slots?: BillDetailSlots;

  onFieldChange: (
    field: 'billStatus' | 'paymentStatus' | 'billDate' | 'notes',
    value: string,
  ) => void;
  onAmountChange?: (
    field: 'tips' | 'taxRate' | 'paidAmount' | 'refundedAmount',
    value: number,
  ) => void;
  onDiscountType?: (type: 'FIXED' | 'PERCENTAGE') => void;
  onDiscountValue?: (value: number) => void;
  onPickCustomer?: () => void;
  onPickBillStatus?: () => void;
  onPickPaymentStatus?: () => void;
  onPickDate?: () => void;
  onAddItems?: () => void;
  onRemoveLine?: (index: number) => void;

  onBack: () => void;
  onEdit?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  saving?: boolean;
}

/**
 * The bill detail screen, in whichever mode it was asked for.
 *
 * Two things set it apart from the order and appointment screens it otherwise mirrors. First, the
 * items list holds THREE kinds of row at once — an attached order, an attached appointment, and a
 * bare catalog line — which is why the row renderer branches on `line.kind` rather than assuming a
 * product. Second, the Summary is the only place in the app where the user edits numbers that the
 * server will recompute: every figure below is `billMoney`'s local arithmetic, shown so the user
 * knows what they are about to charge, and none of it is ever sent.
 */
export function BillDetailBase({
  mode,
  item,
  form,
  errors,
  slots,
  onFieldChange,
  onAmountChange,
  onDiscountType,
  onDiscountValue,
  onPickCustomer,
  onPickBillStatus,
  onPickPaymentStatus,
  onPickDate,
  onAddItems,
  onRemoveLine,
  onBack,
  onEdit,
  onSave,
  onDelete,
  saving = false,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const editable = isEditable(mode);
  const showsFab = showsEditCta(mode) && !!onEdit;

  const number = String(item?.billNumber ?? '');
  const totals = money(form);
  const locked = customerLocked(attachedCount(form.lines));
  const balance = balanceOf(totals.grandTotal, form.paidAmount);

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
              {appBarTitle(mode, number)}
            </Text>
            {mode === 'add' && slots?.moduleLabel ? (
              <Badge label={slots.moduleLabel} tone="accent" />
            ) : null}
          </View>
          {editable ? (
            <Text style={styles.appBarSubtitle}>{appBarSubtitle(mode)}</Text>
          ) : (
            <View style={styles.appBarStatusRow}>
              <StatusChip status={form.billStatus} label={billStatusLabel(form.billStatus)} />
              <Text style={styles.appBarWhen}>
                {form.billDate ? `· ${formatBillDate(form.billDate)}` : ''}
              </Text>
            </View>
          )}
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
            <Text style={styles.saveLabelText}>{saveLabel(mode)}</Text>
          </Pressable>
        ) : (
          <View style={styles.iconButtonSpacer} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (showsFab ? 102 : 24) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Customer ───────────────────────────────────────────────────────── */}
        <DetailCard title="Customer" icon={User} gap={editable ? 13 : 12}>
          <CustomerRow
            form={form}
            editable={editable}
            locked={locked}
            error={errors.customer || errors.customerPhone}
            onPress={onPickCustomer}
            styles={styles}
            theme={theme}
          />
          {editable && locked ? <Text style={styles.lockNote}>{CUSTOMER_LOCK_NOTE}</Text> : null}
        </DetailCard>

        {/* ── Status (read only — edit puts both axes in Bill Details) ────────── */}
        {!editable ? (
          <DetailCard title="Status" icon={Receipt} gap={12}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Bill status</Text>
              <StatusChip status={form.billStatus} label={billStatusLabel(form.billStatus)} />
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Payment</Text>
              <StatusChip
                status={form.paymentStatus}
                label={paymentStatusLabel(form.paymentStatus)}
              />
            </View>
          </DetailCard>
        ) : null}

        {/* ── Billed items ───────────────────────────────────────────────────── */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>BILLED ITEMS</Text>
          {mode === 'edit' ? (
            <Pressable
              onPress={onAddItems}
              style={styles.addItemButton}
              accessibilityRole="button"
              accessibilityLabel="Add items"
            >
              <Plus size={13} color={theme.colors.primary} />
              <Text style={styles.addItemLabel}>Add items</Text>
            </Pressable>
          ) : (
            <Text style={styles.sectionCount}>{itemCountLabel(form.lines)}</Text>
          )}
        </View>

        {errors.items ? <Text style={styles.sectionError}>{errors.items}</Text> : null}

        {form.lines.map((line, index) => (
          <LineRow
            key={`${line.kind}-${line.refId}-${index}`}
            line={line}
            index={index}
            editable={editable}
            styles={styles}
            theme={theme}
            onRemoveLine={onRemoveLine}
          />
        ))}

        {/* The Add mockup draws this as the primary call to action; Edit keeps it for an empty
            bill, where the header pill alone is too quiet to be the only way in. */}
        {editable && (mode === 'add' || !form.lines.length) ? (
          <Pressable
            onPress={onAddItems}
            style={styles.addItemsWide}
            accessibilityRole="button"
            accessibilityLabel="Add items"
          >
            <Plus size={16} color={theme.colors.primary} />
            <Text style={styles.addItemsWideLabel}>
              Add items{' '}
              <Text style={styles.addItemsWideHint}>· orders, appts, catalog or quick add</Text>
            </Text>
          </Pressable>
        ) : null}

        {/* ── Bill details (edit only) ───────────────────────────────────────── */}
        {editable ? (
          <DetailCard title="Bill Details" icon={Receipt} gap={13}>
            <View style={styles.twoUp}>
              <Pressable
                style={styles.twoUpCell}
                onPress={onPickBillStatus}
                accessibilityRole="button"
                accessibilityLabel="Bill status"
              >
                <DetailField
                  label="Bill Status"
                  value={billStatusLabel(form.billStatus)}
                  editable={false}
                  readLayout="block"
                  error={errors.billStatus}
                />
              </Pressable>
              <Pressable
                style={styles.twoUpCell}
                onPress={onPickPaymentStatus}
                accessibilityRole="button"
                accessibilityLabel="Payment status"
              >
                <DetailField
                  label="Payment"
                  value={paymentStatusLabel(form.paymentStatus)}
                  editable={false}
                  readLayout="block"
                  error={errors.paymentStatus}
                />
              </Pressable>
            </View>

            <Pressable
              onPress={onPickDate}
              accessibilityRole="button"
              accessibilityLabel="Pick a bill date"
            >
              <DetailField
                label="Bill Date"
                value={formatBillDate(form.billDate) || 'Pick a date'}
                editable={false}
                readLayout="block"
                error={errors.billDate}
              />
            </Pressable>

            <DetailField
              label="Notes"
              value={form.notes}
              editable
              multiline
              maxLength={255}
              onChange={(v) => onFieldChange('notes', v)}
              placeholder="Add any notes or special instructions…"
            />
          </DetailCard>
        ) : null}

        {/* ── Summary ────────────────────────────────────────────────────────── */}
        <DetailCard title="Summary" icon={Wallet} gap={editable ? 13 : 10}>
          <SummaryRow label="Subtotal" value={formatAmount(totals.subtotal)} styles={styles} />

          {editable ? (
            <SummaryRow
              label="Tips"
              styles={styles}
              right={
                <AmountInput
                  prefix="₹"
                  value={form.tips}
                  onChange={(v) => onAmountChange?.('tips', v)}
                  accessibilityLabel="Tips"
                  styles={styles}
                  theme={theme}
                />
              }
            />
          ) : totals.tips > 0 ? (
            <SummaryRow label="Tips" value={formatAmount(totals.tips)} styles={styles} />
          ) : null}

          {editable ? (
            <SummaryRow
              label="Discount"
              styles={styles}
              right={
                <View style={styles.discountControls}>
                  <View style={styles.toggle}>
                    {(['FIXED', 'PERCENTAGE'] as const).map((type) => {
                      const active = form.discount.type === type;
                      return (
                        <Pressable
                          key={type}
                          onPress={() => onDiscountType?.(type)}
                          style={[styles.toggleCell, active && styles.toggleCellOn]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={
                            type === 'FIXED' ? 'Discount in rupees' : 'Discount in percent'
                          }
                        >
                          <Text style={active ? styles.toggleLabelOn : styles.toggleLabel}>
                            {type === 'FIXED' ? '₹' : '%'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <AmountInput
                    value={form.discount.value}
                    onChange={(v) => onDiscountValue?.(v)}
                    accessibilityLabel="Discount value"
                    styles={styles}
                    theme={theme}
                  />
                </View>
              }
            />
          ) : null}

          {errors.discount ? <Text style={styles.fieldError}>{errors.discount}</Text> : null}

          {totals.discountAmount > 0 ? (
            <SummaryRow
              label={discountLabel(form.discount)}
              value={`−${formatAmount(totals.discountAmount)}`}
              tint={theme.palette.error}
              styles={styles}
            />
          ) : null}

          {editable ? (
            <SummaryRow
              label="Tax rate"
              styles={styles}
              right={
                <AmountInput
                  suffix="%"
                  value={form.taxRate}
                  onChange={(v) => onAmountChange?.('taxRate', v)}
                  accessibilityLabel="Tax rate"
                  styles={styles}
                  theme={theme}
                />
              }
            />
          ) : null}

          {errors.taxRate ? <Text style={styles.fieldError}>{errors.taxRate}</Text> : null}

          {totals.taxAmount > 0 ? (
            <SummaryRow
              label={`Tax (${form.taxRate}%)`}
              value={`+${formatAmount(totals.taxAmount)}`}
              tint={theme.palette.success}
              styles={styles}
            />
          ) : null}

          <View style={styles.divider} />

          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Grand Total</Text>
            <Text style={styles.grandValue}>{formatAmount(totals.grandTotal)}</Text>
          </View>

          <SettlementBlock
            form={form}
            editable={editable}
            balance={balance}
            errors={errors}
            onAmountChange={onAmountChange}
            styles={styles}
            theme={theme}
          />
        </DetailCard>

        {/* ── Read-only tail ─────────────────────────────────────────────────── */}
        {!editable ? (
          <>
            <DetailCard title="Notes" icon={FileText} gap={12}>
              <Text style={styles.notes}>{form.notes || 'No notes added'}</Text>
            </DetailCard>

            <DetailCard title="System Information" icon={History} gap={12}>
              <DetailField label="Bill number" value={number} editable={false} />
              <DetailField label="Created" value={formatStamp(item?.createdAt)} editable={false} />
              <DetailField label="Updated" value={formatStamp(item?.updatedAt)} editable={false} />
            </DetailCard>
          </>
        ) : null}

        {showsDelete(mode) && onDelete ? (
          <Pressable
            onPress={onDelete}
            style={styles.deleteButton}
            accessibilityRole="button"
            accessibilityLabel="Delete bill"
          >
            <Trash2 size={16} color={theme.palette.error} />
            <Text style={styles.deleteLabel}>Delete Bill</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {showsFab ? (
        <Pressable
          onPress={onEdit}
          style={[styles.editFab, { bottom: insets.bottom + 20 }]}
          accessibilityRole="button"
          accessibilityLabel="Edit bill"
        >
          <Pencil size={20} color={theme.colors.onAccent ?? '#FFFFFF'} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof createStyles>;

/**
 * A status pill in the shared status palette.
 *
 * Not `Badge`, deliberately: the billing LIST colours its pills from `theme.status`, and a detail
 * screen that invented its own mapping would give the same bill two different colours depending on
 * which screen you were looking at.
 */
function StatusChip({ status, label }: { status: string; label: string }) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const tone = theme.status[status] ?? theme.status.FALLBACK;
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.chipLabel, { color: tone.text }]}>{label}</Text>
    </View>
  );
}

function CustomerRow({
  form,
  editable,
  locked,
  error,
  onPress,
  styles,
  theme,
}: {
  form: BillFormState;
  editable: boolean;
  locked: boolean;
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
      {editable ? (
        locked ? (
          <Lock size={15} color={theme.palette.muted} />
        ) : (
          <Text style={styles.chevron}>⌄</Text>
        )
      ) : null}
    </View>
  );

  // Locked is not merely styled — the press target goes away, so there is no way to open a picker
  // whose result would orphan the attached lines.
  if (!editable || locked) return body;
  return (
    <>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Select customer">
        {body}
      </Pressable>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </>
  );
}

/**
 * No QUICK entry, deliberately. An ad-hoc line draws its own photo thumbnail in place of the icon
 * chip, so it takes a different row component entirely — see the branch in `LineRow`.
 */
const LINE_ICON: Partial<Record<BillLine['kind'], typeof ShoppingBag>> = {
  ORDER: ShoppingBag,
  APPOINTMENT: Calendar,
  PRODUCT: Package,
  SERVICE: Sparkles,
};

function LineRow({
  line,
  index,
  editable,
  styles,
  theme,
  onRemoveLine,
}: {
  line: BillLine;
  index: number;
  editable: boolean;
  styles: Styles;
  theme: AppTheme;
  onRemoveLine?: (index: number) => void;
}) {
  // An ad-hoc line is a different row: a photo thumbnail instead of an icon chip, and an AD-HOC
  // pill so it cannot be mistaken for a catalog product sitting beside it.
  if (line.kind === 'QUICK' && line.quick) {
    return (
      <AdhocLineRow
        item={line.quick}
        meta={line.sublabel}
        amount={formatAmount(line.amount)}
        editable={editable && !!onRemoveLine}
        onRemove={onRemoveLine ? () => onRemoveLine(index) : undefined}
      />
    );
  }

  const Icon = LINE_ICON[line.kind] ?? Package;
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemIcon}>
        <Icon size={16} color={theme.colors.primary} />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemName} numberOfLines={1}>
          {line.label}
        </Text>
        <Text style={styles.itemSub} numberOfLines={1}>
          {line.sublabel}
        </Text>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemPrice}>{formatAmount(line.amount)}</Text>
        {editable && onRemoveLine ? (
          <Pressable
            onPress={() => onRemoveLine(index)}
            style={styles.rowRemove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${line.label}`}
          >
            <X size={14} color={theme.palette.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  tint,
  right,
  styles,
}: {
  label: string;
  value?: string;
  tint?: string;
  right?: React.ReactNode;
  styles: Styles;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      {right ?? <Text style={[styles.summaryValue, tint ? { color: tint } : null]}>{value}</Text>}
    </View>
  );
}

/**
 * A number in a bordered pill, with an optional ₹ or % beside it.
 *
 * Held as text while focused so a half-typed "1." is not rewritten to "1" under the cursor, and
 * emitted as a number on every keystroke so the totals above track what is being typed.
 */
function AmountInput({
  value,
  onChange,
  prefix,
  suffix,
  accessibilityLabel,
  styles,
  theme,
}: {
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  accessibilityLabel: string;
  styles: Styles;
  theme: AppTheme;
}) {
  const [text, setText] = React.useState<string | null>(null);
  const shown = text ?? String(value ?? 0);

  return (
    <View style={styles.amountPill}>
      {prefix ? <Text style={styles.amountAffix}>{prefix}</Text> : null}
      <TextInput
        style={styles.amountInput}
        value={shown}
        onChangeText={(next) => {
          const cleaned = next.replace(/[^0-9.]/g, '');
          setText(cleaned);
          onChange(cleaned === '' ? 0 : Number(cleaned));
        }}
        onBlur={() => setText(null)}
        keyboardType="numeric"
        selectTextOnFocus
        placeholder="0"
        placeholderTextColor={theme.palette.muted}
        accessibilityLabel={accessibilityLabel}
      />
      {suffix ? <Text style={styles.amountAffix}>{suffix}</Text> : null}
    </View>
  );
}

/**
 * The settlement block: what has been paid, and what is left.
 *
 * The input appears ONLY for the two statuses the server takes a number from. Every other status
 * has its amount forced by `applySettlementAmounts` — on PAID the client's figure is discarded and
 * `paidAmount` becomes the grand total — so an editable box there would be a lie the next refresh
 * would expose.
 */
function SettlementBlock({
  form,
  editable,
  balance,
  errors,
  onAmountChange,
  styles,
  theme,
}: {
  form: BillFormState;
  editable: boolean;
  balance: number;
  errors: Record<string, string>;
  onAmountChange?: (
    field: 'tips' | 'taxRate' | 'paidAmount' | 'refundedAmount',
    value: number,
  ) => void;
  styles: Styles;
  theme: AppTheme;
}) {
  const isRefund = form.paymentStatus === 'PARTIAL_REFUNDED' || form.paymentStatus === 'REFUNDED';
  const settled = isRefund ? form.refundedAmount : form.paidAmount;
  const settledLabel = isRefund ? 'Refunded' : 'Paid';

  if (!editable) {
    if (!(settled > 0)) return null;
    return (
      <>
        <View style={styles.divider} />
        <SummaryRow
          label={settledLabel}
          value={formatAmount(settled)}
          tint={theme.palette.success}
          styles={styles}
        />
      </>
    );
  }

  if (!showsSettlementInput(form.paymentStatus)) {
    // Nothing to enter, but there is still something to SEE. Dropping the row entirely would mean a
    // PAID bill shows no money at all the moment you tap Edit, which reads as data lost rather than
    // as a field the server owns. So: the figure, plus who decides it.
    if (!(settled > 0)) return null;
    return (
      <>
        <View style={styles.divider} />
        <SummaryRow
          label={settledLabel}
          value={formatAmount(settled)}
          tint={theme.palette.success}
          styles={styles}
        />
        <Text style={styles.settlementNote}>
          {`Set automatically by the “${paymentStatusLabel(form.paymentStatus)}” payment status.`}
        </Text>
      </>
    );
  }

  const field = isRefund ? 'refundedAmount' : 'paidAmount';
  const error = errors.paidAmount || errors.refundedAmount;

  return (
    <>
      <View style={styles.divider} />
      <SummaryRow
        label={isRefund ? 'Refunded amount' : 'Paid amount'}
        styles={styles}
        right={
          <AmountInput
            prefix="₹"
            value={settled}
            onChange={(v) => onAmountChange?.(field, v)}
            accessibilityLabel={isRefund ? 'Refunded amount' : 'Paid amount'}
            styles={styles}
            theme={theme}
          />
        }
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {!isRefund ? (
        <SummaryRow
          label="Balance"
          value={formatAmount(balance)}
          tint={balance > 0 ? theme.colors.primary : theme.palette.success}
          styles={styles}
        />
      ) : null}
    </>
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
    appBarCopy: { flex: 1, gap: 3 },
    appBarTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    appBarTitleRead: { fontSize: 15, fontWeight: '700', color: theme.palette.onBackground },
    appBarTitleForm: { fontSize: 16, fontWeight: '700', color: theme.palette.onBackground },
    appBarSubtitle: { fontSize: 12, color: theme.palette.muted },
    appBarStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    appBarWhen: { fontSize: 12.5, color: theme.palette.muted },
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
    saveLabelText: { fontSize: 13, fontWeight: '700', color: theme.colors.onAccent ?? '#FFFFFF' },

    content: { paddingHorizontal: 16, gap: 12 },

    chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
    chipLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

    statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statusLabel: { fontSize: 13, color: theme.palette.muted },

    customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    customerBody: { flex: 1, gap: 2 },
    customerName: { fontSize: 14, fontWeight: '600', color: theme.palette.onSurface },
    customerPlaceholder: { fontSize: 14, color: theme.palette.muted },
    customerContact: { fontSize: 12, color: theme.palette.muted },
    chevron: { fontSize: 16, color: theme.palette.muted, marginTop: -6 },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.softBg,
    },
    avatarText: { fontSize: 12.5, fontWeight: '700', color: theme.colors.primary },
    avatarEmpty: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    lockNote: { fontSize: 11.5, lineHeight: 16, color: theme.palette.muted },
    fieldError: { fontSize: 12, color: theme.palette.error },

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
    addItemButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.colors.softBg,
    },
    addItemLabel: { fontSize: 12.5, fontWeight: '700', color: theme.colors.primary },
    addItemsWide: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 15,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.softBg,
    },
    addItemsWideLabel: { fontSize: 13.5, fontWeight: '700', color: theme.colors.primary },
    addItemsWideHint: { fontWeight: '500' },

    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    itemIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.softBg,
    },
    itemBody: { flex: 1, gap: 2 },
    itemName: { fontSize: 13.5, fontWeight: '600', color: theme.palette.onSurface },
    itemSub: { fontSize: 11.5, color: theme.palette.muted },
    itemRight: { alignItems: 'flex-end', gap: 2 },
    itemPrice: { fontSize: 13.5, fontWeight: '700', color: theme.colors.primary },
    rowRemove: { padding: 4 },

    twoUp: { flexDirection: 'row', gap: 12 },
    twoUpCell: { flex: 1 },

    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 22,
    },
    summaryLabel: { fontSize: 13, color: theme.palette.muted },
    settlementNote: { fontSize: 11, lineHeight: 15, color: theme.palette.muted },
    summaryValue: { fontSize: 13, fontWeight: '600', color: theme.palette.onSurface },

    discountControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    toggle: {
      flexDirection: 'row',
      borderRadius: 9,
      padding: 2,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    toggleCell: {
      width: 30,
      height: 26,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleCellOn: { backgroundColor: theme.colors.primary },
    toggleLabel: { fontSize: 12.5, fontWeight: '700', color: theme.palette.muted },
    toggleLabelOn: { fontSize: 12.5, fontWeight: '700', color: theme.colors.onAccent ?? '#FFFFFF' },

    amountPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minWidth: 74,
      height: 34,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surfaceElevated,
    },
    amountAffix: { fontSize: 12, color: theme.palette.muted },
    amountInput: {
      flex: 1,
      padding: 0,
      textAlign: 'right',
      fontSize: 13.5,
      fontWeight: '700',
      color: theme.palette.onSurface,
    },

    divider: { height: 1, backgroundColor: theme.palette.divider },
    grandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    grandLabel: { fontSize: 14, fontWeight: '700', color: theme.palette.onSurface },
    grandValue: { fontSize: 19, fontWeight: '800', color: theme.colors.primary },

    notes: { fontSize: 13, lineHeight: 19, color: theme.palette.onSurface },

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
