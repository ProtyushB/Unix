import { useCallback, useEffect, useState } from 'react';
import {
  buildCreatePayload,
  newLine,
  orderLines,
  passthroughItems,
  toFormState,
  toUpdatePayload,
  type OrderDetailItem,
  type OrderFormState,
} from './orderDetail.model';
import { errorSummary, hasErrors, validateOrder, type DetailMode } from './orderDetail.view';
import {
  addUnit as addUnitTo,
  baseSaleUnit,
  canMarkDelivered,
  markLineDelivered,
  removeUnit as removeUnitFrom,
  saleUnitsOf,
  selectUnit as selectUnitOn,
  updateUnitQty as updateUnitQtyOn,
  type SaleUnit,
} from './orderLineUnits';

interface SaveResult {
  success: boolean;
  data?: unknown;
  error?: string | null;
  code?: string;
}

interface ModuleApi {
  createOrder(data: Record<string, unknown>): Promise<SaveResult>;
  updateOrder(data: Record<string, unknown>): Promise<SaveResult>;
  deleteOrder(id: number): Promise<SaveResult>;
}

interface UseOrderDetailFormInput {
  mode: DetailMode;
  /** The DTO as last fetched. Null in add mode, and until the first load resolves. */
  item: OrderDetailItem | null;
  moduleApi: ModuleApi;
  businessId: number | null;
  onSaved: (saved: OrderDetailItem) => void;
  onDeleted: () => void;
  /**
   * Called after a per-item delivery lands. Separate from `onSaved` because that one also leaves
   * edit mode and toasts "Order updated" — both wrong for an action taken FROM view mode.
   */
  onItemDelivered?: (saved: OrderDetailItem) => void;
}

/**
 * Form state and the save/delete paths for the Order Detail screen.
 *
 * Deliberately thin, same rule as its product and service siblings: every decision — what the form
 * looks like for a given DTO, what the payload is, whether it validates — is a call into
 * `orderDetail.model`, `orderDetail.view` or `orderLineUnits`, all three RN-free and unit-tested.
 * If an `if` appears here that is not `await`/`setState` plumbing, it is in the wrong file.
 *
 * Simpler than the product hook in one respect: an order has no images, so there is no DMS folder,
 * no upload and no second write. Create is one POST, edit is one PUT.
 */
export function useOrderDetailForm({
  mode,
  item,
  moduleApi,
  businessId,
  onSaved,
  onDeleted,
  onItemDelivered,
}: UseOrderDetailFormInput) {
  const [form, setForm] = useState<OrderFormState>(() => toFormState(null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * The PACKAGE / SERVICE_PLAN / SUBSCRIPTION rows the form cannot edit.
   *
   * Held in state rather than read off `item` at save time so that a mid-edit refetch cannot swap
   * them underneath a save in progress. They are written back verbatim — dropping one deletes the
   * row AND restocks units already handed to a customer.
   */
  const [passthrough, setPassthrough] = useState<Record<string, unknown>[]>([]);

  /** productIds with a delivery in flight — drives the per-row spinner and blocks a double tap. */
  const [deliveringIds, setDeliveringIds] = useState<number[]>([]);

  // Reseed whenever a new record arrives. Keyed on the record's identity rather than the object,
  // so a re-render that merely re-wraps the same order does not discard what the user has typed.
  const itemId = item?.id ?? null;
  useEffect(() => {
    if (mode === 'add' || !item) return;
    setForm(toFormState(item));
    setPassthrough(passthroughItems(item));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, mode]);

  const setField = useCallback((field: 'orderStatus' | 'notes', value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  /** Called by the shared customer picker. Stores the id AND the display fields the cards show. */
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

  // ─── Lines ─────────────────────────────────────────────────────────────────

  /**
   * Add the products a picker handed back, each seeded on its base rung so the line is valid at
   * quantity 1. A product already on the order is skipped rather than duplicated — two rows for
   * one product would roll up to the same thing and read as a mistake.
   */
  const addProducts = useCallback(
    (products: { id: number; saleUnits?: unknown }[], salesPersonId: number | null = null) => {
      setForm((prev) => {
        const present = new Set(prev.lines.map((l) => l.productId));
        const additions = products
          .filter((p) => !present.has(p.id))
          .map((p) => newLine(p.id, baseSaleUnit(saleUnitsOf(p)), salesPersonId));
        return additions.length ? { ...prev, lines: [...prev.lines, ...additions] } : prev;
      });
    },
    [],
  );

  const removeLine = useCallback((index: number) => {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  }, []);

  /** Every unit-level edit funnels through here, so the roll-up rule has exactly one caller. */
  const editLine = useCallback(
    (
      index: number,
      edit: (line: OrderFormState['lines'][number]) => OrderFormState['lines'][number],
    ) => {
      setForm((prev) => ({
        ...prev,
        lines: prev.lines.map((line, i) => (i === index ? edit(line) : line)),
      }));
    },
    [],
  );

  const setUnitQty = useCallback(
    (lineIndex: number, unitIndex: number, qty: number) => {
      // A stepper cannot go below one — removing the last of a unit is the ✕, not a decrement.
      editLine(lineIndex, (line) => updateUnitQtyOn(line, unitIndex, Math.max(1, qty)));
    },
    [editLine],
  );

  const removeUnit = useCallback(
    (lineIndex: number, unitIndex: number) => {
      editLine(lineIndex, (line) => removeUnitFrom(line, unitIndex));
    },
    [editLine],
  );

  const addUnit = useCallback(
    (lineIndex: number, unit: SaleUnit) => {
      editLine(lineIndex, (line) => addUnitTo(line, unit));
    },
    [editLine],
  );

  const selectUnit = useCallback(
    (lineIndex: number, unitIndex: number, unit: SaleUnit) => {
      editLine(lineIndex, (line) => selectUnitOn(line, unitIndex, unit));
    },
    [editLine],
  );

  // ─── Save ──────────────────────────────────────────────────────────────────

  const save = useCallback(async (): Promise<SaveResult> => {
    const found = validateOrder(form);
    setErrors(found);
    if (hasErrors(found)) {
      return { success: false, error: errorSummary(found) };
    }

    setSaving(true);
    setSaveError(null);
    try {
      const isAdd = mode === 'add' || item?.id == null;
      if (isAdd && businessId == null) {
        return { success: false, error: 'No business is selected.' };
      }

      const result = isAdd
        ? await moduleApi.createOrder(buildCreatePayload(form, businessId as number))
        : // Built from the DTO the server last gave us, NOT from the form alone. PUT replaces the
          // whole record, so a key missing here is a key erased there — and for `orderItems`, a
          // line missing here is a line deleted AND its stock returned.
          await moduleApi.updateOrder(toUpdatePayload(item as OrderDetailItem, form, passthrough));

      if (!result.success) {
        // ORDER_LOCKED (409) means the order sits on a finalized bill. The message the server sends
        // already says so, and a retry cannot help, so it is surfaced as-is.
        setSaveError(result.error || 'Could not save this order.');
        return result;
      }

      const saved = (result.data as OrderDetailItem) ?? (item as OrderDetailItem);
      onSaved(saved);
      return { success: true, data: saved };
    } finally {
      setSaving(false);
    }
  }, [form, mode, item, businessId, moduleApi, onSaved, passthrough]);

  /**
   * Mark one product line delivered, from VIEW mode.
   *
   * There is no per-item endpoint for a top-level product — see `canMarkDelivered`. This is the
   * ordinary full PUT with one line's `status` flipped, which is exactly what Centrix does
   * (`GenericOrderDetailsBase.jsx:339-363`).
   *
   * Three things this deliberately does NOT do:
   *
   *  - It does not touch `saving`. That flag drives the screen's SAVING view, which blanks the
   *    whole record behind a spinner. A per-row action gets a per-row spinner via `deliveringIds`;
   *    hiding the order to tick one line off it would be absurd.
   *  - It does not run `validateOrder`. The user is not editing, and refusing to deliver a line
   *    because some unrelated field is empty would be a dead end with no way out from view mode.
   *  - It does not rebuild the payload from the form alone. It goes through `toUpdatePayload` with
   *    `passthrough`, because omitting a line from `orderItems` deletes it AND restocks it.
   *
   * Optimistic, and the rollback is the point: the pill repaints instantly, but a save that fails
   * must not leave a row claiming DELIVERED when the server still has it PENDING.
   */
  const markItemDelivered = useCallback(
    async (productId: number): Promise<SaveResult> => {
      if (item?.id == null) {
        return { success: false, error: 'This order has not been saved yet.' };
      }
      if (deliveringIds.includes(productId)) return { success: false };

      const target = form.lines.find((l) => l.productId === productId);
      if (!target || !canMarkDelivered(target)) return { success: false };

      const previousLines = form.lines;
      const optimisticLines = markLineDelivered(previousLines, productId);

      setForm((prev) => ({ ...prev, lines: optimisticLines }));
      setDeliveringIds((prev) => [...prev, productId]);
      setSaveError(null);

      try {
        const result = await moduleApi.updateOrder(
          toUpdatePayload(item, { ...form, lines: optimisticLines }, passthrough),
        );

        if (!result.success) {
          // Put the row back the way the server still has it.
          setForm((prev) => ({ ...prev, lines: previousLines }));
          // ORDER_LOCKED (409) is the common refusal: the order sits on a finalized bill.
          setSaveError(result.error || 'Could not mark that item delivered.');
          return result;
        }

        const saved = (result.data as OrderDetailItem) ?? item;

        // Adopt the server's copy of the record, not just the optimistic flip.
        //
        // A delivery can roll the ORDER's own status up to COMPLETED, and the header pill renders
        // from `form.orderStatus` — which the reseed effect will NOT refresh, because it is keyed on
        // the record's id and that has not changed. Without this the line says DELIVERED while the
        // pill still says Confirmed until the screen is remounted.
        //
        // Guarded on a non-empty `orderItems`: the appointment endpoint has been seen to answer
        // without its items, and reseeding from a response like that would blank the section.
        if (Array.isArray(saved?.orderItems) && saved.orderItems.length) {
          setForm(toFormState(saved));
          setPassthrough(passthroughItems(saved));
        } else if (saved?.orderStatus) {
          setForm((prev) => ({ ...prev, orderStatus: String(saved.orderStatus) }));
        }

        onItemDelivered?.(saved);
        return { success: true, data: saved };
      } finally {
        setDeliveringIds((prev) => prev.filter((id) => id !== productId));
      }
    },
    [form, item, deliveringIds, moduleApi, passthrough, onItemDelivered],
  );

  const remove = useCallback(async (): Promise<SaveResult> => {
    if (item?.id == null) return { success: false, error: 'This order has not been saved yet.' };
    setSaving(true);
    setSaveError(null);
    try {
      const result = await moduleApi.deleteOrder(item.id);
      if (!result.success) {
        // Routinely refused: a COMPLETED order cannot be deleted, and neither can one on a
        // finalized bill.
        setSaveError(result.error || 'Could not delete this order.');
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
    passthrough,
    deliveringIds,
    markItemDelivered,
    setField,
    setCustomer,
    addProducts,
    removeLine,
    setUnitQty,
    addUnit,
    removeUnit,
    selectUnit,
    save,
    remove,
  };
}

/** Re-exported for the screen, which seeds its own empty form before the first fetch resolves. */
export { orderLines };
