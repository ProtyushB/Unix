import { useCallback, useEffect, useState } from 'react';
import type { StockUnitLine } from '../../../../backend/modules/shared/inventory.types';
import type { WastageDto, WastagePayload } from '../../../../backend/modules/shared/wastage.types';
import { clampUnitRows } from '../../inventory/batchUnits';
import {
  buildCreatePayload,
  emptyForm,
  toFormState,
  type WastageFormState,
} from './wastageDetail.model';
import { errorSummary, hasErrors, validateWastage, type DetailMode } from './wastageDetail.view';

interface SaveResult {
  success: boolean;
  data?: unknown;
  error?: string | null;
}

/**
 * What this hook needs from the module hook.
 *
 * FEATURE: neither method exists yet — `useModuleService.ts` has a labelled but EMPTY
 * `─── Wastage ───` region. Fill it by copying the consumption slice, then pass the real
 * `activeModule` in; the names below are the ones to create.
 */
interface ModuleApi {
  createWastage(data: WastagePayload): Promise<SaveResult>;
  deleteWastage(id: number): Promise<SaveResult>;
}

interface UseWastageDetailFormInput {
  mode: DetailMode;
  /** The DTO as last fetched. Null in add mode, and until the first load resolves. */
  item: WastageDto | null;
  moduleApi: ModuleApi;
  businessId: number | null;
  onSaved: (saved: WastageDto) => void;
  onDeleted: () => void;
}

/**
 * Form state and the save/delete paths for the Wastage Detail screen.
 *
 * Deliberately thin, same rule as its batch and consumption siblings: every decision — what the
 * form looks like for a given DTO, what the payload is, whether it validates — is a call into
 * `wastageDetail.model` or `wastageDetail.view`, both RN-free and unit-tested. If an `if` appears
 * here that is not `await`/`setState` plumbing, it is in the wrong file.
 *
 * There is no update path at all: a wastage is IMMUTABLE. Create is one POST; after that the only
 * write is delete, which restocks.
 */
export function useWastageDetailForm({
  mode,
  item,
  moduleApi,
  businessId,
  onSaved,
  onDeleted,
}: UseWastageDetailFormInput) {
  const [form, setForm] = useState<WastageFormState>(() => emptyForm());
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
    <K extends keyof WastageFormState>(field: K, value: WastageFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  /**
   * Adopt a product from the picker.
   *
   * Seeds the FIRST unit row from the product's base rung at the same time — the two are one
   * decision, and leaving the rows on the previous product's ladder would convert the quantity
   * through the wrong multiplier and write off the wrong amount of a different product's stock.
   */
  const setProduct = useCallback(
    (product: { id: number; name: string; unit: string; multiplier: number }) => {
      setForm((prev) => ({
        ...prev,
        itemId: product.id,
        itemName: product.name,
        unitRows: [{ unit: product.unit, perStock: product.multiplier, qty: 0 }],
      }));
    },
    [],
  );

  /**
   * Replace the unit rows, clamped to what this form is allowed to hold.
   *
   * Wastage allows multiples — the server keeps `unitLines` here and hands them back on the detail
   * read, so a breakdown typed in is a breakdown the user will see again. (Stock transfer's
   * equivalent passes false, because there the server discards them.)
   */
  const setUnitRows = useCallback((rows: StockUnitLine[], allowMultiple = true) => {
    setForm((prev) => ({ ...prev, unitRows: clampUnitRows(rows, allowMultiple) }));
  }, []);

  const save = useCallback(async (): Promise<SaveResult> => {
    const found = validateWastage(form);
    setErrors(found);
    if (hasErrors(found)) {
      return { success: false, error: errorSummary(found) };
    }
    if (businessId == null) {
      return { success: false, error: 'No business is selected.' };
    }

    const payload = buildCreatePayload(form, businessId);
    // Null means "nothing was entered". Distinct from a validation error only in where it was
    // caught — the payload builder is the one that knows every row was blank.
    if (!payload) {
      return { success: false, error: 'Enter a quantity.' };
    }

    setSaving(true);
    setSaveError(null);
    try {
      const result = await moduleApi.createWastage(payload);
      if (!result.success) {
        // The service throws locally on a bad reason and the server refuses an over-draw with a
        // message naming the shortfall — both are worth surfacing as-is rather than reworded.
        setSaveError(result.error || 'Could not record this wastage.');
        return result;
      }
      onSaved((result.data as WastageDto) ?? null);
      return { success: true, data: result.data };
    } finally {
      setSaving(false);
    }
  }, [form, businessId, moduleApi, onSaved]);

  const remove = useCallback(async (): Promise<SaveResult> => {
    if (item?.id == null) {
      return { success: false, error: 'This wastage has not been saved yet.' };
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await moduleApi.deleteWastage(item.id);
      if (!result.success) {
        setSaveError(result.error || 'Could not delete this wastage.');
        return result;
      }
      onDeleted();
      return result;
    } finally {
      setSaving(false);
    }
  }, [item, moduleApi, onDeleted]);

  return { form, errors, saving, saveError, setField, setProduct, setUnitRows, save, remove };
}
