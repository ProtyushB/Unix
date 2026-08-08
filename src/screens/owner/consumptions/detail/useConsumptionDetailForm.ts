import { useCallback, useEffect, useState } from 'react';
import type {
  ConsumptionDto,
  ConsumptionPayload,
} from '../../../../backend/modules/shared/consumption.types';
import type { StockUnitLine } from '../../../../backend/modules/shared/inventory.types';
import { clampUnitRows } from '../../inventory/batchUnits';
import {
  buildCreatePayload,
  emptyForm,
  toFormState,
  type ConsumptionFormState,
} from './consumptionDetail.model';
import {
  errorSummary,
  hasErrors,
  validateConsumption,
  type DetailMode,
} from './consumptionDetail.view';

interface SaveResult {
  success: boolean;
  data?: unknown;
  error?: string | null;
}

interface ModuleApi {
  createConsumption(data: ConsumptionPayload): Promise<SaveResult>;
  deleteConsumption(id: number): Promise<SaveResult>;
}

interface UseConsumptionDetailFormInput {
  mode: DetailMode;
  /** The DTO as last fetched. Null in add mode, and until the first load resolves. */
  item: ConsumptionDto | null;
  moduleApi: ModuleApi;
  businessId: number | null;
  /**
   * RAW stock on hand in base units, for the over-draw check. Null is NOT zero — it means the
   * figure has not arrived, and `validateConsumption` skips the check rather than refusing a
   * quantity that is probably fine.
   */
  availableBaseQty?: number | null;
  /** The chosen product's base unit, so a shortfall message names a real quantity. */
  baseUnit?: string;
  onSaved: (saved: ConsumptionDto) => void;
  onDeleted: () => void;
}

/**
 * Form state and the save/delete paths for the Consumption Detail screen.
 *
 * Deliberately thin, same rule as its batch sibling: every decision — what the form looks like for
 * a given DTO, what the payload is, whether it validates — is a call into `consumptionDetail.model`
 * or `consumptionDetail.view`, both RN-free and unit-tested. If an `if` appears here that is not
 * `await`/`setState` plumbing, it is in the wrong file.
 *
 * There is no update path at all: a consumption is IMMUTABLE. Create is one POST; after that the
 * only write is delete, which restocks.
 */
export function useConsumptionDetailForm({
  mode,
  item,
  moduleApi,
  businessId,
  availableBaseQty = null,
  baseUnit = 'unit',
  onSaved,
  onDeleted,
}: UseConsumptionDetailFormInput) {
  const [form, setForm] = useState<ConsumptionFormState>(() => emptyForm());
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
    <K extends keyof ConsumptionFormState>(field: K, value: ConsumptionFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  /**
   * Adopt a product from the picker.
   *
   * Seeds the FIRST unit row from the product's base rung at the same time — the two are one
   * decision, and leaving the rows on the previous product's ladder would convert the quantity
   * through the wrong multiplier and deduct the wrong amount of a different product's stock.
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
   * `allowMultiple` is the caller's, not this hook's — stock transfer's equivalent passes false
   * because the server discards `unitLines` there. Clamping on the way IN means the payload builder
   * can never see a row that was not offered.
   */
  const setUnitRows = useCallback((rows: StockUnitLine[], allowMultiple = true) => {
    setForm((prev) => ({ ...prev, unitRows: clampUnitRows(rows, allowMultiple) }));
  }, []);

  const save = useCallback(async (): Promise<SaveResult> => {
    const found = validateConsumption(form, { availableBaseQty, baseUnit });
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
      const result = await moduleApi.createConsumption(payload);
      if (!result.success) {
        // The service throws locally on a bad reason and the server refuses an over-draw with a
        // message naming the shortfall — both are worth surfacing as-is rather than reworded.
        setSaveError(result.error || 'Could not record this consumption.');
        return result;
      }
      onSaved((result.data as ConsumptionDto) ?? null);
      return { success: true, data: result.data };
    } finally {
      setSaving(false);
    }
  }, [form, businessId, availableBaseQty, baseUnit, moduleApi, onSaved]);

  const remove = useCallback(async (): Promise<SaveResult> => {
    if (item?.id == null) {
      return { success: false, error: 'This consumption has not been saved yet.' };
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await moduleApi.deleteConsumption(item.id);
      if (!result.success) {
        setSaveError(result.error || 'Could not delete this consumption.');
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
