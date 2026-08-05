import { useMemo } from 'react';
import { FileService } from '../../../../backend/dms/service/file.service';
import type { PendingFile, ServiceFile } from './serviceDetail.model';

// Imported by DIRECT PATH, never through `src/backend/dms/index.ts`. That barrel re-exports
// `useDmsImages`, which pulls in react-native-fs; keeping the native-only dependency out of the
// graph entirely is what lets the web preview bundle.
let serviceInstance: FileService | null = null;
function fileService(): FileService {
  if (!serviceInstance) serviceInstance = new FileService();
  return serviceInstance;
}

/**
 * Turn the service's attached files plus anything freshly picked into URIs `<Image>` can render.
 *
 * ⚠️ UNVERIFIED against a real backend — and it inherits the doubt from `useProductImages` rather
 * than adding a second one. `getResourceUrl(id)` builds a bare `…/file/get-resource?fileId=N` with
 * no token, yet Unix's `dmsApiClient` installs auth interceptors. If service images do not load,
 * check the product screen first: it is one function shared in spirit by both, not two bugs.
 *
 * The fallback is `useDmsImages` (ZIP → RNFS cache → `file://` paths), and swapping to it should be
 * a change to this one function — which is why the strip takes resolved URIs, not file ids.
 */
export function useServiceImages(files: ServiceFile[], pending: PendingFile[]): string[] {
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
