import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Calendar,
  Check,
  CheckCircle2,
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
  appointmentTotal,
  billLine,
  formatAmount,
  formatApptTime,
  formatLongDate,
  formatStamp,
  formatWhen,
  initialsOf,
  itemStatusLabel,
  serviceCountLabel,
  statusLabel,
  type AppointmentDetailItem,
  type AppointmentFormState,
} from './appointmentDetail.model';
import {
  appBarSubtitle,
  appBarTitle,
  isEditable,
  saveLabel,
  showsDelete,
  showsEditCta,
  type DetailMode,
} from './appointmentDetail.view';
import {
  canCompleteItem,
  canCompleteItems,
  serviceMeta,
  type ServiceLine,
} from './appointmentLines';

/** What a line needs from the catalog. Resolved by the screen from the response's enriched rows. */
export interface ServiceDisplay {
  name: string;
  duration: number | null;
}

export interface AppointmentDetailSlots {
  moduleLabel?: string;
}

interface Props {
  mode: DetailMode;
  item: AppointmentDetailItem | null;
  form: AppointmentFormState;
  errors: Record<string, string>;
  passthrough: Record<string, unknown>[];
  slots?: AppointmentDetailSlots;
  display: Record<number, ServiceDisplay>;
  /** Per-item completion in flight, by line index. */
  completing: number | null;

  onFieldChange: (field: 'appointmentStatus' | 'notes' | 'date' | 'time', value: string) => void;
  onPickCustomer?: () => void;
  onPickStatus?: () => void;
  onPickDate?: () => void;
  onPickTime?: () => void;
  onAddService?: () => void;
  onRemoveLine?: (index: number) => void;
  onQuantity?: (index: number, quantity: number) => void;
  onCompleteItem?: (index: number) => void;

  onBack: () => void;
  onEdit?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  saving?: boolean;
}

/**
 * The appointment detail screen, in whichever mode it was asked for.
 *
 * Structurally the order screen's sibling, minus the sale-unit ladder — a service has a quantity
 * and nothing else — and plus two things it alone has: a date/time pair held as two IST wall-clock
 * strings, and per-service "Mark completed".
 */
export function AppointmentDetailBase({
  mode,
  item,
  form,
  errors,
  passthrough,
  slots,
  display,
  completing,
  onFieldChange,
  onPickCustomer,
  onPickStatus,
  onPickDate,
  onPickTime,
  onAddService,
  onRemoveLine,
  onQuantity,
  onCompleteItem,
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

  // Read unconditionally, never behind `&&` — a hook whose call depends on a flag changes hook
  // order the moment the flag flips, which crashes React. Same reasoning as ProductDetailScreen.
  const customersEnabled = useIsTabEnabled('CUSTOMERS');
  const showCustomerCard = showsCustomerCard(customersEnabled, form.customerId != null);
  const customerEditable = customerPickable(editable, customersEnabled);
  const showsFab = showsEditCta(mode) && !!onEdit;

  const number = String(item?.appointmentNumber ?? '');
  const total = appointmentTotal(form.lines, passthrough);
  const completable = canCompleteItems(form.appointmentStatus);

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
              {appBarTitle(mode, number)}
            </Text>
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

      {/* No bottom safe-area edge on the screen, so the scroller pays the inset itself or Delete
          sits under the nav bar. The extra 78 is the floating button's own room. */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (showsFab ? 102 : 24) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!editable ? (
          <View style={styles.titleRow}>
            <StatusPill status={form.appointmentStatus} />
            <Text style={styles.titleWhen}>
              {formatWhen(form.date, form.time) ? `· ${formatWhen(form.date, form.time)}` : ''}
            </Text>
          </View>
        ) : null}

        {/* ── Customer ───────────────────────────────────────────────────────
            Absent entirely when the Customers module is off AND this appointment has nobody on it —
            that business does not track customers, so every appointment is anonymous and there is no
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

        {/* ── Schedule ─────────────────────────────────────────────────────── */}
        <DetailCard
          title={editable ? 'Schedule' : 'Date & Time'}
          icon={Calendar}
          gap={editable ? 13 : 12}
        >
          {editable ? (
            <View style={styles.scheduleRow}>
              <Pressable
                style={styles.scheduleCell}
                onPress={onPickDate}
                accessibilityRole="button"
                accessibilityLabel="Pick a date"
              >
                <DetailField
                  label="Date"
                  value={formatLongDate(form.date) || 'Pick a date'}
                  editable={false}
                  error={errors.date}
                />
              </Pressable>
              <Pressable
                style={styles.scheduleCell}
                onPress={onPickTime}
                accessibilityRole="button"
                accessibilityLabel="Pick a time"
              >
                <DetailField
                  label="Time"
                  value={formatApptTime(form.time) || 'Pick a time'}
                  editable={false}
                  error={errors.time}
                />
              </Pressable>
            </View>
          ) : (
            <>
              <DetailField label="Date" value={formatLongDate(form.date)} editable={false} />
              <DetailField label="Time" value={formatApptTime(form.time)} editable={false} />
            </>
          )}
        </DetailCard>

        {/* ── Services ─────────────────────────────────────────────────────── */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>SERVICES</Text>
          {editable ? (
            <Pressable
              onPress={onAddService}
              style={styles.addItemButton}
              accessibilityRole="button"
              accessibilityLabel="Add service"
            >
              <Plus size={13} color={theme.colors.primary} />
              <Text style={styles.addItemLabel}>Add service</Text>
            </Pressable>
          ) : (
            <Text style={styles.sectionCount}>{serviceCountLabel(form.lines, passthrough)}</Text>
          )}
        </View>

        {errors.services ? <Text style={styles.sectionError}>{errors.services}</Text> : null}

        {form.lines.map((line, index) => (
          <ServiceRow
            key={line.id ?? `${line.serviceId}-${index}`}
            line={line}
            index={index}
            display={display[line.serviceId]}
            editable={editable}
            completable={completable}
            completing={completing === index}
            error={errors[`line.${index}.quantity`]}
            styles={styles}
            theme={theme}
            onRemoveLine={onRemoveLine}
            onQuantity={onQuantity}
            onCompleteItem={onCompleteItem}
          />
        ))}

        {passthrough.map((row, index) => (
          <PassthroughRow key={`pt-${index}`} row={row} styles={styles} theme={theme} />
        ))}

        {editable && !form.lines.length && !passthrough.length ? (
          <Pressable onPress={onAddService} style={styles.emptyItems} accessibilityRole="button">
            <Plus size={16} color={theme.palette.muted} />
            <Text style={styles.emptyItemsLabel}>Add service</Text>
          </Pressable>
        ) : null}

        {/* ── Status & Notes (edit only) ───────────────────────────────────── */}
        {editable ? (
          <DetailCard title="Status & Notes" icon={CheckCircle2} gap={13}>
            <Pressable
              onPress={onPickStatus}
              accessibilityRole="button"
              accessibilityLabel="Appointment status"
            >
              <DetailField
                label="Status"
                value={statusLabel(form.appointmentStatus)}
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
              placeholder="Add a note to this appointment…"
              readLayout="block"
            />
          </DetailCard>
        ) : null}

        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>Grand Total</Text>
          <Text style={styles.totalValue}>{formatAmount(total)}</Text>
        </View>

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
            accessibilityLabel="Delete appointment"
          >
            <Trash2 size={16} color={theme.palette.error} />
            <Text style={styles.deleteLabel}>Delete Appointment</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {showsFab ? (
        <Pressable
          onPress={onEdit}
          style={[styles.editFab, { bottom: insets.bottom + 20 }]}
          accessibilityRole="button"
          accessibilityLabel="Edit appointment"
        >
          <Pencil size={20} color={theme.colors.onAccent ?? '#FFFFFF'} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof createStyles>;

function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
    case 'REJECTED':
      return 'error';
    case 'IN_PROGRESS':
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
  form: AppointmentFormState;
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

function ServiceRow({
  line,
  index,
  display,
  editable,
  completable,
  completing,
  error,
  styles,
  theme,
  onRemoveLine,
  onQuantity,
  onCompleteItem,
}: {
  line: ServiceLine;
  index: number;
  display?: ServiceDisplay;
  editable: boolean;
  completable: boolean;
  completing: boolean;
  error?: string;
  styles: Styles;
  theme: AppTheme;
  onRemoveLine?: (index: number) => void;
  onQuantity?: (index: number, quantity: number) => void;
  onCompleteItem?: (index: number) => void;
}) {
  const snapshot = line.serviceSnapshot as { name?: string } | undefined;
  const name = snapshot?.name || display?.name || `Service #${line.serviceId}`;
  const duration = display?.duration ?? null;
  const status = String(line.status ?? '');
  const showsComplete = !editable && completable && canCompleteItem(line) && !!onCompleteItem;

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
          {/* Edit mode shows the duration alone — the quantity is already the stepper below, and
              repeating it as text reads as a second, stale copy. Read mode joins the two. */}
          {editable ? (
            duration ? (
              <Text style={styles.itemBrand}>{`${duration} min`}</Text>
            ) : null
          ) : (
            <Text style={styles.itemBrand}>{serviceMeta(line, duration)}</Text>
          )}
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.itemPrice}>{formatAmount(Number(line.totalPrice ?? 0))}</Text>
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

      {editable ? (
        <View style={styles.qtyRow}>
          <Text style={styles.qtyLabel}>Qty</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => onQuantity?.(index, line.quantity - 1)}
              style={styles.stepperButton}
              accessibilityRole="button"
              accessibilityLabel={`Decrease ${name}`}
            >
              <Minus size={12} color={theme.palette.onSurface} />
            </Pressable>
            <Text style={styles.stepperValue}>{line.quantity}</Text>
            <Pressable
              onPress={() => onQuantity?.(index, line.quantity + 1)}
              style={styles.stepperButton}
              accessibilityRole="button"
              accessibilityLabel={`Increase ${name}`}
            >
              <Plus size={12} color={theme.palette.onSurface} />
            </Pressable>
          </View>
          {error ? <Text style={styles.fieldError}>{error}</Text> : null}
        </View>
      ) : null}

      {/* Only on a PENDING item of a non-terminal appointment, and only once it has a server id —
          the endpoint matches on that UUID. See `canCompleteItem`. */}
      {showsComplete ? (
        <Pressable
          onPress={() => onCompleteItem?.(index)}
          disabled={completing}
          style={[styles.completeButton, completing && styles.completeButtonBusy]}
          accessibilityRole="button"
          accessibilityLabel={`Mark ${name} completed`}
        >
          <Check size={13} color={theme.palette.success} />
          <Text style={styles.completeLabel}>{completing ? 'Marking…' : 'Mark completed'}</Text>
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
  const label = String(row.packageName ?? '') || `Package #${String(row.packageId ?? '')}`;
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
          <Text style={styles.itemBrand}>Booked against a package</Text>
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

    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    titleWhen: { fontSize: 13, color: theme.palette.muted },

    scheduleRow: { flexDirection: 'row', gap: 12 },
    scheduleCell: { flex: 1 },

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
    rowRemove: { padding: 4 },

    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    qtyLabel: { fontSize: 12, color: theme.palette.muted },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
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

    completeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.palette.success + '18',
    },
    completeButtonBusy: { opacity: 0.6 },
    completeLabel: { fontSize: 12.5, fontWeight: '700', color: theme.palette.success },

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
