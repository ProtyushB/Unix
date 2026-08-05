import { useMemo } from 'react';
import { FileService } from '../../../../backend/dms/service/file.service';
import type { PendingFile, ProductFile } from './productDetail.model';

// Imported by DIRECT PATH, never through `src/backend/dms/index.ts`. That barrel re-exports
// `useDmsImages`, which pulls in react-native-fs; nothing imports the barrel today, and that is the
// only reason the web preview bundles at all. (There is a stub now, but the direct path is still
// the right habit — it keeps a native-only dependency out of the graph entirely.)
let serviceInstance: FileService | null = null;
function fileService(): FileService {
  if (!serviceInstance) serviceInstance = new FileService();
  return serviceInstance;
}

/**
 * Turn the product's attached files plus anything freshly picked into URIs `<Image>` can render.
 *
 * VERIFIED against the live backend: the DMS read path is public. `getResourceUrl(id)` builds a
 * bare `…/file/get-resource?fileId=N` with no token, and an `<img>` pointed at a freshly uploaded
 * file loaded it with no `Authorization` header at all. The auth interceptors on `dmsApiClient` are
 * for the write side; reads do not need them.
 *
 * A `fetch()` of the same URL from the web preview DOES fail — that is CORS, not auth (no
 * `Access-Control-Allow-Origin` for localhost). `<Image>` performs no preflight, so it is
 * unaffected. Do not "fix" this by routing reads through the authed client.
 *
 * The `useDmsImages` fallback (ZIP → RNFS cache → `file://` paths) is therefore not needed. It
 * remains a one-function swap if the read path is ever locked down, which is the entire reason the
 * strip takes resolved URIs rather than file ids.
 */
export function useProductImages(files: ProductFile[], pending: PendingFile[]): string[] {
  const attachedKey = files
    .map((f) => f.dmsFileId)
    .filter((id) => id != null)
    .join(',');
  const pendingKey = pending.map((p) => p.uri).join(',');

  return useMemo(() => {
    const service = fileService();
    const attached = attachedKey
      ? attachedKey.split(',').map((id) => service.getResourceUrl(Number(id)))
      : [];
    // Freshly picked images go last, so the strip reads oldest-first and a new pick appears at the
    // end rather than shuffling what was already there.
    return [...attached, ...(pendingKey ? pendingKey.split(',') : [])];
  }, [attachedKey, pendingKey]);
}
