/**
 * Attaching photos to a bill's Quick Add lines.
 *
 * Three things make this its own module rather than a few lines inside the save path:
 *
 * 1. **It cannot run before the bill exists.** The DMS folder is named after the bill id, so the
 *    order is fixed: save → ensure folder → upload → link. That is true on create AND on edit,
 *    which is why there is one path here and not two.
 *
 * 2. **The link step is a NARROW PATCH, never a re-PUT.** `PUT /{module}Bill/{billId}` rebuilds
 *    the whole bill: it would mint a second auto-generated order for any order-required line and
 *    orphan the first, and it reprices and restocks every bare line. Re-sending the bill just to
 *    record a file id is the most expensive possible way to do it, and the damage is silent.
 *    `PATCH /{module}Bill/{billId}/quick-item-photos` exists for exactly this.
 *
 * 3. **A photo failure must never fail the bill.** The bill is already saved by the time any of
 *    this runs; throwing here would show the user an error for a save that succeeded. Every path
 *    below degrades to a list of names the caller reports in a warning.
 *
 * Pure and RN-free — the DMS client and the module api arrive as arguments — so the repo's
 * `*.test.ts`-only jest config can reach all of it.
 */

import {
  toDmsFiles,
  type DmsFile,
  type PendingFile,
  type UploadedFile,
} from '../../shared/detail/pendingFiles';

import type { QuickBillItem } from './quickItem';

/** One line's photo link, as the PATCH body carries it. Matched server-side by `lineId`. */
export interface QuickItemPhotoLink {
  lineId: string;
  dmsFolderId: number;
  photos: DmsFile[];
}

export interface EnsureBillItemFolderParams {
  businessId: number;
  billId: number;
  lineId: string;
  itemName?: string;
  currentFolderId?: number | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string | null;
  message?: string | null;
}

export interface QuickPhotoDeps {
  /**
   * `data` is `unknown` rather than a folder map on purpose: the module hooks all hand back the
   * same loose `{success, data?: unknown}` envelope, and narrowing is `readFolderId`'s job — it
   * has to cope with an unexpected shape anyway.
   */
  ensureBillItemFolder(params: EnsureBillItemFolderParams): Promise<ApiEnvelope<unknown>>;
  uploadFiles(files: PendingFile[], parentFolderId: number): Promise<UploadedFile[]>;
  attachQuickItemPhotos(billId: number, links: QuickItemPhotoLink[]): Promise<ApiEnvelope<unknown>>;
}

export interface QuickPhotoResult {
  links: QuickItemPhotoLink[];
  /** Item names whose photo did not make it. Empty means everything landed. */
  failed: string[];
  /**
   * The bill as the PATCH returned it — the freshest copy anyone has, because it is the only
   * response that knows about the photos.
   *
   * The caller must prefer this over the create/update response it already holds. That earlier
   * body was built before the files existed, so handing it upward would blank the photos out of
   * the screen the moment the parent re-derives its form from it.
   */
  saved?: unknown;
}

/**
 * The quick items that actually need an upload.
 *
 * This filter IS the "photoless items make no DMS call at all" rule. A bill of five typed items
 * with no photos returns an empty array here, `uploadQuickItemPhotos` returns early, and not one
 * DMS request is issued — no folder, no upload, no PATCH. The second clause matters on edit: an
 * item whose photo already uploaded keeps no staged file, so re-saving does not re-upload it.
 */
export function pendingPhotoItems(items: QuickBillItem[]): QuickBillItem[] {
  return items.filter((q) => q.photo && !q.photos?.length);
}

/**
 * Read the folder id out of the `ensure` response.
 *
 * The endpoint answers with a MAP, not a scalar, and the key it uses has varied. Reading
 * `folderId` first and falling back to the first value is what the product and service forms
 * already do; duplicating the shrug here rather than trusting one key.
 */
export function readFolderId(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const map = data as Record<string, unknown>;
  if (typeof map.folderId === 'number') return map.folderId;
  const first = Object.values(map)[0];
  return typeof first === 'number' ? first : null;
}

/**
 * Upload every staged photo and build the PATCH body.
 *
 * Sequential rather than parallel: each item needs its own folder, and the ensure call is the
 * cheap half of a pair whose expensive half is a multipart upload. Firing five uploads at a phone's
 * uplink at once makes all five slower and any one of them likelier to time out.
 *
 * One item's failure does not stop the others — it is recorded in `failed` and the rest continue,
 * so a single bad photo does not cost the user the four that would have worked.
 */
export async function uploadQuickItemPhotos(
  items: QuickBillItem[],
  context: { businessId: number; billId: number },
  deps: QuickPhotoDeps,
): Promise<QuickPhotoResult> {
  const pending = pendingPhotoItems(items);
  if (!pending.length) return { links: [], failed: [] };

  const links: QuickItemPhotoLink[] = [];
  const failed: string[] = [];

  for (const item of pending) {
    try {
      const folder = await deps.ensureBillItemFolder({
        businessId: context.businessId,
        billId: context.billId,
        lineId: item.lineId,
        // The backend names the folder `{itemName}_{lineId}` under the `Bill_{billId}` it ensures
        // itself. Sending the name is what keeps a renamed item's folder in step.
        ...(item.name ? { itemName: item.name } : {}),
        ...(item.dmsFolderId != null ? { currentFolderId: item.dmsFolderId } : {}),
      });

      const folderId = folder.success ? readFolderId(folder.data) : null;
      if (folderId == null) {
        failed.push(item.name);
        continue;
      }

      const files = [item.photo as PendingFile];
      const uploaded = await deps.uploadFiles(files, folderId);
      const photos = toDmsFiles(uploaded ?? [], files);
      if (!photos.length) {
        failed.push(item.name);
        continue;
      }

      links.push({ lineId: item.lineId, dmsFolderId: folderId, photos });
    } catch {
      // Deliberately swallowed. The bill is already saved; the caller warns with `failed`.
      failed.push(item.name);
    }
  }

  if (!links.length) return { links, failed };

  try {
    const res = await deps.attachQuickItemPhotos(context.billId, links);
    if (!res?.success) {
      // The files are in DMS but the bill does not point at them. Report the names rather than
      // claiming success — a second Save re-runs the whole path, and the ensure is idempotent.
      return { links: [], failed: [...failed, ...links.map((l) => nameOf(items, l.lineId))] };
    }
    return { links, failed, saved: res.data };
  } catch {
    return { links: [], failed: [...failed, ...links.map((l) => nameOf(items, l.lineId))] };
  }
}

function nameOf(items: QuickBillItem[], lineId: string): string {
  return items.find((i) => i.lineId === lineId)?.name ?? lineId;
}

/** The warning shown when some photos did not attach. The bill itself saved fine. */
export function photoWarning(failed: string[]): string | null {
  if (!failed.length) return null;
  return `Bill saved — couldn't attach the photo for ${failed.join(', ')}. Add it in edit mode.`;
}

/**
 * Fold the uploaded links back onto the items, clearing the staged file as they go.
 *
 * Clearing `photo` is what stops the next save re-uploading the same image: `pendingPhotoItems`
 * keys off it. It is also all the cleanup there is — unlike the web there is no object URL to
 * revoke, because the picker's own `uri` was the preview.
 */
export function applyPhotoLinks(
  items: QuickBillItem[],
  links: QuickItemPhotoLink[],
): QuickBillItem[] {
  if (!links.length) return items;
  const byLineId = new Map(links.map((l) => [l.lineId, l]));
  return items.map((item) => {
    const link = byLineId.get(item.lineId);
    if (!link) return item;
    return { ...item, dmsFolderId: link.dmsFolderId, photos: link.photos, photo: null };
  });
}
