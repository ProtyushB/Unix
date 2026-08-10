import type { ExpenseFile } from '../../../../backend/modules/shared/expense.types';
import type { PendingFile } from '../../shared/detail/pendingFiles';

/**
 * The receipt strip's arithmetic — what a row says, and which rows exist.
 *
 * RN-free so jest can cover it. A receipt is an ATTACHMENT, not a hero photo, which is why none of
 * this reuses `ImageStage`: that is a 3:4 paging stage built to frame a product shot, and a 477pt
 * photo carousel is the wrong shape for "a picture of a bill". The mockup draws a compact file row,
 * and so does this.
 */

/** One row of the strip — either already saved, or picked and not yet uploaded. */
export interface ReceiptRow {
  key: string;
  name: string;
  /** "PDF · 240 KB", or just "PDF" when the size is unknown. */
  meta: string;
  /** True for a document, false for a photo. Decides the glyph and whether a thumbnail is shown. */
  isDocument: boolean;
  /** Absent until the file has been uploaded — a pending row has no server URL yet. */
  url: string | null;
  /** True for a row that has not been uploaded, which is what the "Uploading…" hint keys on. */
  pending: boolean;
}

/**
 * "240 KB" / "1.4 MB" / "" when unknown.
 *
 * Hand-rolled rather than `Intl.NumberFormat`, matching the rest of this app: the same number
 * renders differently across JS engines, and a label a test cannot pin is a label that drifts.
 *
 * Uses 1024, because that is what every file manager the user compares this against uses.
 */
export function formatFileSize(bytes: number | null | undefined): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  // One decimal below 10 MB, none above — "1.4 MB" is useful, "14.3 MB" is noise.
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

/**
 * Whether a MIME type is something the strip can show as a picture.
 *
 * Anything not obviously an image is treated as a document, deliberately — the failure mode of
 * guessing "image" is a broken `<Image>` with no explanation, while the failure mode of guessing
 * "document" is a file glyph beside a correct filename, which is still readable.
 */
export function isImageType(type: string | null | undefined): boolean {
  return String(type ?? '')
    .toLowerCase()
    .startsWith('image/');
}

/**
 * The short kind label — "PDF", "JPG", "FILE".
 *
 * Read from the FILENAME's extension first and the MIME second. The extension is what the user
 * themselves sees in their file manager, and DMS has been observed to omit the content type
 * (`toDmsFiles` already carries a fallback for that case).
 */
export function fileKindLabel(name: string | null | undefined, type: string | null | undefined) {
  const ext = String(name ?? '')
    .split('.')
    .pop();
  if (ext && ext !== name && ext.length <= 4) return ext.toUpperCase();
  const sub = String(type ?? '').split('/')[1];
  return sub ? sub.toUpperCase() : 'FILE';
}

/** "PDF · 240 KB", collapsing to "PDF" when the size is unknown. */
export function receiptMeta(
  name: string | null | undefined,
  type: string | null | undefined,
  size: number | null | undefined,
): string {
  return [fileKindLabel(name, type), formatFileSize(size)].filter(Boolean).join(' · ');
}

/**
 * The strip's rows: everything already on the record, then everything picked this session.
 *
 * Saved first because that is the order they will be in after the save — a pending row jumping
 * position once it uploads reads as the list having reshuffled itself.
 *
 * Keys are prefixed by origin rather than being the array index: a saved file and a pending file
 * can share an index, and React would then reuse one row's state for the other.
 */
export function toReceiptRows(saved: ExpenseFile[], pending: PendingFile[]): ReceiptRow[] {
  const savedRows = (saved ?? []).map((f, i) => ({
    key: `saved-${f?.dmsFileId ?? i}`,
    name: String(f?.fileName ?? '').trim() || `Receipt ${i + 1}`,
    meta: receiptMeta(f?.fileName, f?.fileType, f?.fileSize),
    isDocument: !isImageType(f?.fileType),
    url: f?.url ?? null,
    pending: false,
  }));
  const pendingRows = (pending ?? []).map((f, i) => ({
    key: `pending-${i}-${f?.name ?? ''}`,
    name: String(f?.name ?? '').trim() || `Receipt ${savedRows.length + i + 1}`,
    meta: receiptMeta(f?.name, f?.type, f?.size),
    isDocument: !isImageType(f?.type),
    url: null,
    pending: true,
  }));
  return [...savedRows, ...pendingRows];
}

/**
 * Remove by position across the COMBINED strip — saved rows first, then pending.
 *
 * The strip renders one list, so it can only report one index; the split happens here. Returns both
 * arrays because the caller holds them separately: saved files travel on the payload, pending ones
 * are uploaded first.
 */
export function removeReceiptAt(
  saved: ExpenseFile[],
  pending: PendingFile[],
  index: number,
): { saved: ExpenseFile[]; pending: PendingFile[] } {
  if (index < 0) return { saved, pending };
  if (index < saved.length) {
    return { saved: saved.filter((_, i) => i !== index), pending };
  }
  const pendingIndex = index - saved.length;
  // Out of range: hand BOTH arrays back by reference rather than a filtered copy that removed
  // nothing. Both feed setState, and a new array identity is a re-render — and, on the payload
  // side, a `files` array that changed identity without changing content.
  if (pendingIndex >= pending.length) return { saved, pending };
  return { saved, pending: pending.filter((_, i) => i !== pendingIndex) };
}

/** The strip's copy. */
export const RECEIPT_ADD_CTA = 'Add photo or PDF';
export const RECEIPT_EMPTY = 'No receipt attached.';
/** Shown on a row that has been picked but not yet sent. */
export const RECEIPT_PENDING_HINT = 'Will upload when you save';
