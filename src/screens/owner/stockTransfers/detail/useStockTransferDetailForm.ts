import { useCallback, useEffect, useState } from 'react';
import type {
  InventoryType,
  StockUnitLine,
} from '../../../../backend/modules/shared/inventory.types';
import type {
  StockTransferDto,
  StockTransferPayload,
  StockTransferReason,
} from '../../../../backend/modules/shared/stockTransfer.types';
import { clampUnitRows } from '../../inventory/batchUnits';
import {
  buildCreatePayload,
  emptyForm,
  toFormState,
  type StockTransferFormState,
} from './stockTransferDetail.model';
import {
  directionalReason,
  errorSummary,
  hasErrors,
  oppositePool,
  reasonSelection,
  validateStockTransfer,
  type DetailMode,
  type ValidateOptions,
} from './stockTransferDetail.view';

interface SaveResult {
  success: boolean;
  data?: unknown;
  /** Carries the backend's ErrorCode — notably `STOCK_MOVEMENT_LOCKED` on a delete. */
  code?: string;
  error?: string | null;
}

/**
 * What this hook needs from the module hook.
 *
 * Narrowed to two methods rather than taking `activeModule` itself: `createModuleHook` returns a
 * fresh object literal every render, so a hook that depended on the whole thing would invalidate
 * its own callbacks on every render. The caller destructures the two `useCallback`-stable functions
 * and memoises this shape.
 *
 * ⚠️ `deleteStockTransfer` RESOLVES `{ success: false, code: 'STOCK_MOVEMENT_LOCKED', error }` on a
 * 409 rather than throwing, which is why `SaveResult` above carries a `code` its consumption twin
 * does not — the screen says something different for that refusal.
 */
interface ModuleApi {
  createStockTransfer(data: StockTransferPayload): Promise<SaveResult>;
  deleteStockTransfer(id: number): Promise<SaveResult>;
}

interface UseStockTransferDetailFormInput {
  mode: DetailMode;
  /** The DTO as last fetched. Null in add mode, and until the first load resolves. */
  item: StockTransferDto | null;
  moduleApi: ModuleApi;
  businessId: number | null;
  onSaved: (saved: StockTransferDto) => void;
  onDeleted: () => void;
}

/**
 * Form state and the save/delete paths for the Stock Transfer Detail screen.
 *
 * Deliberately thin, same rule as its batch and consumption siblings: every decision — what the
 * form looks like for a given DTO, what the payload is, whether it validates — is a call into
 * `stockTransferDetail.model` or `stockTransferDetail.view`, both RN-free and unit-tested. If an
 * `if` appears here that is not `await`/`setState` plumbing, it is in the wrong file.
 *
 * There is no update path at all: a transfer is IMMUTABLE. Create is one POST; after that the only
 * write is delete, which reverses the move — and which the server refuses once the destination
 * batch has been drawn from.
 */
export function useStockTransferDetailForm({
  mode,
  item,
  moduleApi,
  businessId,
  onSaved,
  onDeleted,
}: UseStockTransferDetailFormInput) {
  const [form, setForm] = useState<StockTransferFormState>(() => emptyForm());
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
    <K extends keyof StockTransferFormState>(field: K, value: StockTransferFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  /**
   * Set the DIRECTION — all three fields at once.
   *
   * The one place source, destination and reason may change, and the reason it exists: they are one
   * decision, not three. `PRODUCT_TO_RAW` with `sourceType: 'RAW_INVENTORY'` is ACCEPTED by the
   * server and is a lie in the audit log that nothing later can detect, so the three must never be
   * settable independently.
   */
  const setDirection = useCallback((source: InventoryType) => {
    const dest = oppositePool(source);
    setForm((prev) => ({
      ...prev,
      sourceType: source,
      destType: dest,
      reason: directionalReason(source, dest),
    }));
  }, []);

  /**
   * Set the REASON — which may also move the pools.
   *
   * The other half of `setDirection`, and it exists for the same reason: the two directional
   * reasons ARE a direction, so picking one has to bring the pools with it or the record ships a
   * reason that contradicts them. The three non-directional reasons leave the direction alone.
   * `reasonSelection` owns which is which; this is only the setState around it.
   */
  const setReason = useCallback((reason: StockTransferReason) => {
    setForm((prev) => ({ ...prev, ...reasonSelection(reason, prev.sourceType) }));
  }, []);

  /**
   * Adopt a product from the picker.
   *
   * Seeds the SINGLE unit row from the product's base rung at the same time — the two are one
   * decision, and leaving the row on the previous product's ladder would convert the quantity
   * through the wrong multiplier and move the wrong amount of a different product's stock.
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
   * Replace the unit rows — CLAMPED TO ONE, unlike its two siblings.
   *
   * `allowMultiple` defaults to false here and nowhere else, because the server DISCARDS
   * `unitLines` on a transfer and rebuilds the destination batch from the scalar total. A second
   * row would be typed, sent, dropped, and missing from the detail screen the user lands on — so
   * the UI never offers one. `UnitRowsEditor` gets the same `allowMultiple={false}`.
   */
  const setUnitRows = useCallback((rows: StockUnitLine[], allowMultiple = false) => {
    setForm((prev) => ({ ...prev, unitRows: clampUnitRows(rows, allowMultiple) }));
  }, []);

  /**
   * Validate and POST.
   *
   * The ceiling (`availableBaseQty`) arrives as an ARGUMENT rather than as an input to this hook,
   * and that is not a style choice: it is derived from the source pool's batches keyed by the
   * product this very form holds, so passing it in would make the hook depend on something derived
   * from its own state. One argument at the call site breaks the cycle.
   */
  const save = useCallback(
    async (limits: ValidateOptions = {}): Promise<SaveResult> => {
      const found = validateStockTransfer(form, limits);
      setErrors(found);
      if (hasErrors(found)) {
        return { success: false, error: errorSummary(found) };
      }
      if (businessId == null) {
        return { success: false, error: 'No business is selected.' };
      }

      const payload = buildCreatePayload(form, businessId);
      // Null means "nothing was entered". Distinct from a validation error only in where it was
      // caught — the payload builder is the one that knows the row was blank.
      if (!payload) {
        return { success: false, error: 'Enter a quantity.' };
      }

      setSaving(true);
      setSaveError(null);
      try {
        const result = await moduleApi.createStockTransfer(payload);
        if (!result.success) {
          // The service throws locally on a bad reason or a same-pool pair, and the server refuses
          // an over-draw with a message naming the shortfall — all worth surfacing as-is.
          setSaveError(result.error || 'Could not record this transfer.');
          return result;
        }
        onSaved((result.data as StockTransferDto) ?? null);
        return { success: true, data: result.data };
      } finally {
        setSaving(false);
      }
    },
    [form, businessId, moduleApi, onSaved],
  );

  /**
   * Reverse the move.
   *
   * ⚠️ The `code` is passed straight back to the caller rather than being flattened into `error`:
   * a 409 `STOCK_MOVEMENT_LOCKED` means the destination batch has already been drawn from, which is
   * the system protecting stock rather than a failure, and the screen says something different for
   * it. That is the one way this differs from `useConsumptionDetailForm.remove`.
   */
  const remove = useCallback(async (): Promise<SaveResult> => {
    if (item?.id == null) {
      return { success: false, error: 'This transfer has not been saved yet.' };
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await moduleApi.deleteStockTransfer(item.id);
      if (!result.success) {
        setSaveError(result.error || 'Could not delete this transfer.');
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
    setField,
    setDirection,
    setReason,
    setProduct,
    setUnitRows,
    save,
    remove,
  };
}
