import { useCallback, useEffect, useState } from 'react';
import {
  buildCreatePayload,
  toFormState,
  toUpdatePayload,
  type AppointmentDetailItem,
  type AppointmentFormState,
} from './appointmentDetail.model';
import {
  errorSummary,
  hasErrors,
  validateAppointment,
  type DetailMode,
} from './appointmentDetail.view';
import {
  newServiceLine,
  passthroughItems,
  setQuantity,
  type ServiceLine,
} from './appointmentLines';

interface SaveResult {
  success: boolean;
  data?: unknown;
  error?: string | null;
  code?: string;
}

interface ModuleApi {
  createAppointment(data: Record<string, unknown>): Promise<SaveResult>;
  updateAppointment(data: Record<string, unknown>): Promise<SaveResult>;
  deleteAppointment(id: number): Promise<SaveResult>;
}

interface UseAppointmentDetailFormInput {
  mode: DetailMode;
  item: AppointmentDetailItem | null;
  moduleApi: ModuleApi;
  businessId: number | null;
  onSaved: (saved: AppointmentDetailItem) => void;
  onDeleted: () => void;
}

/**
 * Form state and the save/delete paths for the Appointment Detail screen.
 *
 * Thin, same rule as its siblings: every decision lives in `appointmentDetail.model`,
 * `appointmentDetail.view` or `appointmentLines`, all RN-free and tested.
 *
 * Per-item completion is deliberately NOT here — it is a read-mode action against a saved record,
 * with its own endpoint and its own refetch, so the screen owns it. Mixing it in would give this
 * hook a second source of truth for the item list.
 */
export function useAppointmentDetailForm({
  mode,
  item,
  moduleApi,
  businessId,
  onSaved,
  onDeleted,
}: UseAppointmentDetailFormInput) {
  const [form, setForm] = useState<AppointmentFormState>(() => toFormState(null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** PACKAGE rows: bookings against slots someone already paid for. Written back verbatim. */
  const [passthrough, setPassthrough] = useState<Record<string, unknown>[]>([]);

  const itemId = item?.id ?? null;
  useEffect(() => {
    if (mode === 'add' || !item) return;
    setForm(toFormState(item));
    setPassthrough(passthroughItems(item));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, mode]);

  const setField = useCallback(
    (field: 'appointmentStatus' | 'notes' | 'date' | 'time', value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

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

  /** Add picked services, skipping any already on the appointment. */
  const addServices = useCallback(
    (services: { id: number; price: number }[], servicePersonId: number | null = null) => {
      setForm((prev) => {
        const present = new Set(prev.lines.map((l) => l.serviceId));
        const additions = services
          .filter((s) => !present.has(s.id))
          .map((s) => newServiceLine(s.id, s.price, servicePersonId));
        return additions.length ? { ...prev, lines: [...prev.lines, ...additions] } : prev;
      });
    },
    [],
  );

  const removeLine = useCallback((index: number) => {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  }, []);

  const setLineQuantity = useCallback((index: number, quantity: number) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? setQuantity(line, quantity) : line)),
    }));
  }, []);

  /** Replace the item list wholesale, after the server hands back a fresh one. */
  const applyItems = useCallback((lines: ServiceLine[], extra: Record<string, unknown>[]) => {
    setForm((prev) => ({ ...prev, lines }));
    setPassthrough(extra);
  }, []);

  const save = useCallback(async (): Promise<SaveResult> => {
    const found = validateAppointment(form);
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
        ? await moduleApi.createAppointment(buildCreatePayload(form, businessId as number))
        : // From the fetched DTO, not the form alone — servicePlanId, sessionNumber and
          // employmentId have no UI and are silently NULLed if they do not ride the spread.
          await moduleApi.updateAppointment(
            toUpdatePayload(item as AppointmentDetailItem, form, passthrough),
          );

      if (!result.success) {
        // APPOINTMENT_LOCKED (409) means it sits on a finalized bill. The server's message says so.
        setSaveError(result.error || 'Could not save this appointment.');
        return result;
      }

      const saved = (result.data as AppointmentDetailItem) ?? (item as AppointmentDetailItem);
      onSaved(saved);
      return { success: true, data: saved };
    } finally {
      setSaving(false);
    }
  }, [form, mode, item, businessId, moduleApi, onSaved, passthrough]);

  const remove = useCallback(async (): Promise<SaveResult> => {
    if (item?.id == null) {
      return { success: false, error: 'This appointment has not been saved yet.' };
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await moduleApi.deleteAppointment(item.id);
      if (!result.success) {
        // Routinely refused: a COMPLETED appointment cannot be deleted, nor one on a finalized bill.
        setSaveError(result.error || 'Could not delete this appointment.');
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
    setField,
    setCustomer,
    addServices,
    removeLine,
    setLineQuantity,
    applyItems,
    save,
    remove,
  };
}
