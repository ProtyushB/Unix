import { useCallback, useEffect, useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import type {
  ExpenseDto,
  ExpenseFile,
  ExpensePayload,
  ExpenseUpdatePayload,
} from '../../../../backend/modules/shared/expense.types';
import { FileService } from '../../../../backend/dms/service/file.service';
import { nowIstParts } from '../../shared/detail/wallClock';
import {
  toDmsFiles,
  toPendingDocuments,
  toPendingFiles,
  type PendingFile,
} from '../../shared/detail/pendingFiles';
import { removeReceiptAt } from './receipts';
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
  /** Returns a map carrying the folder id; the key name is not guaranteed. */
  ensureExpenseFolder(params: {
    businessId: number;
    entityId: number;
  }): Promise<SaveResult>;
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
  /** Receipts picked this session, not yet uploaded. Kept apart from `form.files`, which is saved. */
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  /**
   * 0–100 while receipts are in flight.
   *
   * A plain percentage, not the product form's `uploadPercent` helper — that one maps progress onto
   * a SLICE of a multi-phase save bar (upload starts at 70, ceils at 92, then the server write
   * finishes it) and lives in `productDetail.view`. This screen has no such choreography, and
   * importing a sibling feature's view module to borrow the arithmetic would be the same
   * cross-feature reach that `poolLabel` was pulled apart for.
   */
  const [uploadProgress, setUploadProgress] = useState(0);

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

  /**
   * Attach a photo of a receipt.
   *
   * `mediaType: 'photo'` — the same call the product form makes, and the image fallbacks in
   * `toPendingFiles` are correct here for that reason.
   */
  const pickReceiptPhoto = useCallback(async () => {
    const response = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 0 });
    if (response.didCancel) return;
    setPendingFiles((prev) => [...prev, ...toPendingFiles(response.assets, prev.length)]);
  }, []);

  /**
   * Attach a PDF (or anything else the user points at).
   *
   * `copyToCacheDirectory` is ON deliberately: a content:// URI handed straight from the Android
   * document provider is a permission grant scoped to the picking Activity, and by the time the
   * upload runs it can be unreadable. Copying first costs a file write and removes a failure that
   * only shows up on device.
   *
   * ⚠️ Uses `toPendingDocuments`, NOT `toPendingFiles` — the two pickers disagree on key names
   * (`name`/`size`/`mimeType` vs `fileName`/`fileSize`/`type`), and reading the wrong ones ships a
   * filename-less multipart part that answers 200 and uploads nothing.
   */
  const pickReceiptDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      // Not `application/pdf` alone: the user may have photographed the bill and saved it as an
      // image, and a picker that hides their own file is worse than one that shows too much.
      type: ['application/pdf', 'image/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    setPendingFiles((prev) => [...prev, ...toPendingDocuments(result.assets, prev.length)]);
  }, []);

  /** Remove by position across the combined strip — saved rows first, then pending. */
  const removeReceipt = useCallback(
    (index: number) => {
      const next = removeReceiptAt(form.files, pendingFiles, index);
      setForm((prev) => ({ ...prev, files: next.saved }));
      setPendingFiles(next.pending);
    },
    [form.files, pendingFiles],
  );

  /**
   * Push pending receipts to DMS and hand back the full file list for the record.
   *
   * Called only AFTER the expense exists: the backend names the folder `Expense_{id}` and cannot do
   * that without an id. Returns the list unchanged when there is nothing to upload.
   *
   * ⚠️ An upload failure does NOT fail the save. The expense itself is the record of the money;
   * losing a receipt is worse than losing nothing but far better than discarding a saved expense
   * the user has already been told about. Same call `useProductDetailForm` makes for the same
   * reason. The receipts stay pending in the form so a second Save retries them.
   */
  const uploadPending = useCallback(
    async (savedId: number): Promise<ExpenseFile[]> => {
      if (!pendingFiles.length || businessId == null) return form.files;

      const folder = await moduleApi.ensureExpenseFolder({ businessId, entityId: savedId });
      const data = folder?.data as Record<string, number> | undefined;
      // The controller answers with a map; take whichever key it used rather than assuming one.
      const folderId = data ? (data.folderId ?? Object.values(data)[0] ?? null) : null;
      if (folderId == null) return form.files;

      setUploadProgress(1);
      const uploaded = await new FileService().createMultipleFiles(
        pendingFiles,
        folderId,
        [],
        (event) => {
          // Guard the divide: axios omits `total` when the server sends no content-length, and
          // `loaded/undefined` is NaN — which renders as a blank bar rather than an obvious fault.
          const total = Number(event.total);
          if (!Number.isFinite(total) || total <= 0) return;
          setUploadProgress(Math.min(99, Math.round((Number(event.loaded) / total) * 100)));
        },
      );
      setUploadProgress(100);
      return [...form.files, ...toDmsFiles(uploaded, pendingFiles)];
    },
    [pendingFiles, form.files, businessId, moduleApi],
  );

  const save = useCallback(async (): Promise<SaveResult> => {
    const found = validateExpense(form);
    setErrors(found);
    if (hasErrors(found)) {
      return { success: false, error: errorSummary(found) };
    }
    if (businessId == null) {
      // Set it, do not just return it. This branch has no other surface — unlike a validation
      // failure, which marks the offending field — so returning quietly leaves Save doing visibly
      // nothing. Found while checking the banner: the save was refused here and the screen said
      // nothing at all.
      const message = 'No business is selected.';
      setSaveError(message);
      return { success: false, error: message };
    }

    setSaving(true);
    setSaveError(null);
    try {
      const editing = mode === 'edit' && item?.id != null;

      /*
       * EDIT is ONE write, ADD is two — the same asymmetry `useProductDetailForm` documents.
       *
       * On edit the id already exists, so the receipts can be uploaded FIRST and the whole record
       * written once. On add there is no id to name the folder after until the POST returns, so the
       * upload has to follow it, and a second write links the ids.
       *
       * Doing edit as two writes would double the clobber risk on a PUT that replaces the record.
       */
      if (editing) {
        const id = item.id as number;
        let files = form.files;
        try {
          files = await uploadPending(id);
        } catch (err) {
          setSaveError(`The expense will be saved, but a receipt did not upload. ${
            (err as Error).message ?? ''
          }`.trim());
        }
        const result = await moduleApi.updateExpense(id, {
          ...buildUpdatePayload(form, businessId, id),
          files,
        });
        if (!result.success) {
          setSaveError(writeRefusalMessage(result.code, result.error ?? null));
          return result;
        }
        setPendingFiles([]);
        setForm((prev) => ({ ...prev, files }));
        onSaved((result.data as ExpenseDto) ?? null);
        return { success: true, data: result.data };
      }

      // Phase 1 — create without files. There is no id yet to attach them to.
      const created = await moduleApi.createExpense(buildCreatePayload(form, businessId));
      if (!created.success) {
        // TAB_DISABLED and FEATURE_DISABLED are both 403s that mean different things and need
        // different actions from the user; `writeRefusalMessage` is where they are told apart.
        setSaveError(writeRefusalMessage(created.code, created.error ?? null));
        return created;
      }

      const saved = (created.data as ExpenseDto) ?? null;
      const savedId = saved?.id;
      if (pendingFiles.length && savedId != null) {
        try {
          // Phase 2 — upload, then a second write that links the ids. This write exists only
          // because the first had no id; it is not an edit.
          const files = await uploadPending(savedId);
          const linked = await moduleApi.updateExpense(savedId, {
            ...buildUpdatePayload(form, businessId, savedId),
            files,
          });
          setPendingFiles([]);
          onSaved(((linked.success ? linked.data : saved) as ExpenseDto) ?? null);
          return { success: true, data: linked.success ? linked.data : saved };
        } catch (err) {
          // The expense IS saved. Say so, rather than letting a receipt failure read as a lost
          // record.
          setSaveError(
            `The expense was saved, but a receipt did not upload. ${(err as Error).message ?? ''}`.trim(),
          );
        }
      }

      onSaved(saved);
      return { success: true, data: created.data };
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  }, [form, mode, item, businessId, moduleApi, onSaved, pendingFiles, uploadPending]);

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
    pendingFiles,
    uploadProgress,
    setField,
    setReimbursable,
    setSaveError,
    pickReceiptPhoto,
    pickReceiptDocument,
    removeReceipt,
    save,
    remove,
    markReimbursed,
  };
}
