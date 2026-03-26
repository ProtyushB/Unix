/**
 * useBusiness Hook
 *
 * React hook for standalone Business operations.
 */

import { useState, useCallback } from 'react';
import { BusinessService } from '../service/business.service';
import { BusinessDto, UpdateBusinessFlags } from '../../person/api/person.api.interface';

let serviceInstance: BusinessService | null = null;

function getServiceInstance(): BusinessService {
  if (!serviceInstance) {
    serviceInstance = new BusinessService();
  }
  return serviceInstance;
}

interface BusinessState {
  loading: boolean;
  error: string | null;
}

export function useBusiness() {
  const service = getServiceInstance();
  const [state, setState] = useState<BusinessState>({ loading: false, error: null });

  const createBusiness = useCallback(
    async (data: BusinessDto & { personId?: number }) => {
      setState({ loading: true, error: null });
      try {
        const result = await service.createBusiness(data);
        setState({ loading: false, error: result.success ? null : result.error });
        return result;
      } catch (err) {
        const errorMessage = (err as Error).message || 'Failed to create business';
        setState({ loading: false, error: errorMessage });
        return { success: false, data: null, error: errorMessage };
      }
    },
    [service],
  );

  const updateBusiness = useCallback(
    async (businessData: BusinessDto, flags?: UpdateBusinessFlags) => {
      setState({ loading: true, error: null });
      try {
        const result = await service.updateBusiness(businessData, flags);
        setState({ loading: false, error: result.success ? null : result.error });
        return result;
      } catch (err) {
        const errorMessage = (err as Error).message || 'Failed to update business';
        setState({ loading: false, error: errorMessage });
        return { success: false, data: null, error: errorMessage };
      }
    },
    [service],
  );

  const getBusinessById = useCallback(
    async (businessId: number) => {
      setState({ loading: true, error: null });
      try {
        const result = await service.getBusinessById(businessId);
        setState({ loading: false, error: result.success ? null : result.error });
        return result;
      } catch (err) {
        const errorMessage = (err as Error).message || 'Failed to get business';
        setState({ loading: false, error: errorMessage });
        return { success: false, data: null, error: errorMessage };
      }
    },
    [service],
  );

  const getAllBusinesses = useCallback(async () => {
    setState({ loading: true, error: null });
    try {
      const result = await service.getAllBusinesses();
      setState({ loading: false, error: result.success ? null : result.error });
      return result;
    } catch (err) {
      const errorMessage = (err as Error).message || 'Failed to get businesses';
      setState({ loading: false, error: errorMessage });
      return { success: false, data: null, error: errorMessage };
    }
  }, [service]);

  const deleteBusiness = useCallback(
    async (businessId: number) => {
      setState({ loading: true, error: null });
      try {
        const result = await service.deleteBusiness(businessId);
        setState({ loading: false, error: result.success ? null : result.error });
        return result;
      } catch (err) {
        const errorMessage = (err as Error).message || 'Failed to delete business';
        setState({ loading: false, error: errorMessage });
        return { success: false, data: null, error: errorMessage };
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
    createBusiness,
    updateBusiness,
    getBusinessById,
    getAllBusinesses,
    deleteBusiness,
    clearError,
  };
}
