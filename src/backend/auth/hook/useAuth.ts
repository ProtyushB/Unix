/**
 * useAuth Hook
 *
 * The ONLY entry point for UI components to access auth functionality.
 * Manages loading/error states, orchestrates service calls.
 *
 * UI components should NEVER import services or APIs directly.
 */

import { useState, useEffect, useCallback } from 'react';
import { AuthService } from '../service/auth.service';
import { SignupData, AuthUser, LoginResponse } from '../api/auth.api.interface';
import { StoredUser } from '../../../storage/auth.storage';

let serviceInstance: AuthService | null = null;

function getServiceInstance(): AuthService {
  if (!serviceInstance) {
    serviceInstance = new AuthService();
  }
  return serviceInstance;
}

interface AuthState {
  user: StoredUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export function useAuth() {
  const service = getServiceInstance();

  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    isAuthenticated: false,
  });

  // ==================== OTP OPERATIONS ====================

  const requestOtp = useCallback(
    async (channel: string, value: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await service.requestOtp(channel, value);
        setState((prev) => ({ ...prev, loading: false }));
        return true;
      } catch (error) {
        const message = (error as Error).message;
        setState((prev) => ({ ...prev, error: message, loading: false }));
        throw error;
      }
    },
    [service],
  );

  const resendOtp = useCallback(
    async (channel: string, value: string, isReset = false): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await service.resendOtp(channel, value, isReset);
        setState((prev) => ({ ...prev, loading: false }));
        return true;
      } catch (error) {
        const message = (error as Error).message;
        setState((prev) => ({ ...prev, error: message, loading: false }));
        throw error;
      }
    },
    [service],
  );

  const verifyOtp = useCallback(
    async (channel: string, value: string, otp: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const isValid = await service.verifyOtp(channel, value, otp);
        setState((prev) => ({ ...prev, loading: false }));
        return isValid;
      } catch (error) {
        const message = (error as Error).message;
        setState((prev) => ({ ...prev, error: message, loading: false }));
        throw error;
      }
    },
    [service],
  );

  const requestResetPasswordOtp = useCallback(
    async (channel: string, value: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await service.requestResetPasswordOtp(channel, value);
        setState((prev) => ({ ...prev, loading: false }));
        return true;
      } catch (error) {
        const message = (error as Error).message;
        setState((prev) => ({ ...prev, error: message, loading: false }));
        throw error;
      }
    },
    [service],
  );

  const resendResetOtp = useCallback(
    async (channel: string, value: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await service.resendResetOtp(channel, value);
        setState((prev) => ({ ...prev, loading: false }));
        return true;
      } catch (error) {
        const message = (error as Error).message;
        setState((prev) => ({ ...prev, error: message, loading: false }));
        throw error;
      }
    },
    [service],
  );

  const verifyResetPasswordOtp = useCallback(
    async (channel: string, value: string, otp: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const isValid = await service.verifyResetPasswordOtp(channel, value, otp);
        setState((prev) => ({ ...prev, loading: false }));
        return isValid;
      } catch (error) {
        const message = (error as Error).message;
        setState((prev) => ({ ...prev, error: message, loading: false }));
        throw error;
      }
    },
    [service],
  );

  // ==================== AUTHENTICATION OPERATIONS ====================

  const signup = useCallback(
    async (userData: SignupData) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await service.signup(userData);
        setState((prev) => ({
          ...prev,
          loading: false,
          isAuthenticated: true,
        }));
        return result;
      } catch (error) {
        const message = (error as Error).message;
        setState((prev) => ({ ...prev, error: message, loading: false }));
        throw error;
      }
    },
    [service],
  );

  const login = useCallback(
    async (username: string, password: string): Promise<LoginResponse> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await service.login(username, password);
        setState((prev) => ({
          ...prev,
          user: result.user as StoredUser,
          loading: false,
          isAuthenticated: true,
        }));
        return result;
      } catch (error) {
        const message = (error as Error).message;
        setState((prev) => ({ ...prev, error: message, loading: false }));
        throw error;
      }
    },
    [service],
  );

  const logout = useCallback(async () => {
    await service.logout();
    setState({
      user: null,
      loading: false,
      error: null,
      isAuthenticated: false,
    });
  }, [service]);

  const resetPassword = useCallback(
    async (email: string, newPassword: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await service.resetPassword(email, newPassword);
        setState((prev) => ({ ...prev, loading: false }));
        return true;
      } catch (error) {
        const message = (error as Error).message;
        setState((prev) => ({ ...prev, error: message, loading: false }));
        throw error;
      }
    },
    [service],
  );

  // ==================== USER OPERATIONS ====================

  const checkUsername = useCallback(
    async (username: string): Promise<boolean> => {
      try {
        return await service.checkUsername(username);
      } catch (error) {
        throw error;
      }
    },
    [service],
  );

  const updateUser = useCallback(
    async (id: number, userData: Partial<AuthUser>): Promise<AuthUser> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const updatedUser = await service.updateUser(id, userData);
        setState((prev) => ({
          ...prev,
          user: updatedUser as unknown as StoredUser,
          loading: false,
        }));
        return updatedUser;
      } catch (error) {
        const message = (error as Error).message;
        setState((prev) => ({ ...prev, error: message, loading: false }));
        throw error;
      }
    },
    [service],
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // ==================== SYNC USER STATE ON MOUNT ====================

  useEffect(() => {
    let mounted = true;
    (async () => {
      const user = await service.getStoredUser();
      const isAuthenticated = await service.isAuthenticated();
      if (mounted) {
        setState((prev) => ({
          ...prev,
          user,
          isAuthenticated,
          loading: false,
        }));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [service]);

  // ==================== RETURN API ====================

  return {
    // State
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated: state.isAuthenticated,

    // OTP Operations
    requestOtp,
    resendOtp,
    verifyOtp,
    requestResetPasswordOtp,
    resendResetOtp,
    verifyResetPasswordOtp,

    // Authentication
    signup,
    login,
    logout,
    resetPassword,

    // User Operations
    checkUsername,
    updateUser,

    // Utilities
    clearError,
  };
}
