/**
 * useDmsImages Hook
 *
 * Takes an array of objects with dmsFileId, downloads ZIP via getMultipleResources,
 * uses RNFS to write extracted files to cache dir, returns map of { [dmsFileId]: 'file:///path' }.
 * Cleanup on unmount.
 */

import { useState, useEffect } from 'react';
import RNFS from 'react-native-fs';
import { FileService } from '../service/file.service';
import JSZip from 'jszip';

interface DmsFileRef {
  dmsFileId: number;
}

let serviceInstance: FileService | null = null;

function getServiceInstance(): FileService {
  if (!serviceInstance) {
    serviceInstance = new FileService();
  }
  return serviceInstance;
}

export function useDmsImages(files: DmsFileRef[]): Record<number, string> {
  const service = getServiceInstance();
  const [resolvedPaths, setResolvedPaths] = useState<Record<number, string>>({});

  const fileIdsKey = (Array.isArray(files) ? files : [])
    .map((f) => f?.dmsFileId)
    .filter(Boolean)
    .join(',');

  useEffect(() => {
    const ids = fileIdsKey ? fileIdsKey.split(',').map(Number) : [];
    if (!ids.length) {
      setResolvedPaths({});
      return;
    }

    let cancelled = false;
    const writtenPaths: string[] = [];

    (async () => {
      try {
        const arrayBuffer = await service.getMultipleResources(ids);
        if (cancelled) return;

        const zip = await JSZip.loadAsync(arrayBuffer);
        if (cancelled) return;

        // Identify redirect entries
        const redirectIds = new Set<number>();
        for (const name of Object.keys(zip.files)) {
          if (name.endsWith('.redirect')) {
            const id = parseInt(name.replace('file_', '').replace('.redirect', ''), 10);
            if (!isNaN(id)) redirectIds.add(id);
          }
        }

        const localFileIds = ids.filter((id) => !redirectIds.has(id));
        const localEntries = Object.values(zip.files).filter(
          (f) => !f.dir && !f.name.endsWith('.redirect'),
        );

        const pathMap: Record<number, string> = {};

        for (let i = 0; i < localEntries.length && i < localFileIds.length; i++) {
          if (cancelled) break;

          const entry = localEntries[i];
          const fileId = localFileIds[i];
          const base64Data = await entry.async('base64');

          // Determine extension from entry name
          const ext = entry.name.includes('.') ? entry.name.split('.').pop() : 'bin';
          const filePath = `${RNFS.CachesDirectoryPath}/dms_${fileId}.${ext}`;

          await RNFS.writeFile(filePath, base64Data, 'base64');
          writtenPaths.push(filePath);
          pathMap[fileId] = `file://${filePath}`;
        }

        if (!cancelled) {
          setResolvedPaths(pathMap);
        }
      } catch (err) {
        console.error('[useDmsImages]', err);
      }
    })();

    return () => {
      cancelled = true;
      // Cleanup written files
      for (const p of writtenPaths) {
        RNFS.unlink(p).catch(() => {});
      }
    };
  }, [fileIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return resolvedPaths;
}
