import { useCallback, useEffect, useState } from 'react';
import type { BatchDto } from '../batch.model';
import {
  buildCreatePayload,
  emptyForm,
  toFormState,
  type BatchFormState,
} from './batchDetail.model';
import { errorSummary, hasErrors, validateBatch, type DetailMode } from './batchDetail.view';

interface SaveResult {
  success: boolean;
  data?: unknown;
  error?: string | null;
}

interface ModuleApi {
  addInventoryBatch(data: Record<string, unknown>): Promise<SaveResult>;
  deleteInventoryBatch(id: number): Promise<SaveResult>;
}

interface UseBatchDetailFormInput {
  mode: DetailMode;
  /** The DTO as last fetched. Null in add mode, and until the first load resolves. */
  item: BatchDto | null;
  moduleApi: ModuleApi;
  businessId: number | null;
  onSaved: (saved: BatchDto) => void;
  onDeleted: () => void;
}

/**
 * Form state and the save/delete paths for the Batch Detail screen.
 *
 * Deliberately thin, same rule as its product and order siblings: every decision — what the form
 * looks like for a given DTO, what the payload is, whether it validates — is a call into
 * `batchDetail.model` or `batchDetail.view`, both RN-free and unit-tested. If an `if` appears here
 * that is not `await`/`setState` plumbing, it is in the wrong file.
 *
 * Simpler than every sibling in one respect: a batch is IMMUTABLE, so there is no update path at
 * all. Create is one POST; after that the only writes are the status endpoint (owned by the list
 * screen's sheet) and delete.
 */
export function useBatchDetailForm({
  mode,
  item,
  moduleApi,
  businessId,
  onSaved,
  onDeleted,
}: UseBatchDetailFormInput) {
  const [form, setForm] = useState<BatchFormState>(() => emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reseed whenever a new record arrives. Keyed on the record's identity rather than the object,
  // so a re-render that merely re-wraps the same batch does not discard what the user has typed.
  const itemId = item?.id ?? null;
  useEffect(() => {
    if (mode === 'add' || !item) return;
    setForm(toFormState(item));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, mode]);

  const setField = useCallback(
    <K extends keyof BatchFormState>(field: K, value: BatchFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  /**
   * Adopt a product from the picker.
   *
   * Seeds the stock-in level from the product's ladder at the same time — the two are one decision,
   * and leaving the multiplier on its previous product's value would convert the quantity through
   * the wrong factor.
   */
  const setProduct = useCallback(
    (product: { id: number; name: string; unit: string; multiplier: number }) => {
      setForm((prev) => ({
        ...prev,
        itemId: product.id,
        itemName: product.name,
        stockInUnit: product.unit,
        stockInMultiplier: product.multiplier,
      }));
    },
    [],
  );

  const save = useCallback(async (): Promise<SaveResult> => {
    const found = validateBatch(form);
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
      const result = await moduleApi.addInventoryBatch(buildCreatePayload(form, businessId));
      if (!result.success) {
        // The server's create rules throw, so a refusal here is a real rule the client mirrors —
        // surfaced as-is rather than reworded, because it names the field.
        setSaveError(result.error || 'Could not save this batch.');
        return result;
      }
      onSaved((result.data as BatchDto) ?? null);
      return { success: true, data: result.data };
    } finally {
      setSaving(false);
    }
  }, [form, businessId, moduleApi, onSaved]);

  const remove = useCallback(async (): Promise<SaveResult> => {
    if (item?.id == null) return { success: false, error: 'This batch has not been saved yet.' };
    setSaving(true);
    setSaveError(null);
    try {
      const result = await moduleApi.deleteInventoryBatch(item.id);
      if (!result.success) {
        // Routinely refused: a batch that has been drawn from, or one the system minted.
        setSaveError(result.error || 'Could not delete this batch.');
        return result;
      }
      onDeleted();
      return result;
    } finally {
      setSaving(false);
    }
  }, [item, moduleApi, onDeleted]);

  return { form, errors, saving, saveError, setField, setProduct, save, remove };
}
