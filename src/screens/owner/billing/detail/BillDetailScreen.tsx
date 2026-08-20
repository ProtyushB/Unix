import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import { useToast } from '../../../../hooks/useToast';
import type { AppTheme } from '../../../../theme/theme.types';
import { useAppContext } from '../../../../context/AppContext';
import { useParlour } from '../../../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../../../backend/modules/pharmacy/hook/usePharmacy';
import { getSelectedBusinessId } from '../../../../backend/modules/shared/hook/useModuleService';
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog';
import { parseYmd, toYmd } from '../../../../utils/dateRange';
import { CustomerPickerSheet } from '../../shared/customer/CustomerPickerSheet';
import { OptionSheet } from '../../shared/detail/parts/OptionSheet';
import { dayLabelOf, statusLabel as orderStatusLabel } from '../../orders/order.model';
import { STATUS_LABEL as APPOINTMENT_STATUS_LABEL } from '../../appointments/appointment.model';
import { BillDetailBase } from './BillDetailBase';
import { useBillDetailForm, type QuickAddPick } from './useBillDetailForm';
import type { QuickBillItem } from './quickItem';
import { configFor, type BillModuleKey } from './billDetail.modules';
import { type BillDetailItem } from './billDetail.model';
import {
  billStatusLabel,
  billStatusOptions,
  DELETE_FAILED,
  deriveDetailView,
  paymentStatusLabel,
  PAYMENT_STATUSES,
  SAVE_FAILED,
  type DetailMode,
} from './billDetail.view';
import { failureMessage } from '../../shared/detail/actionOutcome';
import {
  AddItemsSheet,
  type AddItemKind,
  type AddItemRow,
  type AddItemSelection,
  type AddItemSource,
} from './AddItemsSheet';
import { openingTab } from './addItemsSheet.view';
import { destinationNote, productNeedsOrder, serviceNeedsAppointment } from './quickAddRouting';

/**
 * One piece of state rather than four booleans — on react-native-web a Modal's portal stays mounted
 * after `visible` flips false and eats taps, so two open at once is a real bug.
 */
type OpenSheet = 'none' | 'customer' | 'billStatus' | 'paymentStatus' | 'addItems';

interface SourceState {
  rows: AddItemRow[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

const EMPTY_SOURCE: SourceState = { rows: [], loading: false, error: null, loaded: false };
const EMPTY_SOURCES: Record<AddItemKind, SourceState> = {
  ORDER: EMPTY_SOURCE,
  APPOINTMENT: EMPTY_SOURCE,
  PRODUCT: EMPTY_SOURCE,
  SERVICE: EMPTY_SOURCE,
};

/** One page is the cap. `PAGE_SIZE` rows in, client-side search over them — see `AddItemsSheet`. */
const PAGE_SIZE = 100;

function stockBadge(quantity: unknown): AddItemRow['badge'] {
  // null is not zero: it means inventory is off or the product is untracked, and "Out of stock"
  // for either would be a lie that stops a sale.
  if (quantity === null || quantity === undefined) return undefined;
  const n = Number(quantity);
  if (!Number.isFinite(n)) return undefined;
  if (n <= 0) return { label: 'Out of stock', tone: 'error' };
  if (n <= 5) return { label: 'Low stock', tone: 'warning' };
  return { label: 'In stock', tone: 'success' };
}

function countLabel(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

function arrayOf(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

interface Props {
  route?: { params?: { billId?: number; mode?: DetailMode } };
  /** Optional, so the web preview can mount the screen with no navigator around it. */
  navigation?: { goBack: () => void; setParams?: (params: Record<string, unknown>) => void };
}

export function BillDetailScreen({ route, navigation }: Props = {}) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const { selectedModule } = useAppContext();

  // Both called unconditionally — a hook behind a conditional reorders the hook list and crashes.
  const parlour = useParlour();
  const pharmacy = usePharmacy();

  const moduleKey: BillModuleKey =
    selectedModule?.toUpperCase() === 'PHARMACY' ? 'PHARMACY' : 'PARLOUR';
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;
  const config = configFor(moduleKey);

  /**
   * ⚠️ Individual callbacks, never `activeModule` itself — it is a fresh object literal every
   * render, so an effect depending on it re-runs forever. The order screen hit exactly that and
   * issued 56 requests before it was caught.
   */
  const {
    loadBill,
    loadBillableOrders,
    loadBillableAppointments,
    loadProductOptions,
    loadServices,
    createBill,
    updateBill,
    deleteBill,
    updateBillStatus,
    updateBillPayment,
    ensureBillItemFolder,
    attachQuickItemPhotos,
    services: serviceList,
  } = activeModule;

  /**
   * ⚠️ This literal is the whole API surface the form hook gets. A method left out of it is not a
   * type error and not a runtime error — `useBillDetailForm` guards the optional ones with `?.` and
   * simply does nothing. Leaving the two photo methods out cost a silent no-op upload: the bill
   * saved, no warning fired, and the line came back with `dmsFolderId: null`.
   */
  const moduleApi = useMemo(
    () => ({
      createBill,
      updateBill,
      deleteBill,
      updateBillStatus,
      updateBillPayment,
      ensureBillItemFolder,
      attachQuickItemPhotos,
    }),
    [
      createBill,
      updateBill,
      deleteBill,
      updateBillStatus,
      updateBillPayment,
      ensureBillItemFolder,
      attachQuickItemPhotos,
    ],
  );

  const billId = route?.params?.billId;
  const [mode, setMode] = useState<DetailMode>(route?.params?.mode ?? 'view');
  const [item, setItem] = useState<BillDetailItem | null>(null);
  const [loading, setLoading] = useState(mode !== 'add');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<OpenSheet>('none');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);
  const [sources, setSources] = useState<Record<AddItemKind, SourceState>>(EMPTY_SOURCES);

  useEffect(() => {
    let alive = true;
    void getSelectedBusinessId().then((id) => {
      if (alive) setBusinessId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  const fetchBill = useCallback(async () => {
    if (billId == null) {
      setLoadError('No bill was specified.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const result = await loadBill(billId);
    if (result.success) setItem(result.data as BillDetailItem);
    else setLoadError(result.error);
    setLoading(false);
  }, [billId, loadBill]);

  useEffect(() => {
    if (mode === 'add') return;
    void fetchBill();
  }, [mode, fetchBill]);

  const onSaved = useCallback(
    (saved: BillDetailItem) => {
      showToast(mode === 'add' ? 'Bill created' : 'Bill updated', 'success');
      if (mode === 'add') {
        navigation?.goBack();
        return;
      }
      if (saved) setItem(saved);
      setMode('view');
      navigation?.setParams?.({ mode: 'view' });
    },
    [mode, navigation, showToast],
  );

  /**
   * The server's copy of the bill, from a save that is not over yet.
   *
   * Bare on purpose — no toast, no mode change. `onSaved` cannot stand in for it: it says "Bill
   * updated" and forces view mode, and the one caller of this is the two-call save whose payment
   * committed and whose status was then refused, which is about to toast an error instead. All this
   * asks is that `item` stop being the pre-payment bill.
   *
   * It does not touch the form, and cannot: this arrives from inside `save`, with the edit form
   * still on screen and the user's status pick still in it, and `useBillDetailForm` refuses to
   * fill the form from `item` for as long as the mode is 'edit'. The fill happens later, when the
   * screen leaves edit mode — and it is only then that this matters, because that fill reads
   * `item`. Leaving edit also refetches, so most of the time the fresh bill would arrive anyway;
   * what this covers is the time it does not. A refetch that FAILS leaves `hasItem` true, so
   * `deriveDetailView` still answers READY and the screen keeps showing whatever `item` was — the
   * committed payment with this, the bill as it stood before the payment without it.
   */
  const onServerState = useCallback((saved: BillDetailItem) => {
    setItem(saved);
  }, []);

  const onDeleted = useCallback(() => {
    showToast('Bill deleted', 'success');
    navigation?.goBack();
  }, [navigation, showToast]);

  const engine = useBillDetailForm({
    mode,
    item,
    moduleApi,
    businessId,
    onSaved,
    onServerState,
    onDeleted,
  });

  const customerId = engine.form.customerId;

  // ── The four Add-items lists ───────────────────────────────────────────────

  const patchSource = useCallback((kind: AddItemKind, patch: Partial<SourceState>) => {
    setSources((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));
  }, []);

  /**
   * Fetch one of the four lists.
   *
   * The two record lists are scoped to the customer and pass this bill's own `billId` when editing:
   * without it the orders already ON the bill are `isBilled = true` and get filtered out of their
   * own picker, so the user cannot see or un-tick the lines in front of them.
   */
  const loadSource = useCallback(
    async (kind: AddItemKind) => {
      patchSource(kind, { loading: true, error: null });
      const ownBillId = mode === 'add' ? undefined : (item?.id ?? undefined);

      if (kind === 'ORDER' || kind === 'APPOINTMENT') {
        if (customerId == null) {
          patchSource(kind, { loading: false, loaded: true, rows: [] });
          return;
        }
        const isOrder = kind === 'ORDER';
        const result = isOrder
          ? await loadBillableOrders(customerId, { billId: ownBillId, limit: PAGE_SIZE })
          : await loadBillableAppointments(customerId, { billId: ownBillId, limit: PAGE_SIZE });

        if (!result.success) {
          patchSource(kind, {
            loading: false,
            loaded: true,
            error: result.error,
          });
          return;
        }
        const rows = arrayOf(result.data).map((r): AddItemRow => {
          const status = String((isOrder ? r.orderStatus : r.appointmentStatus) ?? '');
          const items = arrayOf(
            isOrder
              ? (r.orderedProductItemsWithDetails ?? r.orderItems)
              : (r.appointmentItems ?? r.appointedServiceItems),
          ).length;
          const when = String(
            (isOrder ? r.orderDate : (r.appointmentDateTime ?? r.appointmentDate)) ?? '',
          );
          return {
            id: Number(r.id),
            title: String((isOrder ? r.orderNumber : r.appointmentNumber) ?? `#${String(r.id)}`),
            subtitle: [dayLabelOf(when || null), countLabel(items, isOrder ? 'item' : 'service')]
              .filter(Boolean)
              .join(' · '),
            amount: Number(r.totalAmount ?? 0),
            badge: status
              ? {
                  label: isOrder
                    ? orderStatusLabel(status)
                    : (APPOINTMENT_STATUS_LABEL[status] ?? status),
                  tone: 'info',
                }
              : undefined,
            raw: r,
          };
        });
        patchSource(kind, { loading: false, loaded: true, rows });
        return;
      }

      if (kind === 'PRODUCT') {
        const result = await loadProductOptions(PAGE_SIZE);
        if (!result.success) {
          patchSource(kind, {
            loading: false,
            loaded: true,
            error: result.error,
          });
          return;
        }
        const rows = arrayOf(result.data).map((p): AddItemRow => {
          const needsOrder = productNeedsOrder(p);
          return {
            id: Number(p.id),
            title: String(p.name ?? ''),
            subtitle: String(p.brand ?? ''),
            amount: Number(p.price ?? 0),
            badge: stockBadge(p.availableQuantity),
            note: destinationNote(needsOrder, 'PRODUCT'),
            raw: p,
          };
        });
        patchSource(kind, { loading: false, loaded: true, rows });
        return;
      }

      // Services have no options endpoint of their own, so this is the shared list loader and the
      // rows arrive through the hook's `services` state rather than a return value.
      await loadServices(1, PAGE_SIZE);
      patchSource(kind, { loading: false, loaded: true });
    },
    [
      mode,
      item,
      customerId,
      patchSource,
      loadBillableOrders,
      loadBillableAppointments,
      loadProductOptions,
      loadServices,
    ],
  );

  /** Changing the customer invalidates both record lists — they are scoped to a person. */
  useEffect(() => {
    setSources((prev) => ({ ...prev, ORDER: EMPTY_SOURCE, APPOINTMENT: EMPTY_SOURCE }));
  }, [customerId]);

  const onTabShown = useCallback(
    (kind: AddItemKind) => {
      const source = sources[kind];
      if (source.loaded || source.loading) return;
      void loadSource(kind);
    },
    [sources, loadSource],
  );

  // Whichever tab the sheet will actually open on has to be fetched when it opens, rather than only
  // when a tab is tapped. That tab is no longer always Orders — a bill with no customer opens on the
  // Catalog instead, because the records list cannot fill without one. Asking `openingTab` rather
  // than repeating the choice here is what keeps the fetch and the tab from drifting apart.
  useEffect(() => {
    if (sheet !== 'addItems') return;
    onTabShown(openingTab(engine.form.customerId != null).kind);
  }, [sheet, onTabShown, engine.form.customerId]);

  const serviceRows = useMemo<AddItemRow[]>(
    () =>
      arrayOf(serviceList).map((s) => {
        const needsAppointment = serviceNeedsAppointment(s);
        return {
          id: Number(s.id),
          title: String(s.name ?? ''),
          subtitle: s.duration ? `${String(s.duration)} min` : '',
          amount: Number(s.price ?? 0),
          badge:
            s.availability === false
              ? { label: 'Unavailable', tone: 'muted' as const }
              : { label: 'Available', tone: 'success' as const },
          note: destinationNote(needsAppointment, 'SERVICE'),
          raw: s,
        };
      }),
    [serviceList],
  );

  const attachedByKind = useMemo(() => {
    const map: Record<AddItemKind, number[]> = {
      ORDER: [],
      APPOINTMENT: [],
      PRODUCT: [],
      SERVICE: [],
    };
    // QUICK lines are skipped, and must be: they all carry `refId: 0`, so pushing them would mark
    // the catalog row with id 0 as already-added — and there is no catalog row to re-add anyway.
    for (const line of engine.form.lines) {
      if (line.kind === 'QUICK') continue;
      map[line.kind].push(line.refId);
    }
    return map;
  }, [engine.form.lines]);

  /** The ad-hoc lines already on the bill, so the sheet's empty state can say so. */
  const attachedQuickItems = useMemo(
    () =>
      engine.form.lines
        .filter((l) => l.kind === 'QUICK' && l.quick)
        .map((l) => l.quick as QuickBillItem),
    [engine.form.lines],
  );

  const sheetSources = useMemo<Record<AddItemKind, AddItemSource>>(() => {
    const build = (kind: AddItemKind, rows: AddItemRow[]): AddItemSource => ({
      rows,
      loading: sources[kind].loading,
      error: sources[kind].error,
      alreadyAdded: attachedByKind[kind],
      onRetry: () => {
        void loadSource(kind);
      },
    });
    return {
      ORDER: build('ORDER', sources.ORDER.rows),
      APPOINTMENT: build('APPOINTMENT', sources.APPOINTMENT.rows),
      PRODUCT: build('PRODUCT', sources.PRODUCT.rows),
      SERVICE: build('SERVICE', serviceRows),
    };
  }, [sources, serviceRows, attachedByKind, loadSource]);

  const onAddItems = useCallback(
    (selection: AddItemSelection) => {
      if (selection.ORDER.length) {
        engine.attachRecords(
          'ORDER',
          selection.ORDER.map((r) => r.raw as Record<string, unknown>),
        );
      }
      if (selection.APPOINTMENT.length) {
        engine.attachRecords(
          'APPOINTMENT',
          selection.APPOINTMENT.map((r) => r.raw as Record<string, unknown>),
        );
      }
      const toPick = (row: AddItemRow, needsRecord: boolean): QuickAddPick => ({
        id: row.id,
        name: row.title,
        price: row.amount,
        needsRecord,
      });
      if (selection.PRODUCT.length) {
        engine.quickAdd(
          'PRODUCT',
          selection.PRODUCT.map((r) => toPick(r, productNeedsOrder(r.raw as object))),
        );
      }
      if (selection.SERVICE.length) {
        engine.quickAdd(
          'SERVICE',
          selection.SERVICE.map((r) => toPick(r, serviceNeedsAppointment(r.raw as object))),
        );
      }
    },
    [engine],
  );

  // ── Mode, save, delete ─────────────────────────────────────────────────────

  const view = deriveDetailView({
    mode,
    loading,
    saving: engine.saving,
    hasError: !!loadError,
    hasItem: !!item,
  });

  const onEdit = useCallback(() => {
    setMode('edit');
    navigation?.setParams?.({ mode: 'edit' });
  }, [navigation]);

  const onBack = useCallback(() => {
    if (mode === 'edit' && billId != null) {
      setMode('view');
      navigation?.setParams?.({ mode: 'view' });
      return;
    }
    navigation?.goBack();
  }, [mode, billId, navigation]);

  const onSave = useCallback(async () => {
    const result = await engine.save();

    // `if (!result.success && result.error)` guarded this, and the second half is what made a
    // refused save silent: a bill refused by a 2xx body arrives with `error` empty, so nothing
    // was toasted and the screen sat there looking saved. `failureMessage` has no such branch.
    const problem = failureMessage(result, SAVE_FAILED);
    if (problem) {
      showToast(problem, 'error');
      return;
    }
    // The bill saved; only a photo did not. A warning, never an error — telling the user to retry
    // a write that already landed would have them save the same bill twice.
    if (result.warning) showToast(result.warning, 'warning');
  }, [engine, showToast]);

  const onConfirmDelete = useCallback(async () => {
    setConfirmDelete(false);
    const problem = failureMessage(await engine.remove(), DELETE_FAILED);
    if (problem) showToast(problem, 'error');
  }, [engine, showToast]);

  if (view === 'LOADING') {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (view === 'ERROR') {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'left', 'right']}>
        <Text style={styles.errorTitle}>Could not load this bill</Text>
        <Text style={styles.errorBody}>{loadError}</Text>
        <Pressable
          onPress={() => {
            void fetchBill();
          }}
          accessibilityRole="button"
          style={styles.retry}
        >
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <>
      <BillDetailBase
        mode={mode}
        item={item}
        form={engine.form}
        errors={engine.errors}
        slots={{ moduleLabel: config.moduleLabel }}
        saving={engine.saving}
        onFieldChange={engine.setField}
        onAmountChange={engine.setAmount}
        onDiscountType={engine.setDiscountType}
        onDiscountValue={engine.setDiscountValue}
        onPickCustomer={() => setSheet('customer')}
        onPickBillStatus={() => setSheet('billStatus')}
        onPickPaymentStatus={() => setSheet('paymentStatus')}
        onPickDate={() => setPickingDate(true)}
        onAddItems={() => setSheet('addItems')}
        onRemoveLine={engine.removeLine}
        onBack={onBack}
        onEdit={onEdit}
        onSave={() => {
          void onSave();
        }}
        onDelete={() => setConfirmDelete(true)}
      />

      {/* The OS date dialog, not one of ours — `toYmd` reads the Date's parts rather than slicing
          an ISO string, which would give the UTC day (the previous one before 05:30 IST). */}
      {pickingDate ? (
        <DateTimePicker
          value={engine.form.billDate ? parseYmd(engine.form.billDate) : new Date()}
          mode="date"
          onChange={(_event: unknown, picked?: Date) => {
            setPickingDate(false);
            if (picked) engine.setField('billDate', toYmd(picked));
          }}
        />
      ) : null}

      <CustomerPickerSheet
        visible={sheet === 'customer'}
        businessId={businessId}
        onClose={() => setSheet('none')}
        onSelect={engine.setCustomer}
      />

      <OptionSheet
        visible={sheet === 'billStatus'}
        title="Bill status"
        options={billStatusOptions(engine.form.billStatus).map((s) => ({
          value: s,
          label: billStatusLabel(s),
          sub: s === 'CANCELLED' ? 'Releases every item and returns the stock' : undefined,
        }))}
        selected={engine.form.billStatus}
        onSelect={(value) => engine.setField('billStatus', value)}
        onClose={() => setSheet('none')}
      />

      <OptionSheet
        visible={sheet === 'paymentStatus'}
        title="Payment status"
        options={PAYMENT_STATUSES.map((s) => ({ value: s, label: paymentStatusLabel(s) }))}
        selected={engine.form.paymentStatus}
        onSelect={(value) => engine.setField('paymentStatus', value)}
        onClose={() => setSheet('none')}
      />

      <AddItemsSheet
        visible={sheet === 'addItems'}
        customerName={engine.form.customerName}
        hasCustomer={engine.form.customerId != null}
        sources={sheetSources}
        onAdd={onAddItems}
        onTabShown={onTabShown}
        quickItems={attachedQuickItems}
        onAddQuickItems={engine.addQuickItems}
        onClose={() => setSheet('none')}
      />

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this bill?"
        message="Auto-generated orders and appointments are deleted with it. Anything you attached is released back into the pickers, and bare lines are restocked."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          void onConfirmDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

export default BillDetailScreen;

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 24,
      backgroundColor: theme.palette.background,
    },
    errorTitle: { fontSize: 16, fontWeight: '700', color: theme.palette.onBackground },
    errorBody: { fontSize: 13, color: theme.palette.muted, textAlign: 'center' },
    retry: {
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.colors.primary,
    },
    retryLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.onAccent ?? '#FFFFFF' },
  });
}
