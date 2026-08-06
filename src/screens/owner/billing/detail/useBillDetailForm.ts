import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildBillPayload, toFormState, type BillDetailItem } from './billDetail.model';
import type { BillFormState } from './billDetail.model';
import {
  alsoNeedsStatusPatch,
  contentKey,
  errorSummary,
  hasErrors,
  saveRoute,
  validateBill,
  type DetailMode,
  type SaveShape,
} from './billDetail.view';
import { attachedLine, newBareLine, type BillLine } from './billLines';
import { settlementField, type DiscountType } from './billMoney';

interface SaveResult {
  success: boolean;
  data?: unknown;
  error?: string | null;
  code?: string;
}

/**
 * ⚠️ Three write endpoints, not one. Which of them a save uses is decided by `saveRoute`, for the
 * reasons written out there — the short version is that the full PUT cannot express a payment
 * change and turns `billStatus: CANCELLED` into a cascade.
 */
interface ModuleApi {
  createBill(data: Record<string, unknown>): Promise<SaveResult>;
  updateBill(billId: number, data: Record<string, unknown>): Promise<SaveResult>;
  deleteBill(id: number): Promise<SaveResult>;
  updateBillStatus?(id: number, billStatus: string): Promise<SaveResult>;
  updateBillPayment?(
    id: number,
    paymentStatus: string,
    options?: { paidAmount?: number; refundedAmount?: number },
  ): Promise<SaveResult>;
}

interface UseBillDetailFormInput {
  mode: DetailMode;
  item: BillDetailItem | null;
  moduleApi: ModuleApi;
  businessId: number | null;
  onSaved: (saved: BillDetailItem) => void;
  onDeleted: () => void;
}

/** A catalog row the user quick-added, already flattened by the picker. */
export interface QuickAddPick {
  id: number;
  name: string;
  price: number;
  /** Whether saving will spawn an order/appointment for it. See `quickAddRouting`. */
  needsRecord: boolean;
}

function shapeOf(form: BillFormState): SaveShape {
  return {
    billStatus: form.billStatus,
    paymentStatus: form.paymentStatus,
    paidAmount: form.paidAmount,
    refundedAmount: form.refundedAmount,
    content: contentKey(form),
  };
}

/**
 * Form state and the save/delete paths for the Bill Detail screen.
 *
 * Thin in the same way as its siblings — every decision lives in `billDetail.model`,
 * `billDetail.view`, `billLines` or `billMoney`, all RN-free and tested — with one exception it
 * cannot delegate: this hook owns the CHOICE OF ENDPOINT, because only it holds both the bill as
 * fetched and the bill as edited. `saveRoute` decides; this executes.
 */
export function useBillDetailForm({
  mode,
  item,
  moduleApi,
  businessId,
  onSaved,
  onDeleted,
}: UseBillDetailFormInput) {
  const [form, setForm] = useState<BillFormState>(() => toFormState(null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * The bill as it was fetched, reduced to the fields the routing decision reads.
   *
   * Kept as its own state rather than recomputed from `item`: after a PATCH the server returns the
   * updated bill, and the baseline has to move with it or the next save would re-send a change that
   * already landed.
   */
  const [baseline, setBaseline] = useState<SaveShape | null>(null);

  const itemId = item?.id ?? null;
  useEffect(() => {
    if (mode === 'add' || !item) return;
    const next = toFormState(item);
    setForm(next);
    setBaseline(shapeOf(next));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, mode]);

  const setField = useCallback(
    (field: 'billStatus' | 'paymentStatus' | 'billDate' | 'notes', value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const setAmount = useCallback(
    (field: 'tips' | 'taxRate' | 'paidAmount' | 'refundedAmount', value: number) => {
      setForm((prev) => ({ ...prev, [field]: Number.isFinite(value) ? value : 0 }));
    },
    [],
  );

  const setDiscountType = useCallback((type: DiscountType) => {
    setForm((prev) => ({ ...prev, discount: { ...prev.discount, type } }));
  }, []);

  const setDiscountValue = useCallback((value: number) => {
    setForm((prev) => ({
      ...prev,
      discount: { ...prev.discount, value: Number.isFinite(value) ? value : 0 },
    }));
  }, []);

  const setCustomer = useCallback(
    (customer: { id: number; name: string; email: string; phone: string }) => {
      setForm((prev) => ({
        ...prev,
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
      }));
    },
    [],
  );

  /** Attach picked orders or appointments, skipping any already on the bill. */
  const attachRecords = useCallback(
    (kind: 'ORDER' | 'APPOINTMENT', records: Record<string, unknown>[]) => {
      setForm((prev) => {
        const present = new Set(prev.lines.filter((l) => l.kind === kind).map((l) => l.refId));
        const additions = records
          .map((r) => attachedLine(kind, r))
          .filter((l): l is BillLine => l !== null && !present.has(l.refId));
        return additions.length ? { ...prev, lines: [...prev.lines, ...additions] } : prev;
      });
    },
    [],
  );

  /**
   * Add quick-picked catalog rows as bare lines.
   *
   * Order-required rows are added as bare lines TOO, and that is not a bug: the server reads the
   * flag off the catalog row and folds them into an auto-generated order on save. Sending them in
   * `customProducts` is exactly how a client asks for that — the picker's caption says which rows
   * will take that route, so the outcome is not a surprise.
   */
  const quickAdd = useCallback((kind: 'PRODUCT' | 'SERVICE', picks: QuickAddPick[]) => {
    setForm((prev) => {
      const present = new Set(prev.lines.filter((l) => l.kind === kind).map((l) => l.refId));
      const additions = picks
        .filter((p) => !present.has(p.id))
        .map((p) => newBareLine(kind, p.id, p.name, p.price, null));
      return additions.length ? { ...prev, lines: [...prev.lines, ...additions] } : prev;
    });
  }, []);

  const removeLine = useCallback((index: number) => {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  }, []);

  /** Whether anything at all has changed. Drives nothing on screen; used by the save path. */
  const dirty = useMemo(() => {
    if (!baseline) return true;
    const next = shapeOf(form);
    return (
      baseline.content !== next.content ||
      baseline.billStatus !== next.billStatus ||
      baseline.paymentStatus !== next.paymentStatus ||
      baseline.paidAmount !== next.paidAmount ||
      baseline.refundedAmount !== next.refundedAmount
    );
  }, [baseline, form]);

  const save = useCallback(async (): Promise<SaveResult> => {
    const found = validateBill(form);
    setErrors(found);
    if (hasErrors(found)) {
      return { success: false, error: errorSummary(found) };
    }

    setSaving(true);
    setSaveError(null);
    try {
      const isAdd = mode === 'add' || item?.id == null;
      if (isAdd) {
        if (businessId == null) return { success: false, error: 'No business is selected.' };
        const result = await moduleApi.createBill(buildBillPayload(form, businessId));
        if (!result.success) {
          setSaveError(result.error || 'Could not create this bill.');
          return result;
        }
        onSaved((result.data as BillDetailItem) ?? null);
        return result;
      }

      const billId = item.id as number;
      const next = shapeOf(form);
      const route = baseline ? saveRoute(baseline, next) : 'PUT';

      let result: SaveResult;
      if (route === 'PATCH_PAYMENT') {
        if (!moduleApi.updateBillPayment) {
          // Not a fallback-to-PUT situation. Both modules implement this endpoint, so a missing one
          // is a wiring fault — and the PUT would silently do the wrong thing rather than fail.
          return { success: false, error: 'This module cannot record a payment change.' };
        }
        const field = settlementField(form.paymentStatus);
        result = await moduleApi.updateBillPayment(billId, form.paymentStatus, {
          ...(field === 'paidAmount' ? { paidAmount: form.paidAmount } : {}),
          ...(field === 'refundedAmount' ? { refundedAmount: form.refundedAmount } : {}),
        });

        // Both axes moved in one save. The payment went first because it is the one a PUT cannot
        // express; the status follows as its own call.
        if (result.success && baseline && alsoNeedsStatusPatch(baseline, next)) {
          if (!moduleApi.updateBillStatus) {
            return { success: false, error: 'The payment was saved, but the status was not.' };
          }
          const second = await moduleApi.updateBillStatus(billId, form.billStatus);
          if (!second.success) {
            setSaveError(second.error || 'The payment was saved, but the status was not.');
            return second;
          }
          result = second;
        }
      } else if (route === 'PATCH_STATUS') {
        if (!moduleApi.updateBillStatus) {
          return { success: false, error: 'This module cannot change a bill status.' };
        }
        result = await moduleApi.updateBillStatus(billId, form.billStatus);
      } else {
        result = await moduleApi.updateBill(billId, buildBillPayload(form, businessId ?? 0));
      }

      if (!result.success) {
        // STATE_CONFLICT (409) is the one worth reading: CANCELLED → DRAFT is refused.
        setSaveError(result.error || 'Could not save this bill.');
        return result;
      }

      const saved = (result.data as BillDetailItem) ?? (item as BillDetailItem);
      setBaseline(shapeOf(toFormState(saved)));
      onSaved(saved);
      return { success: true, data: saved };
    } finally {
      setSaving(false);
    }
  }, [form, mode, item, businessId, moduleApi, onSaved, baseline]);

  const remove = useCallback(async (): Promise<SaveResult> => {
    if (item?.id == null) {
      return { success: false, error: 'This bill has not been saved yet.' };
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await moduleApi.deleteBill(item.id);
      if (!result.success) {
        setSaveError(result.error || 'Could not delete this bill.');
        return result;
      }
      onDeleted();
      return result;
    } finally {
      setSaving(false);
    }
  }, [item, moduleApi, onDeleted]);

  return {
    form,
    errors,
    saving,
    saveError,
    dirty,
    setField,
    setAmount,
    setDiscountType,
    setDiscountValue,
    setCustomer,
    attachRecords,
    quickAdd,
    removeLine,
    save,
    remove,
  };
}
