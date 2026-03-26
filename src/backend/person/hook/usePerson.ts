/**
 * usePerson Hook
 *
 * React hook for Person/Business operations.
 * Primary entry point for UI components.
 */

import { useState, useCallback } from 'react';
import { PersonService } from '../service/person.service';
import { PersonDto, BusinessDto, UpdatePersonFlags } from '../api/person.api.interface';

let serviceInstance: PersonService | null = null;

function getServiceInstance(): PersonService {
  if (!serviceInstance) {
    serviceInstance = new PersonService();
  }
  return serviceInstance;
}

interface PersonState {
  loading: boolean;
  error: string | null;
}

export function usePerson() {
  const service = getServiceInstance();
  const [state, setState] = useState<PersonState>({ loading: false, error: null });

  const createPerson = useCallback(
    async (personData: PersonDto & { businesses?: BusinessDto[] }) => {
      setState({ loading: true, error: null });
      try {
        const result = await service.createPerson(personData);
        if (!result.success) {
          setState({ loading: false, error: result.error });
        } else {
          setState({ loading: false, error: null });
        }
        return result;
      } catch (err) {
        const errorMessage = (err as Error).message || 'Failed to create person';
        setState({ loading: false, error: errorMessage });
        return { success: false, data: null, error: errorMessage };
      }
    },
    [service],
  );

  const updatePerson = useCallback(
    async (personData: PersonDto, flags?: UpdatePersonFlags) => {
      setState({ loading: true, error: null });
      try {
        const result = await service.updatePerson(personData, flags);
        if (!result.success) {
          setState({ loading: false, error: result.error });
        } else {
          setState({ loading: false, error: null });
        }
        return result;
      } catch (err) {
        const errorMessage = (err as Error).message || 'Failed to update person';
        setState({ loading: false, error: errorMessage });
        return { success: false, data: null, error: errorMessage };
      }
    },
    [service],
  );

  const getPersonById = useCallback(
    async (personId: number) => {
      setState({ loading: true, error: null });
      try {
        const result = await service.getPersonById(personId);
        if (!result.success) {
          setState({ loading: false, error: result.error });
        } else {
          setState({ loading: false, error: null });
        }
        return result;
      } catch (err) {
        const errorMessage = (err as Error).message || 'Failed to get person';
        setState({ loading: false, error: errorMessage });
        return { success: false, data: null, error: errorMessage };
      }
    },
    [service],
  );

  const getPersonByUsername = useCallback(
    async (username: string) => {
      setState({ loading: true, error: null });
      try {
        const result = await service.getPersonByUsername(username);
        if (!result.success) {
          setState({ loading: false, error: result.error });
        } else {
          setState({ loading: false, error: null });
        }
        return result;
      } catch (err) {
        const errorMessage = (err as Error).message || 'Failed to get person by username';
        setState({ loading: false, error: errorMessage });
        return { success: false, data: null, error: errorMessage };
      }
    },
    [service],
  );

  const getAllPersons = useCallback(async () => {
    setState({ loading: true, error: null });
    try {
      const result = await service.getAllPersons();
      if (!result.success) {
        setState({ loading: false, error: result.error });
      } else {
        setState({ loading: false, error: null });
      }
      return result;
    } catch (err) {
      const errorMessage = (err as Error).message || 'Failed to get persons';
      setState({ loading: false, error: errorMessage });
      return { success: false, data: null, error: errorMessage };
    }
  }, [service]);

  const deletePerson = useCallback(
    async (personId: number) => {
      setState({ loading: true, error: null });
      try {
        const result = await service.deletePerson(personId);
        if (!result.success) {
          setState({ loading: false, error: result.error });
        } else {
          setState({ loading: false, error: null });
        }
        return result;
      } catch (err) {
        const errorMessage = (err as Error).message || 'Failed to delete person';
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

    // Person
    createPerson,
    updatePerson,
    getPersonById,
    getPersonByUsername,
    getAllPersons,
    deletePerson,

    clearError,
  };
}
