/**
 * Turning an image-picker asset into something React Native can upload.
 *
 * This lives in its own RN-free module for one reason: getting it wrong is silent. The product and
 * service forms both had this mapping inline in their hooks, where the repo's jest config cannot
 * reach it (`testMatch` is `*.test.ts`, and a hook needs a renderer anyway) — and both spelled the
 * filename key `fileName`. Uploads then failed on every real device while the web preview passed,
 * because the preview's picker stub hands back a browser `File`, which carries `.name` natively.
 */

/** Exactly the shape `FileService.createMultipleFiles` wants — see `NativeFile`. */
export interface PendingFile {
  uri: string;
  /**
   * NOT `fileName`. React Native's `FormData.append` reads `value.name` to build the part's
   * `filename=`; anything else leaves it undefined, the part ships without a filename, and Spring
   * declines to bind a filename-less part to `MultipartFile[]`. The request still returns 200 —
   * it simply carries no file. That is what made this invisible.
   */
  name: string;
  type: string;
  /**
   * Byte size, carried only so the saved `DMS_File.fileSize` can be filled in. Not sent as part of
   * the multipart body — React Native ignores any key beyond uri/name/type.
   */
  size?: number;
}

/** The subset of `react-native-image-picker`'s Asset that matters here. */
export interface PickedAsset {
  uri?: string;
  fileName?: string;
  type?: string;
  fileSize?: number;
}

/** What DMS returns for each uploaded file. */
export interface UploadedFile {
  id?: number;
  url?: string;
  fileName?: string;
  contentType?: string;
}

/**
 * A `DMS_File` row as the module DTOs store it.
 *
 * A `type`, not an `interface`, on purpose: only a type alias gets TypeScript's implicit index
 * signature, which is what lets these rows sit in `ProductFile[]`/`ServiceFile[]` — both of which
 * carry `[k: string]: unknown`, because the server's file rows hold more than this.
 */
export type DmsFile = {
  dmsFileId: number;
  url: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
};

/**
 * Map an upload response onto the `DMS_File` rows that go back on the record.
 *
 * All five fields, not just the id. The screens resolve images by id, so the rest is invisible
 * here — but the web portal writes them, and a row saved from the phone that carried only an id
 * left `fileType` and `fileSize` empty, so the same table ended up with two shapes depending on
 * which client last saved.
 *
 * `pending` is positional: DMS returns results in the order they were sent. It is only consulted
 * for values the response omits, which is why the size comes from the picked asset.
 */
export function toDmsFiles(results: UploadedFile[], pending: PendingFile[] = []): DmsFile[] {
  return results.map((r, i) => ({
    dmsFileId: r.id as number,
    url: r.url ?? null,
    fileName: r.fileName ?? pending[i]?.name ?? null,
    // DMS does echo a content type today, but the web portal found cases where it did not — keep
    // the picked asset's MIME as the fallback rather than storing null.
    fileType: r.contentType ?? pending[i]?.type ?? null,
    fileSize: pending[i]?.size ?? null,
  }));
}

/**
 * Map picked assets onto upload-ready files, dropping any the picker returned without a uri.
 *
 * `startIndex` is the count already pending, so the generated fallback names stay unique across
 * successive picks rather than restarting at 1 and colliding.
 *
 * ⚠️ The FALLBACKS assume an image, and that is correct for its two original callers — the product
 * and service forms open `launchImageLibrary({ mediaType: 'photo' })`, so an asset with no
 * `fileName` is a photo whatever else is missing. A caller that can pick a PDF must not inherit
 * them: naming a receipt `image-1.jpg` and declaring it `image/jpeg` would upload a PDF that every
 * reader then tries to decode as a photo. Such callers pass `fallback` — see `toPendingDocuments`.
 */
export function toPendingFiles(
  assets: PickedAsset[] | undefined,
  startIndex = 0,
  fallback: { namePrefix: string; extension: string; type: string } = {
    namePrefix: 'image',
    extension: 'jpg',
    type: 'image/jpeg',
  },
): PendingFile[] {
  if (!assets?.length) return [];
  return assets
    .filter((a) => !!a.uri)
    .map((a, i) => ({
      uri: a.uri as string,
      // Some Android providers hand back an asset with no fileName at all; the server needs one.
      name: a.fileName || `${fallback.namePrefix}-${startIndex + i + 1}.${fallback.extension}`,
      type: a.type || fallback.type,
      size: a.fileSize,
    }));
}

/**
 * The shape `expo-document-picker` returns, narrowed to what matters here.
 *
 * Its keys differ from the image picker's — `name` and `size` rather than `fileName` and
 * `fileSize`, and `mimeType` rather than `type` — which is exactly the kind of near-miss that
 * uploads a filename-less part and still answers 200.
 */
export interface PickedDocument {
  uri?: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

/**
 * Map documents from `expo-document-picker` onto upload-ready files.
 *
 * A separate function rather than a flag on `toPendingFiles`, because the INPUT shape differs, not
 * just the fallbacks. Normalising here keeps the difference in one tested place instead of at every
 * call site.
 *
 * The fallback type is `application/octet-stream`, not a PDF MIME: a document picker that omits
 * `mimeType` has told us nothing about the file, and guessing "PDF" would be a claim rather than a
 * default. The server stores whatever arrives and the viewer branches on it.
 */
export function toPendingDocuments(
  documents: PickedDocument[] | undefined,
  startIndex = 0,
): PendingFile[] {
  if (!documents?.length) return [];
  return documents
    .filter((d) => !!d.uri)
    .map((d, i) => ({
      uri: d.uri as string,
      name: d.name || `document-${startIndex + i + 1}`,
      type: d.mimeType || 'application/octet-stream',
      size: d.size,
    }));
}
