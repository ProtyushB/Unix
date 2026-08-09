import { useCallback, useEffect, useState } from 'react';
import type {
  ExpenseDto,
  ExpensePayload,
  ExpenseUpdatePayload,
} from '../../../../backend/modules/shared/expense.types';
import { nowIstParts } from '../../shared/detail/wallClock';
import {
  buildCreatePayload,
  buildUpdatePayload,
  emptyForm,
  toFormState,
  type ExpenseFormState,
} from './expenseDetail.model';
import {
  errorSummary,
  hasErrors,
  reimburseRefusalMessage,
  validateExpense,
  writeRefusalMessage,
  type DetailMode,
} from './expenseDetail.view';

interface SaveResult {
  success: boolean;
  data?: unknown;
  code?: string;
  error?: string | null;
}

/** What this hook needs from the module hook — `activeModule`'s expense slice, structurally. */
interface ModuleApi {
  createExpense(data: ExpensePayload): Promise<SaveResult>;
  updateExpense(id: number, data: ExpenseUpdatePayload): Promise<SaveResult>;
  deleteExpense(id: number): Promise<SaveResult>;
  markExpenseReimbursed(id: number, reimbursedBy?: number | null): Promise<SaveResult>;
}

interface UseExpenseDetailFormInput {
  mode: DetailMode;
  /** The DTO as last fetched. Null in add mode, and until the first load resolves. */
  item: ExpenseDto | null;
  moduleApi: ModuleApi;
  businessId: number | null;
  onSaved: (saved: ExpenseDto | null) => void;
  onDeleted: () => void;
  onReimbursed: (updated: ExpenseDto | null) => void;
}

/**
 * Form state and the four write paths for the Expense Detail screen.
 *
 * Deliberately thin, same rule as its siblings: every decision — what the form looks like for a
 * given DTO, what the payload is, whether it validates, what a refusal says — is a call into
 * `expenseDetail.model` or `expenseDetail.view`, both RN-free and unit-tested. If an `if` appears
 * here that is not `await`/`setState` plumbing, it is in the wrong file.
 *
 * FOUR paths rather than two, because this is the one mutable Stock & Ops record: create, update,
 * delete, and mark-reimbursed. The last is not a field on the update — the server drops
 * `reimbursed` from a PUT — so it is its own call.
 */
export function useExpenseDetailForm({
  mode,
  item,
  moduleApi,
  businessId,
  onSaved,
  onDeleted,
  onReimbursed,
}: UseExpenseDetailFormInput) {
  const [form, setForm] = useState<ExpenseFormState>(() => {
    const now = nowIstParts();
    return emptyForm(now.date, now.time);
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reseed whenever a new record arrives. Keyed on the record's IDENTITY rather than the object, so
  // a re-render that merely re-wraps the same record does not discard what the user has typed.
  const itemId = item?.id ?? null;
  useEffect(() => {
    if (mode === 'add' || !item) return;
    setForm(toFormState(item));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, mode]);

  const setField = useCallback(
    <K extends keyof ExpenseFormState>(field: K, value: ExpenseFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  /**
   * Flip the reimbursable toggle, clearing the employee when it goes off.
   *
   * One action rather than two `setField` calls because they are one decision: a stale
   * `paidByEmployeeId` left behind would trip the REIMBURSEMENT feature gate — which keys off the
   * employee id, NOT the boolean — and 403 an expense the user just said was not reimbursable.
   */
  const setReimbursable = useCallback((next: boolean) => {
    setForm((prev) => ({
      ...prev,
      reimbursable: next,
      paidByEmployeeId: next ? prev.paidByEmployeeId : null,
    }));
  }, []);

  const save = useCallback(async (): Promise<SaveResult> => {
    const found = validateExpense(form);
    setErrors(found);
    if (hasErrors(found)) {
      return { success: false, error: errorSummary(found) };
    }
    if (businessId == null) {
      return { success: false, error: 'No business is selected.' };
    }

    setSaving(true);
    setSaveError(null);
    try {
      const editing = mode === 'edit' && item?.id != null;
      const result = editing
        ? await moduleApi.updateExpense(
            item.id as number,
            buildUpdatePayload(form, businessId, item.id as number),
          )
        : await moduleApi.createExpense(buildCreatePayload(form, businessId));

      if (!result.success) {
        // TAB_DISABLED and FEATURE_DISABLED are both 403s that mean different things and need
        // different actions from the user; `writeRefusalMessage` is where they are told apart.
        setSaveError(writeRefusalMessage(result.code, result.error ?? null));
        return result;
      }
      onSaved((result.data as ExpenseDto) ?? null);
      return { success: true, data: result.data };
    } finally {
      setSaving(false);
    }
  }, [form, mode, item, businessId, moduleApi, onSaved]);

  const remove = useCallback(async (): Promise<SaveResult> => {
    if (item?.id == null) {
      return { success: false, error: 'This expense has not been saved yet.' };
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await moduleApi.deleteExpense(item.id);
      if (!result.success) {
        setSaveError(writeRefusalMessage(result.code, result.error ?? null));
        return result;
      }
      onDeleted();
      return result;
    } finally {
      setSaving(false);
    }
  }, [item, moduleApi, onDeleted]);

  /**
   * Settle the reimbursement.
   *
   * `reimbursedBy` is left null: the client has no trustworthy identity for "who approved this" —
   * the logged-in person is a Person, and this field wants an `employments(id)`. Sending the wrong
   * kind of id would attribute the settlement to whoever happens to hold that employment. Null is
   * what Centrix sends too, and the server accepts it.
   */
  const markReimbursed = useCallback(async (): Promise<SaveResult> => {
    if (item?.id == null) {
      return { success: false, error: 'This expense has not been saved yet.' };
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await moduleApi.markExpenseReimbursed(item.id, null);
      if (!result.success) {
        setSaveError(reimburseRefusalMessage(result.code, result.error ?? null));
        return result;
      }
      onReimbursed((result.data as ExpenseDto) ?? null);
      return result;
    } finally {
      setSaving(false);
    }
  }, [item, moduleApi, onReimbursed]);

  return {
    form,
    errors,
    saving,
    saveError,
    setField,
    setReimbursable,
    setSaveError,
    save,
    remove,
    markReimbursed,
  };
}
