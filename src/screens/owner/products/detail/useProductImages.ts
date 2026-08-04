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
 * ⚠️ UNVERIFIED against a real backend. `getResourceUrl(id)` builds a bare
 * `…/file/get-resource?fileId=N` with no token, yet Unix's `dmsApiClient` installs auth
 * interceptors — which suggests either the DMS read path is public (as the web portal assumes, and
 * it works there) or nobody has tried it from a client that is not already sending cookies. The
 * first thing to check on a device is whether these images actually load.
 *
 * If they do not, the fallback already exists: `useDmsImages` downloads a ZIP, unpacks it to the
 * cache directory and hands back `file://` paths. Swapping to it should be a change to this one
 * function and nothing else — which is the entire reason the strip takes resolved URIs rather than
 * file ids.
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
