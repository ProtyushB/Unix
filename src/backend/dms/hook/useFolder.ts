/**
 * useFolder Hook
 *
 * React hook for all DMS folder operations.
 */

import { useState, useCallback } from 'react';
import { FolderService } from '../service/folder.service';
import { FolderDto, FolderFilterRequest } from '../api/folder.api.interface';

let serviceInstance: FolderService | null = null;

function getServiceInstance(): FolderService {
  if (!serviceInstance) {
    serviceInstance = new FolderService();
  }
  return serviceInstance;
}

export function useFolder() {
  const service = getServiceInstance();

  const [state, setState] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });

  const setLoading = () => setState({ loading: true, error: null });
  const setError = (msg: string) => setState({ loading: false, error: msg });
  const setDone = () => setState((prev) => ({ ...prev, loading: false }));

  const createFolder = useCallback(
    async (folderDto: FolderDto): Promise<FolderDto> => {
      setLoading();
      try {
        const result = await service.createFolder(folderDto);
        setDone();
        return result;
      } catch (error) {
        setError((error as Error).message);
        throw error;
      }
    },
    [service],
  );

  const createMultipleFolders = useCallback(
    async (folderDtoList: FolderDto[]): Promise<FolderDto[]> => {
      setLoading();
      try {
        const results = await service.createMultipleFolders(folderDtoList);
        setDone();
        return results;
      } catch (error) {
        setError((error as Error).message);
        throw error;
      }
    },
    [service],
  );

  const viewFolder = useCallback(
    async (folderId: number | null | undefined, isChildsRequired = false): Promise<FolderDto> => {
      setLoading();
      try {
        const result = await service.viewFolder(folderId, isChildsRequired);
        setDone();
        return result;
      } catch (error) {
        setError((error as Error).message);
        throw error;
      }
    },
    [service],
  );

  const viewMultipleFolders = useCallback(
    async (filterRequest: FolderFilterRequest): Promise<FolderDto[]> => {
      setLoading();
      try {
        const results = await service.viewMultipleFolders(filterRequest);
        setDone();
        return results;
      } catch (error) {
        setError((error as Error).message);
        throw error;
      }
    },
    [service],
  );

  const updateFolder = useCallback(
    async (folderDto: FolderDto): Promise<FolderDto> => {
      setLoading();
      try {
        const result = await service.updateFolder(folderDto);
        setDone();
        return result;
      } catch (error) {
        setError((error as Error).message);
        throw error;
      }
    },
    [service],
  );

  const updateMultipleFolders = useCallback(
    async (folderDtoList: FolderDto[]): Promise<FolderDto[]> => {
      setLoading();
      try {
        const results = await service.updateMultipleFolders(folderDtoList);
        setDone();
        return results;
      } catch (error) {
        setError((error as Error).message);
        throw error;
      }
    },
    [service],
  );

  const deleteFolder = useCallback(
    async (folderId: number): Promise<string> => {
      setLoading();
      try {
        const result = await service.deleteFolder(folderId);
        setDone();
        return result;
      } catch (error) {
        setError((error as Error).message);
        throw error;
      }
    },
    [service],
  );

  const deleteMultipleFolders = useCallback(
    async (folderIds: number[]): Promise<string> => {
      setLoading();
      try {
        const result = await service.deleteMultipleFolders(folderIds);
        setDone();
        return result;
      } catch (error) {
        setError((error as Error).message);
        throw error;
      }
    },
    [service],
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    loading: state.loading,
    error: state.error,
    createFolder,
    createMultipleFolders,
    viewFolder,
    viewMultipleFolders,
    updateFolder,
    updateMultipleFolders,
    deleteFolder,
    deleteMultipleFolders,
    clearError,
  };
}
