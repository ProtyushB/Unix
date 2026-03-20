/**
 * Auth API Implementation
 *
 * Implements the AuthApiInterface using axios to call the backend.
 * When the backend API changes, this file will be the ONLY file that changes.
 */

import {
  AuthApiInterface,
  ApiResponse,
  SignupData,
  LoginResponse,
  TokenResponse,
  AuthUser,
} from './auth.api.interface';
import authApiClient from '../config/axios.instance';

export class AuthApiImpl extends AuthApiInterface {
  // ==================== OTP Management ====================

  async requestOtp(channel: string, value: string): Promise<ApiResponse<unknown>> {
    const response = await authApiClient.post('/auth/request-otp', { channel, value });
    return response.data;
  }

  async resendOtp(channel: string, value: string, isReset = false): Promise<ApiResponse<unknown>> {
    const response = await authApiClient.post(
      `/auth/resend-otp${isReset ? '?resetOtp=true' : ''}`,
      { channel, value },
    );
    return response.data;
  }

  async verifyOtp(channel: string, value: string, otp: string): Promise<ApiResponse<boolean>> {
    const response = await authApiClient.post('/auth/verify-otp', { channel, value, otp });
    return response.data;
  }

  // ==================== Reset Password OTP ====================

  async requestResetPasswordOtp(channel: string, value: string): Promise<ApiResponse<unknown>> {
    const response = await authApiClient.post('/auth/request-reset-password-otp', {
      channel,
      value,
    });
    return response.data;
  }

  async resendResetOtp(channel: string, value: string): Promise<ApiResponse<unknown>> {
    const response = await authApiClient.post('/auth/resend-reset-otp', { channel, value });
    return response.data;
  }

  async verifyResetPasswordOtp(
    channel: string,
    value: string,
    otp: string,
  ): Promise<ApiResponse<boolean>> {
    const response = await authApiClient.post('/auth/verify-reset-password-otp', {
      channel,
      value,
      otp,
    });
    return response.data;
  }

  // ==================== Authentication ====================

  async signup(userData: SignupData): Promise<ApiResponse<TokenResponse>> {
    const response = await authApiClient.post('/auth/signup', userData);
    return response.data;
  }

  async login(username: string, password: string): Promise<ApiResponse<LoginResponse>> {
    const response = await authApiClient.post('/auth/login', { username, password });
    return response.data;
  }

  async refresh(refreshToken: string): Promise<ApiResponse<TokenResponse>> {
    const response = await authApiClient.post('/auth/refresh', { refreshToken });
    return response.data;
  }

  async resetPassword(email: string, newPassword: string): Promise<ApiResponse<unknown>> {
    const response = await authApiClient.post('/auth/reset-password', { email, newPassword });
    return response.data;
  }

  // ==================== User Management ====================

  async getUserById(id: number): Promise<ApiResponse<AuthUser>> {
    const response = await authApiClient.get(`/auth-user/${id}`);
    return response.data;
  }

  async getUserByUsername(username: string): Promise<ApiResponse<AuthUser>> {
    const response = await authApiClient.get(`/auth-user/username/${username}`);
    return response.data;
  }

  async getUserByEmail(email: string): Promise<ApiResponse<AuthUser>> {
    const response = await authApiClient.get(`/auth-user/email/${email}`);
    return response.data;
  }

  async getUserByPhone(phone: string): Promise<ApiResponse<AuthUser>> {
    const response = await authApiClient.get(`/auth-user/phone/${phone}`);
    return response.data;
  }

  async checkUsername(username: string): Promise<ApiResponse<boolean>> {
    const response = await authApiClient.get(`/auth-user/check-username/${username}`);
    return response.data;
  }

  async updateUser(id: number, userData: Partial<AuthUser>): Promise<ApiResponse<AuthUser>> {
    const response = await authApiClient.put(`/auth-user/${id}`, userData);
    return response.data;
  }

  async deleteUser(id: number): Promise<ApiResponse<unknown>> {
    const response = await authApiClient.delete(`/auth-user/${id}`);
    return response.data;
  }
}
