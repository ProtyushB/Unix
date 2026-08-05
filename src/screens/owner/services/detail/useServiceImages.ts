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
 * VERIFIED against the live backend, same as `useProductImages`: the DMS read path is public, and
 * an `<img>` on a freshly uploaded service image loaded with no `Authorization` header. A `fetch()`
 * of the same URL fails from the web preview, but that is CORS rather than auth — `<Image>` does no
 * preflight. See that hook for the full note; the two share one behaviour, not two bugs.
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
