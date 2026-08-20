import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useAppContext } from '../../../../context/AppContext';
import { useParlour } from '../../../../backend/modules/parlour';
import { usePharmacy } from '../../../../backend/modules/pharmacy';
import { useTabConfig } from '../../../../backend/tab-config';
import { getSelectedBusinessId } from '../../../../backend/modules/shared/hook/useModuleService';
import { getPersonService } from '../../../../backend/person';
import type { ExpenseDto } from '../../../../backend/modules/shared/expense.types';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_RECURRENCES,
  PAYMENT_METHODS,
} from '../../../../backend/modules/shared/expense.types';
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog';
import { OptionSheet } from '../../shared/detail/parts/OptionSheet';
import { TIME_SLOTS, formatClock } from '../../shared/detail/wallClock';
import { EmployeePickerSheet } from '../../shared/employee/EmployeePickerSheet';
import {
  employeeName as resolveEmployeeName,
  toEmployeeOptions,
  type EmployeeOption,
} from '../../shared/employee/employeePicker.model';
import { ExpenseDetailBase } from './ExpenseDetailBase';
import { parlourExpenseSlots } from './ParlourExpenseDetail';
import { pharmacyExpenseSlots } from './PharmacyExpenseDetail';
import { useExpenseDetailForm } from './useExpenseDetailForm';
import { toReceiptRows } from './receipts';
import {
  DELETE_BODY,
  detailBanner,
  DELETE_CTA,
  DELETE_TITLE,
  REIMBURSE_BODY,
  REIMBURSE_CONFIRM,
  REIMBURSE_TITLE,
  type DetailMode,
} from './expenseDetail.view';

/**
 * The Expense Detail route: which record, which module, which sheets are open.
 *
 * Every decision it makes is a call into `expenseDetail.model` / `.view`, both RN-free and tested.
 * The three sheets are gated on state rather than on a Modal's `visible` prop, and only one is ever
 * mounted — on react-native-web a dismissed portal stays mounted and silently eats taps.
 */

interface RouteParams {
  expenseId?: number;
  mode?: DetailMode;
}

interface Props {
  route?: { params?: RouteParams };
  navigation?: {
    goBack: () => void;
    setParams?: (params: Partial<RouteParams>) => void;
  };
}

type SheetKind = null | 'category' | 'payment' | 'recurrence' | 'time' | 'employee';
type DialogKind = null | 'delete' | 'reimburse';

export function ExpenseDetailScreen({ route, navigation }: Props) {
  const params = route?.params ?? {};
  const [mode, setMode] = useState<DetailMode>(params.mode ?? 'view');
  const expenseId = params.expenseId ?? null;

  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const moduleKey = String(selectedModule || '').toUpperCase();
  // Both hooks are always called — hook order is not negotiable — and only one is used.
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;
  const slots = moduleKey === 'PHARMACY' ? pharmacyExpenseSlots() : parlourExpenseSlots();

  const { expenseCategoryEnabled, resolved, businessId: tabBusinessId } = useTabConfig();
  // ⚠️ Flags fail OPEN before a snapshot lands, unlike `tabs` — `UNRESOLVED_SNAPSHOT` was applied
  // to tabs only, so every flag reads `true` until one arrives and forever outside a provider (the
  // web preview). Copy `useComboEnabled`'s shape rather than the raw flag: showing the category
  // picker on a business that has it off would display a choice the server then silently rewrites
  // to OTHER, with no error to notice.
  const categoryEnabled = resolved && tabBusinessId != null && expenseCategoryEnabled === true;

  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    void getSelectedBusinessId().then((id) => {
      if (alive) setSelectedBusinessId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  const [item, setItem] = useState<ExpenseDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  const loadExpense = activeModule.loadExpense;

  useEffect(() => {
    if (mode === 'add' || expenseId == null) return;
    let alive = true;
    setLoading(true);
    setLoadError(null);
    loadExpense(expenseId)
      .then((res) => {
        if (!alive) return;
        if (res?.success) setItem((res.data as ExpenseDto) ?? null);
        else setLoadError(res?.error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [expenseId, mode, loadExpense]);

  /**
   * The staff list, fetched once per business.
   *
   * Loaded in BOTH writing and reading modes, not just while editing: the read screen has to render
   * "Reimburse to" as a name, and it only holds an `employments(id)`. Without this the detail of a
   * settled reimbursement would say "Employee #42".
   */
  useEffect(() => {
    if (selectedBusinessId == null) return;
    let alive = true;
    setEmployeesLoading(true);
    setEmployeesError(null);
    getPersonService()
      .getActiveEmployees(selectedBusinessId)
      .then((res) => {
        if (!alive) return;
        if (res?.success) setEmployees(toEmployeeOptions(res.data));
        else setEmployeesError(res?.error || 'Could not load staff.');
      })
      .finally(() => {
        if (alive) setEmployeesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedBusinessId]);

  const engine = useExpenseDetailForm({
    mode,
    item,
    moduleApi: activeModule,
    businessId: selectedBusinessId ?? null,
    onSaved: (saved) => {
      if (saved) setItem(saved);
      if (mode === 'edit') setMode('view');
      else navigation?.goBack();
    },
    onDeleted: () => navigation?.goBack(),
    onReimbursed: (updated) => {
      if (updated) setItem(updated);
    },
  });

  const employeeName = useMemo(
    () => resolveEmployeeName(engine.form.paidByEmployeeId ?? item?.paidByEmployeeId, employees),
    [engine.form.paidByEmployeeId, item?.paidByEmployeeId, employees],
  );

  // Sheet option lists are built from the shared constant arrays; `useMemo` so their identity is
  // stable — an array rebuilt each render into a child's prop is how this repo has shipped a
  // render loop before.
  const categoryOptions = useMemo(
    () => EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
    [],
  );
  const paymentOptions = useMemo(
    () => PAYMENT_METHODS.map((p) => ({ value: p.value, label: p.label })),
    [],
  );
  const recurrenceOptions = useMemo(
    () => EXPENSE_RECURRENCES.map((r) => ({ value: r.value, label: r.label })),
    [],
  );
  const timeOptions = useMemo(
    () => TIME_SLOTS.map((t) => ({ value: t, label: formatClock(t) })),
    [],
  );

  const closeSheet = useCallback(() => setSheet(null), []);

  const receiptRows = useMemo(
    () => toReceiptRows(engine.form.files, engine.pendingFiles),
    [engine.form.files, engine.pendingFiles],
  );

  /**
   * Open a saved receipt.
   *
   * Handed to the OS rather than rendered in-app: a receipt can be a PDF, and building a viewer for
   * one is a feature, not a detail of this screen. `Linking` gives the user their own PDF reader or
   * browser, which is where they can already zoom, print and share it.
   *
   * A pending row has no URL yet — the strip disables those, so this is only reached for saved ones.
   */
  const openReceipt = useCallback((row: { url: string | null; name: string }) => {
    if (!row.url) return;
    void Linking.openURL(row.url).catch(() => {
      // A receipt that will not open is worth saying out loud; it usually means the DMS URL needs
      // an auth the external app does not carry.
      engine.setSaveError(`Could not open ${row.name}.`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.host}>
      <ExpenseDetailBase
        mode={mode}
        item={item}
        form={engine.form}
        errors={engine.errors}
        slots={slots}
        categoryEnabled={!!categoryEnabled}
        employeeName={employeeName}
        onFieldChange={engine.setField}
        onChangeReimbursable={engine.setReimbursable}
        onPickCategory={() => setSheet('category')}
        onPickPaymentMethod={() => setSheet('payment')}
        onPickRecurrence={() => setSheet('recurrence')}
        onPickTime={() => setSheet('time')}
        onPickEmployee={() => setSheet('employee')}
        receiptRows={receiptRows}
        uploadProgress={engine.uploadProgress}
        error={detailBanner(engine.saveError, loadError)}
        onDismissError={() => {
          // Clear BOTH, not just whichever is showing: dismissing means "I have read it", and
          // leaving the other behind would pop a second banner the user did not do anything to
          // provoke.
          engine.setSaveError(null);
          setLoadError(null);
        }}
        onAddReceiptPhoto={engine.pickReceiptPhoto}
        onAddReceiptDocument={engine.pickReceiptDocument}
        onRemoveReceipt={engine.removeReceipt}
        onOpenReceipt={openReceipt}
        onBack={() => (mode === 'edit' ? setMode('view') : navigation?.goBack())}
        onSave={engine.save}
        onEdit={() => setMode('edit')}
        onDelete={() => setDialog('delete')}
        onMarkReimbursed={() => setDialog('reimburse')}
        saving={engine.saving || (loading && mode !== 'add') || !!loadError}
      />

      {/* One sheet at a time — never two Modals mounted together. */}
      {sheet === 'category' ? (
        <OptionSheet
          visible
          title="Category"
          options={categoryOptions}
          selected={engine.form.category}
          searchPlaceholder="Search category"
          onSelect={(v) => engine.setField('category', v as never)}
          onClose={closeSheet}
        />
      ) : null}

      {sheet === 'payment' ? (
        <OptionSheet
          visible
          title="Payment Method"
          options={paymentOptions}
          selected={engine.form.paymentMethod ?? undefined}
          onSelect={(v) => engine.setField('paymentMethod', v as never)}
          onClose={closeSheet}
        />
      ) : null}

      {sheet === 'recurrence' ? (
        <OptionSheet
          visible
          title="Recurring"
          options={recurrenceOptions}
          selected={engine.form.recurrence}
          onSelect={(v) => engine.setField('recurrence', v as never)}
          onClose={closeSheet}
        />
      ) : null}

      {sheet === 'time' ? (
        <OptionSheet
          visible
          title="Time"
          options={timeOptions}
          selected={engine.form.time}
          searchPlaceholder="Jump to a time"
          onSelect={(v) => engine.setField('time', v)}
          onClose={closeSheet}
        />
      ) : null}

      {sheet === 'employee' ? (
        <EmployeePickerSheet
          visible
          options={employees}
          selected={engine.form.paidByEmployeeId}
          loading={employeesLoading}
          error={employeesError}
          onSelect={(option) => engine.setField('paidByEmployeeId', option.id)}
          onClose={closeSheet}
        />
      ) : null}

      {dialog === 'delete' ? (
        <ConfirmDialog
          visible
          title={DELETE_TITLE}
          message={DELETE_BODY}
          confirmLabel={DELETE_CTA}
          danger
          onConfirm={() => {
            setDialog(null);
            void engine.remove();
          }}
          onCancel={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'reimburse' ? (
        <ConfirmDialog
          visible
          title={REIMBURSE_TITLE}
          message={REIMBURSE_BODY}
          confirmLabel={REIMBURSE_CONFIRM}
          onConfirm={() => {
            setDialog(null);
            void engine.markReimbursed();
          }}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </View>
  );
}

// The host wraps the base plus its sheets and dialogs; the base owns every other style.
const styles = StyleSheet.create({ host: { flex: 1 } });
