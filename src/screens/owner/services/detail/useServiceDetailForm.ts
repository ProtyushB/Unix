import { useCallback, useEffect, useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import { FileService } from '../../../../backend/dms/service/file.service';
import { toDmsFiles, toPendingFiles } from '../../shared/detail/pendingFiles';
import {
  buildCreatePayload,
  needsFolder,
  removedFiles,
  serviceFiles,
  toFormState,
  toUpdatePayload,
  type PendingFile,
  type ServiceDetailItem,
  type ServiceFile,
  type ServiceFormState,
} from './serviceDetail.model';
import type { ServiceModuleConfig } from './serviceDetail.modules';
import {
  UPLOAD_CEIL,
  UPLOAD_START as UPLOAD_START_PERCENT,
  hasErrors,
  savePhaseLabel,
  uploadPercent,
  validateService,
  type DetailMode,
} from './serviceDetail.view';

interface SaveResult {
  success: boolean;
  data?: unknown;
  error?: string | null;
  code?: string;
}

interface ModuleApi {
  createService(data: Record<string, unknown>): Promise<SaveResult>;
  updateService(data: Record<string, unknown>): Promise<SaveResult>;
  deleteService(id: number): Promise<SaveResult>;
  ensureServiceFolder(params: {
    businessId: number;
    entityId: number;
    entityName?: string;
    currentFolderId?: number | null;
  }): Promise<SaveResult>;
}

interface UseServiceDetailFormInput {
  mode: DetailMode;
  /** The DTO as last fetched. Null in add mode, and until the first load resolves. */
  item: ServiceDetailItem | null;
  config: ServiceModuleConfig;
  moduleApi: ModuleApi;
  businessId: number | null;
  onSaved: (saved: ServiceDetailItem) => void;
  onDeleted: () => void;
}

/**
 * Form state and the save/delete paths for the Service Detail screen.
 *
 * Deliberately thin, same rule as its product sibling. Every decision — what the form looks like
 * for a given DTO, what the payload is, whether it validates, what the progress label says — is a
 * call into `serviceDetail.model` or `serviceDetail.view`, both RN-free and unit-tested. If an `if`
 * appears here that is not `await`/`setState` plumbing, it is in the wrong file.
 */
export function useServiceDetailForm({
  mode,
  item,
  config,
  moduleApi,
  businessId,
  onSaved,
  onDeleted,
}: UseServiceDetailFormInput) {
  const [form, setForm] = useState<ServiceFormState>(() =>
    toFormState(mode === 'add' ? config.extraDefaults : {}, config.extraFields),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savePercent, setSavePercent] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [keptFiles, setKeptFiles] = useState<ServiceFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  // Reseed whenever a new record arrives. Keyed on the record's identity rather than the object,
  // so a re-render that merely re-wraps the same service does not discard what the user has typed.
  const itemId = item?.id ?? null;
  useEffect(() => {
    if (mode === 'add' || !item) return;
    setForm(toFormState(item, config.extraFields));
    setErrors({});
    setKeptFiles(serviceFiles(item));
    setPendingFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, mode, config.extraFields]);

  const setField = useCallback((field: keyof ServiceFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }) as ServiceFormState);
  }, []);

  const setExtra = useCallback((field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, extras: { ...prev.extras, [field]: value } }));
  }, []);

  const setRequiredProducts = useCallback((next: number[]) => {
    setForm((prev) => ({ ...prev, requiredProductIds: next }));
  }, []);

  const pickImages = useCallback(async () => {
    const response = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 0 });
    if (response.didCancel) return;
    setPendingFiles((prev) => [...prev, ...toPendingFiles(response.assets, prev.length)]);
  }, []);

  /**
   * Remove by position across the combined strip: attached images first, then pending ones. The
   * strip shows one list, so it can only report one index — the split happens here.
   */
  const removeImage = useCallback(
    (index: number) => {
      if (index < keptFiles.length) {
        setKeptFiles((prev) => prev.filter((_, i) => i !== index));
        return;
      }
      const pendingIndex = index - keptFiles.length;
      setPendingFiles((prev) => prev.filter((_, i) => i !== pendingIndex));
    },
    [keptFiles.length],
  );

  /**
   * Push pending images to DMS and hand back the full file list for the record.
   *
   * Called only AFTER the record exists, because the backend names the folder from the entity's id
   * and cannot do that without one. Returns null when there is nothing to do.
   *
   * Verified against live end to end: ensure-folder (type SERVICE), the multipart upload, and the
   * second write that links the file ids. The device leg carried the same `fileName`/`name` bug the
   * product form did — see the note there; `toPendingFiles` owns that mapping now.
   */
  const uploadPending = useCallback(
    async (
      savedId: number,
      currentFolderId: number | null,
      serviceName: string,
      nameChanged: boolean,
    ): Promise<{ files: ServiceFile[]; folderId: number | null } | null> => {
      if (!pendingFiles.length && !nameChanged) return null;
      if (businessId == null) return null;

      let folderId = currentFolderId;
      if (needsFolder(currentFolderId, pendingFiles.length > 0, nameChanged)) {
        const folder = await moduleApi.ensureServiceFolder({
          businessId,
          entityId: savedId,
          entityName: serviceName,
          currentFolderId,
        });
        const data = folder.data as Record<string, number> | undefined;
        // The controller answers with a map; take whichever key it used rather than assuming one.
        folderId = data ? (data.folderId ?? Object.values(data)[0] ?? folderId) : folderId;
      }

      if (!pendingFiles.length || folderId == null) return { files: keptFiles, folderId };

      setSavePercent(UPLOAD_START_PERCENT);
      // No cast — see the note on the product form. The compiler is the guard here.
      const uploaded = await new FileService().createMultipleFiles(
        pendingFiles,
        folderId,
        [],
        (event) => setSavePercent(uploadPercent(event.loaded, event.total)),
      );
      setSavePercent(UPLOAD_CEIL);

      return {
        files: [...keptFiles, ...toDmsFiles(uploaded, pendingFiles)],
        folderId,
      };
    },
    [pendingFiles, keptFiles, businessId, moduleApi],
  );

  const save = useCallback(async (): Promise<SaveResult> => {
    const found = { ...validateService(form), ...config.validate(form) };
    setErrors(found);
    if (hasErrors(found)) {
      return { success: false, error: 'Please fix the highlighted fields.' };
    }

    setSaving(true);
    setSaveError(null);
    setSavePercent(8);
    try {
      const isAdd = mode === 'add' || item?.id == null;
      if (isAdd && businessId == null) {
        return { success: false, error: 'No business is selected.' };
      }

      const original = serviceFiles(item);
      const nameChanged = !isAdd && String(item?.name ?? '') !== form.name.trim();
      const folderBefore = (item?.dmsFolderId as number | null) ?? null;

      // Deletions first in both modes, so an image the user removed is gone even if what follows
      // fails. They are already off `keptFiles`, so nothing downstream re-links them.
      const gone = removedFiles(original, keptFiles);
      if (gone.length) {
        const service = new FileService();
        await Promise.allSettled(gone.map((f) => service.deleteFile(f.dmsFileId as number)));
      }

      /**
       * EDIT — upload FIRST, then write once. See the product form for the full reasoning: the
       * record already exists, so the file ids can ride in the same payload as the text edits
       * instead of costing a second full-object PUT. That matters more here than on products,
       * because a service PUT that drops `availability` is a 500 rather than a wrong value.
       */
      if (!isAdd) {
        let files = keptFiles;
        let folderId = folderBefore;
        try {
          const uploaded = await uploadPending(
            item?.id as number,
            folderBefore,
            form.name.trim(),
            nameChanged,
          );
          if (uploaded) {
            files = uploaded.files;
            folderId = uploaded.folderId;
          }
        } catch (err) {
          setSaveError(
            (err as Error).message || 'The images could not be uploaded. Other changes were saved.',
          );
        }

        setSavePercent(92);
        const edited = await moduleApi.updateService(
          toUpdatePayload(item as ServiceDetailItem, form, files, folderId),
        );
        if (!edited.success) {
          setSaveError(edited.error || 'Could not save this service.');
          return edited;
        }
        setSavePercent(100);
        setPendingFiles([]);
        const editedItem = (edited.data as ServiceDetailItem) ?? (item as ServiceDetailItem);
        onSaved(editedItem);
        return { success: true, data: editedItem };
      }

      // ADD — the folder is named after the record's id, so the record has to exist first.
      //
      // `createService` is called with NO files argument on purpose: that path sets `dmsFileIds` on
      // the payload, a field ServiceDto does not have, so Spring drops it and the images upload to
      // DMS without ever being linked to the service.
      const payload = buildCreatePayload(form, businessId as number, config.extraDefaults);
      const result = await moduleApi.createService(payload);

      if (!result.success) {
        setSaveError(result.error || 'Could not save this service.');
        return result;
      }

      const saved = (result.data as ServiceDetailItem) ?? (payload as ServiceDetailItem);
      const savedId = saved.id as number;

      let finalItem = saved;
      if (savedId != null) {
        try {
          const uploadResult = await uploadPending(
            savedId,
            (saved.dmsFolderId as number | null) ?? null,
            form.name.trim(),
            false,
          );
          if (uploadResult) {
            setSavePercent(92);
            // The second write exists only here, because the first could not know the file ids.
            const linked = await moduleApi.updateService(
              toUpdatePayload(saved, form, uploadResult.files, uploadResult.folderId),
            );
            if (linked.success && linked.data) finalItem = linked.data as ServiceDetailItem;
          }
        } catch (err) {
          // The record is already saved. Surfacing this as a hard failure would be a lie, and on
          // an add it would strand a service the user believes was not created.
          setSaveError(
            (err as Error).message || 'The service saved, but its images could not be uploaded.',
          );
        }
      }

      setSavePercent(100);
      setPendingFiles([]);
      onSaved(finalItem);
      return { success: true, data: finalItem };
    } finally {
      setSaving(false);
      setSavePercent(0);
    }
  }, [form, config, mode, item, businessId, moduleApi, onSaved, keptFiles, uploadPending]);

  const remove = useCallback(async (): Promise<SaveResult> => {
    if (item?.id == null) return { success: false, error: 'This service has not been saved yet.' };
    setSaving(true);
    setSaveError(null);
    try {
      const result = await moduleApi.deleteService(item.id);
      if (!result.success) {
        // Routinely refused: appointments, packages or bills may still reference the service.
        setSaveError(result.error || 'Could not delete this service.');
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
    savePercent,
    saveLabel: savePhaseLabel(savePercent),
    saveError,
    keptFiles,
    pendingFiles,
    setField,
    setExtra,
    setRequiredProducts,
    pickImages,
    removeImage,
    save,
    remove,
  };
}
