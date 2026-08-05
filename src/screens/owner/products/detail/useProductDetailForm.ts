import { useCallback, useEffect, useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import { FileService } from '../../../../backend/dms/service/file.service';
import {
  addPack,
  buildCreatePayload,
  needsFolder,
  productFiles,
  removePack,
  removedFiles,
  toFormState,
  toUpdatePayload,
  updatePack,
  type PackLevel,
  type PendingFile,
  type ProductDetailItem,
  type ProductFile,
  type ProductFormState,
} from './productDetail.model';
import type { ProductModuleConfig } from './productDetail.modules';
import {
  UPLOAD_CEIL,
  UPLOAD_START as UPLOAD_START_PERCENT,
  hasErrors,
  savePhaseLabel,
  uploadPercent,
  validateProduct,
  type DetailMode,
} from './productDetail.view';

interface SaveResult {
  success: boolean;
  data?: unknown;
  error?: string | null;
  code?: string;
}

interface ModuleApi {
  createProduct(data: Record<string, unknown>): Promise<SaveResult>;
  updateProduct(data: Record<string, unknown>): Promise<SaveResult>;
  deleteProduct(id: number): Promise<SaveResult>;
  ensureProductFolder(params: {
    businessId: number;
    entityId: number;
    entityName?: string;
    currentFolderId?: number | null;
  }): Promise<SaveResult>;
}

interface UseProductDetailFormInput {
  mode: DetailMode;
  /** The DTO as last fetched. Null in add mode, and until the first load resolves. */
  item: ProductDetailItem | null;
  config: ProductModuleConfig;
  moduleApi: ModuleApi;
  businessId: number | null;
  onSaved: (saved: ProductDetailItem) => void;
  onDeleted: () => void;
}

/**
 * Form state and the save/delete paths for the Product Detail screen.
 *
 * Deliberately thin. Every decision — what the form looks like for a given DTO, what the payload
 * is, whether it validates, what the progress label says — is a call into `productDetail.model` or
 * `productDetail.view`, both of which are RN-free and unit-tested. If an `if` appears here that is
 * not `await`/`setState` plumbing, it is in the wrong file.
 */
export function useProductDetailForm({
  mode,
  item,
  config,
  moduleApi,
  businessId,
  onSaved,
  onDeleted,
}: UseProductDetailFormInput) {
  const [form, setForm] = useState<ProductFormState>(() =>
    toFormState(mode === 'add' ? config.extraDefaults : {}, config.extraFields),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savePercent, setSavePercent] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Files already on the record that the user has kept. Removals are diffed against the DTO. */
  const [keptFiles, setKeptFiles] = useState<ProductFile[]>([]);
  /** Picked but not yet uploaded. Nothing reaches DMS until the record has an id. */
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  // Reseed whenever a new record arrives. Keyed on the record's identity rather than the object,
  // so a re-render that merely re-wraps the same product does not discard what the user has typed.
  const itemId = item?.id ?? null;
  useEffect(() => {
    if (mode === 'add' || !item) return;
    setForm(toFormState(item, config.extraFields));
    setErrors({});
    setKeptFiles(productFiles(item));
    setPendingFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, mode, config.extraFields]);

  const setField = useCallback((field: keyof ProductFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }) as ProductFormState);
  }, []);

  const setExtra = useCallback((field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, extras: { ...prev.extras, [field]: value } }));
  }, []);

  const setExtras = useCallback((next: Record<string, unknown>) => {
    setForm((prev) => ({ ...prev, extras: next }));
  }, []);

  const onPackChange = useCallback((index: number, field: keyof PackLevel, value: string) => {
    setForm((prev) => ({ ...prev, packs: updatePack(prev.packs, index, field, value) }));
  }, []);

  const onAddPack = useCallback(() => {
    setForm((prev) => ({ ...prev, packs: addPack(prev.packs) }));
  }, []);

  const onRemovePack = useCallback((index: number) => {
    setForm((prev) => ({ ...prev, packs: removePack(prev.packs, index) }));
  }, []);

  const pickImages = useCallback(async () => {
    const response = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 0 });
    if (response.didCancel || !response.assets?.length) return;
    setPendingFiles((prev) => [
      ...prev,
      ...response
        .assets!.filter((a) => a.uri)
        .map((a) => ({
          uri: a.uri as string,
          fileName: a.fileName || `image-${prev.length + 1}.jpg`,
          type: a.type || 'image/jpeg',
        })),
    ]);
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
   * Called only AFTER the record exists, because the backend names the folder `{name}_{id}` and
   * cannot do that without an id. Returns null when there is nothing to do.
   *
   * Verified against live end to end — ensure-folder, multipart upload, and the second write that
   * links the file ids — but ONLY from the web preview, where the picker stub hands back a browser
   * `File`. On a device `launchImageLibrary` returns `{uri: 'file://…'}` and React Native's
   * FormData appends that object rather than a Blob. That one link is the last untested part of
   * this path, and the first place to look if upload fails on a device.
   */
  const uploadPending = useCallback(
    async (
      savedId: number,
      currentFolderId: number | null,
      productName: string,
      nameChanged: boolean,
    ): Promise<{ files: ProductFile[]; folderId: number | null } | null> => {
      if (!pendingFiles.length && !nameChanged) return null;
      if (businessId == null) return null;

      let folderId = currentFolderId;
      if (needsFolder(currentFolderId, pendingFiles.length, nameChanged)) {
        const folder = await moduleApi.ensureProductFolder({
          businessId,
          entityId: savedId,
          entityName: productName,
          currentFolderId,
        });
        const data = folder.data as Record<string, number> | undefined;
        // The controller answers with a map; take whichever key it used rather than assuming one.
        folderId = data ? (data.folderId ?? Object.values(data)[0] ?? folderId) : folderId;
      }

      if (!pendingFiles.length || folderId == null) return { files: keptFiles, folderId };

      setSavePercent(UPLOAD_START_PERCENT);
      const uploaded = await new FileService().createMultipleFiles(
        pendingFiles as unknown as Parameters<FileService['createMultipleFiles']>[0],
        folderId,
        [],
        (event) => setSavePercent(uploadPercent(event.loaded, event.total)),
      );
      setSavePercent(UPLOAD_CEIL);

      return {
        files: [...keptFiles, ...uploaded.map((f) => ({ dmsFileId: f.id as number }))],
        folderId,
      };
    },
    [pendingFiles, keptFiles, businessId, moduleApi],
  );

  const save = useCallback(async (): Promise<SaveResult> => {
    const found = { ...validateProduct(form), ...config.validate(form) };
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

      const original = productFiles(item);
      const nameChanged = !isAdd && String(item?.name ?? '') !== form.name.trim();
      const folderBefore = (item?.dmsFolderId as number | null) ?? null;

      // Phase 1 — the record. Note `createProduct` is called with NO files argument on purpose:
      // that path sets `dmsFileIds` on the payload, a field ProductDto does not have, so Spring
      // drops it and the images upload to DMS without ever being linked to the product.
      const payload = isAdd
        ? buildCreatePayload(form, businessId as number, config.extraDefaults)
        : // Built from the DTO the server last gave us, NOT from the form alone. PUT replaces the
          // whole record, so a key missing here is a key erased there.
          toUpdatePayload(item as ProductDetailItem, form, keptFiles, folderBefore);

      const result = isAdd
        ? await moduleApi.createProduct(payload)
        : await moduleApi.updateProduct(payload);

      if (!result.success) {
        setSaveError(result.error || 'Could not save this product.');
        return result;
      }

      const saved = (result.data as ProductDetailItem) ?? (payload as ProductDetailItem);
      const savedId = (saved.id as number) ?? (item?.id as number);

      // Phase 2 — images, now that there is an id to name the folder after. Deletions first, so a
      // removed image is gone even if the upload that follows fails.
      const gone = removedFiles(original, keptFiles);
      if (gone.length) {
        const service = new FileService();
        await Promise.allSettled(gone.map((f) => service.deleteFile(f.dmsFileId as number)));
      }

      let finalItem = saved;
      if (savedId != null) {
        try {
          const uploadResult = await uploadPending(
            savedId,
            (saved.dmsFolderId as number | null) ?? folderBefore,
            form.name.trim(),
            nameChanged,
          );
          if (uploadResult) {
            setSavePercent(92);
            // Phase 3 — link the uploaded files to the record. A second write, because the first
            // could not know the file ids.
            const linked = await moduleApi.updateProduct(
              toUpdatePayload(saved, form, uploadResult.files, uploadResult.folderId),
            );
            if (linked.success && linked.data) finalItem = linked.data as ProductDetailItem;
          }
        } catch (err) {
          // The record is already saved. Surfacing this as a hard failure would be a lie, and on
          // an add it would strand a product the user believes was not created.
          setSaveError(
            (err as Error).message || 'The product saved, but its images could not be uploaded.',
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
    if (item?.id == null) return { success: false, error: 'This product has not been saved yet.' };
    setSaving(true);
    setSaveError(null);
    try {
      const result = await moduleApi.deleteProduct(item.id);
      if (!result.success) {
        setSaveError(result.error || 'Could not delete this product.');
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
    setExtras,
    onPackChange,
    onAddPack,
    onRemovePack,
    pickImages,
    removeImage,
    save,
    remove,
  };
}
