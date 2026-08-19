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
import { attachedLine, newBareLine, newQuickLine, type BillLine } from './billLines';
import { settlementField, type DiscountType } from './billMoney';
import type { QuickBillItem } from './quickItem';
import {
  applyPhotoLinks,
  pendingPhotoItems,
  photoWarning,
  uploadQuickItemPhotos,
  type QuickItemPhotoLink,
} from './quickItemPhotos';

import { FileService } from '../../../../backend/dms/service/file.service';

import type { PendingFile } from '../../shared/detail/pendingFiles';

interface SaveResult {
  success: boolean;
  data?: unknown;
  error?: string | null;
  code?: string;
  /**
   * A photo did not attach. The BILL still saved — this is a warning, never an error, and the
   * screen must toast it as one. Reporting it as a failure would tell the user to try again on a
   * bill that is already written.
   */
  warning?: string | null;
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
  /**
   * Quick Add photos. Optional, and genuinely so: a module wired without them still bills ad-hoc
   * lines perfectly — it just cannot carry a picture, which is the one part of the feature that is
   * decoration rather than money.
   */
  ensureBillItemFolder?(params: {
    businessId: number;
    billId: number;
    lineId: string;
    itemName?: string;
    currentFolderId?: number | null;
  }): Promise<SaveResult>;
  attachQuickItemPhotos?(billId: number, links: QuickItemPhotoLink[]): Promise<SaveResult>;
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

  /**
   * Append the ad-hoc lines the user typed on the Quick Add tab.
   *
   * Deduped by `lineId` rather than by name: two genuinely different items can share a name, and
   * the id is minted per commit, so the only way a duplicate id arrives is the sheet handing back
   * the same list twice.
   */
  const addQuickItems = useCallback((items: QuickBillItem[]) => {
    setForm((prev) => {
      const present = new Set(
        prev.lines.filter((l) => l.kind === 'QUICK').map((l) => l.quick?.lineId),
      );
      const additions = items.filter((i) => !present.has(i.lineId)).map(newQuickLine);
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

  /**
   * Upload any staged quick-item photos, once the bill has an id.
   *
   * Runs AFTER the save on both create and edit, because the DMS folder is named after the bill id
   * and on create that id does not exist until the POST returns. Doing edit differently would be
   * two code paths for one problem.
   *
   * It never throws and never fails the save: by the time this runs the bill is already written, so
   * an error here is a warning about a picture, not a failed bill. The names that did not make it
   * come back in `photoWarning`, which the screen toasts.
   */
  const uploadQuickPhotos = useCallback(
    async (billId: number): Promise<{ warning: string | null; saved?: BillDetailItem }> => {
      const items = form.lines
        .filter((l) => l.kind === 'QUICK' && l.quick)
        .map((l) => l.quick as QuickBillItem);
      if (!items.length || businessId == null) return { warning: null };

      /**
       * ⚠️ Say so rather than returning quietly.
       *
       * These two are optional on `ModuleApi`, and an early `return null` here reads as "this
       * module has no photo support". It is far more often a WIRING fault — the screen assembles
       * `moduleApi` as an object literal, so a method left out of it is neither a type error nor a
       * runtime one. That is not hypothetical: it shipped exactly once, and the symptom was a bill
       * that saved cleanly, warned about nothing, and came back with `dmsFolderId: null`.
       *
       * Only worth saying when there is actually a photo waiting — a module with no photo support
       * must stay silent for the photoless items that are the common case.
       */
      if (!moduleApi.ensureBillItemFolder || !moduleApi.attachQuickItemPhotos) {
        const waiting = pendingPhotoItems(items);
        return {
          warning: waiting.length
            ? `Bill saved — photos are not wired up for this module, so the picture for ${waiting
                .map((i) => i.name)
                .join(', ')} was not attached.`
            : null,
        };
      }

      const { links, failed, saved } = await uploadQuickItemPhotos(
        items,
        { businessId, billId },
        {
          ensureBillItemFolder: moduleApi.ensureBillItemFolder,
          uploadFiles: (files: PendingFile[], folderId: number) =>
            new FileService().createMultipleFiles(files, folderId),
          attachQuickItemPhotos: moduleApi.attachQuickItemPhotos,
        },
      );

      if (links.length) {
        // Fold the file ids back onto the lines and drop the staged files, so a second Save does
        // not re-upload what already landed.
        setForm((prev) => ({
          ...prev,
          lines: prev.lines.map((line) => {
            if (line.kind !== 'QUICK' || !line.quick) return line;
            const [updated] = applyPhotoLinks([line.quick], links);
            return updated === line.quick ? line : { ...line, quick: updated };
          }),
        }));
      }

      return {
        warning: photoWarning(failed),
        saved: (saved as BillDetailItem) ?? undefined,
      };
    },
    [form.lines, businessId, moduleApi],
  );

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

        // The bill exists now, so its DMS folder can finally be named. Photos land here, never
        // before — and a failure past this point is a warning, not a failed create.
        const created = (result.data as BillDetailItem) ?? null;
        const billId = created?.id;
        const photos =
          billId != null ? await uploadQuickPhotos(billId as number) : { warning: null };

        onSaved(photos.saved ?? created);
        return { ...result, warning: photos.warning };
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
        // Guarded exactly like the create path above, and for a worse reason. `businessId` is
        // `number | null` while buildBillPayload wants a `number`, and this used to close that gap
        // with `?? 0` — which satisfies the compiler and silently REASSIGNS the bill to business 0
        // on every PUT made before a business resolves. A create at least refused; an update
        // returned 200 and moved the bill out of the business that owns it.
        if (businessId == null) return { success: false, error: 'No business is selected.' };
        result = await moduleApi.updateBill(billId, buildBillPayload(form, businessId));
      }

      if (!result.success) {
        // STATE_CONFLICT (409) is the one worth reading: CANCELLED → DRAFT is refused.
        setSaveError(result.error || 'Could not save this bill.');
        return result;
      }

      // Only the content route can have carried a new quick item or a newly staged photo — the two
      // PATCH routes fire when nothing but a status or the money moved.
      const photos = route === 'PUT' ? await uploadQuickPhotos(billId) : { warning: null };

      const saved = photos.saved ?? (result.data as BillDetailItem) ?? (item as BillDetailItem);
      setBaseline(shapeOf(toFormState(saved)));
      onSaved(saved);
      return { success: true, data: saved, warning: photos.warning };
    } finally {
      setSaving(false);
    }
  }, [form, mode, item, businessId, moduleApi, onSaved, baseline, uploadQuickPhotos]);

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
    addQuickItems,
    removeLine,
    save,
    remove,
  };
}
