/**
 * useFile Hook
 *
 * React hook for all DMS file operations.
 */

import { useState, useCallback } from 'react';
import { FileService } from '../service/file.service';
import { ResourceFileDto, NativeFile } from '../api/file.api.interface';

let serviceInstance: FileService | null = null;

function getServiceInstance(): FileService {
  if (!serviceInstance) {
    serviceInstance = new FileService();
  }
  return serviceInstance;
}

export function useFile() {
  const service = getServiceInstance();

  const [state, setState] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });

  const setLoading = () => setState({ loading: true, error: null });
  const setError = (msg: string) => setState({ loading: false, error: msg });
  const setDone = () => setState((prev) => ({ ...prev, loading: false }));

  const createMultipleFiles = useCallback(
    async (
      files: NativeFile[],
      parentFolderId: number,
      options?: Array<{ fileName?: string; metadata?: Record<string, unknown> }>,
    ): Promise<ResourceFileDto[]> => {
      setLoading();
      try {
        const results = await service.createMultipleFiles(files, parentFolderId, options);
        setDone();
        return results;
      } catch (error) {
        setError((error as Error).message);
        throw error;
      }
    },
    [service],
  );

  const getResource = useCallback(
    async (fileId: number): Promise<unknown> => {
      setLoading();
      try {
        const result = await service.getResource(fileId);
        setDone();
        return result;
      } catch (error) {
        setError((error as Error).message);
        throw error;
      }
    },
    [service],
  );

  const getMultipleResources = useCallback(
    async (fileIds: number[]): Promise<ArrayBuffer> => {
      setLoading();
      try {
        const result = await service.getMultipleResources(fileIds);
        setDone();
        return result;
      } catch (error) {
        setError((error as Error).message);
        throw error;
      }
    },
    [service],
  );

  const deleteFile = useCallback(
    async (fileId: number): Promise<boolean> => {
      setLoading();
      try {
        const result = await service.deleteFile(fileId);
        setDone();
        return result;
      } catch (error) {
        setError((error as Error).message);
        throw error;
      }
    },
    [service],
  );

  const getResourceUrl = useCallback(
    (fileId: number): string => {
      return service.getResourceUrl(fileId);
    },
    [service],
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    loading: state.loading,
    error: state.error,
    createMultipleFiles,
    getResource,
    getMultipleResources,
    deleteFile,
    getResourceUrl,
    clearError,
  };
}
