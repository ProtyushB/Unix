/**
 * Auth Service Layer
 *
 * Business logic for the auth module:
 * - Validation
 * - Token management (AsyncStorage)
 * - Data transformation
 * - Error normalization
 */

import { getAuthApi } from '../provider/auth.provider';
import {
  AuthApiInterface,
  ApiResponse,
  SignupData,
  LoginResponse,
  AuthUser,
} from '../api/auth.api.interface';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearAccessToken,
  clearRefreshToken,
  getUser,
  setUser,
  clearUser,
  clearAllAuth,
  StoredUser,
} from '../../../storage/auth.storage';
import { AxiosError } from 'axios';

export class AuthService {
  private api: AuthApiInterface;

  constructor() {
    this.api = getAuthApi();
  }

  // ==================== VALIDATION UTILITIES ====================

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  isStrongPassword(password: string): boolean {
    const strongRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$!%*?&#_\-])[A-Za-z\d@#$!%*?&#_\-]{8,}$/;
    return strongRegex.test(password);
  }

  isValidUsername(username: string): boolean {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
  }

  // ==================== TOKEN MANAGEMENT ====================

  async storeTokens(accessToken: string, refreshToken: string): Promise<void> {
    await setAccessToken(accessToken);
    await setRefreshToken(refreshToken);
  }

  async getStoredAccessToken(): Promise<string | null> {
    return getAccessToken();
  }

  async getStoredRefreshToken(): Promise<string | null> {
    return getRefreshToken();
  }

  async clearTokens(): Promise<void> {
    await clearAccessToken();
    await clearRefreshToken();
  }

  // ==================== USER MANAGEMENT ====================

  async storeUser(user: StoredUser): Promise<void> {
    await setUser(user);
  }

  async getStoredUser(): Promise<StoredUser | null> {
    return getUser();
  }

  async clearStoredUser(): Promise<void> {
    await clearUser();
  }

  async hasRole(role: string): Promise<boolean> {
    const user = await getUser();
    const roles = user?.roles as string[] | undefined;
    return roles?.includes(role) || false;
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await getAccessToken();
    return !!token;
  }

  // ==================== OTP OPERATIONS ====================

  async requestOtp(channel: string, value: string): Promise<ApiResponse<unknown>> {
    if (channel === 'email' && !this.isValidEmail(value)) {
      throw new Error('Invalid email address');
    }
    if (channel === 'phone' && !this.isValidPhone(value)) {
      throw new Error('Invalid phone number');
    }
    try {
      return await this.api.requestOtp(channel, value);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async resendOtp(
    channel: string,
    value: string,
    isReset = false,
  ): Promise<ApiResponse<unknown>> {
    if (channel === 'email' && !this.isValidEmail(value)) {
      throw new Error('Invalid email address');
    }
    if (channel === 'phone' && !this.isValidPhone(value)) {
      throw new Error('Invalid phone number');
    }
    try {
      return await this.api.resendOtp(channel, value, isReset);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async verifyOtp(channel: string, value: string, otp: string): Promise<boolean> {
    if (!otp || otp.length !== 6) {
      throw new Error('OTP must be 6 digits');
    }
    try {
      const response = await this.api.verifyOtp(channel, value, otp);
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async requestResetPasswordOtp(channel: string, value: string): Promise<ApiResponse<unknown>> {
    if (channel === 'email' && !this.isValidEmail(value)) {
      throw new Error('Invalid email address');
    }
    try {
      return await this.api.requestResetPasswordOtp(channel, value);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async resendResetOtp(channel: string, value: string): Promise<ApiResponse<unknown>> {
    if (channel === 'email' && !this.isValidEmail(value)) {
      throw new Error('Invalid email address');
    }
    try {
      return await this.api.resendResetOtp(channel, value);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async verifyResetPasswordOtp(channel: string, value: string, otp: string): Promise<boolean> {
    if (!otp || otp.length !== 6) {
      throw new Error('OTP must be 6 digits');
    }
    try {
      const response = await this.api.verifyResetPasswordOtp(channel, value, otp);
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  // ==================== AUTHENTICATION OPERATIONS ====================

  async signup(userData: SignupData): Promise<ApiResponse<{ accessToken: string; refreshToken: string }>> {
    if (!userData.username || !this.isValidUsername(userData.username)) {
      throw new Error('Username must be 3-20 alphanumeric characters');
    }
    if (!userData.email || !this.isValidEmail(userData.email)) {
      throw new Error('Invalid email address');
    }
    if (!userData.password || !this.isStrongPassword(userData.password)) {
      throw new Error(
        'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@#$!%*?&#_-)',
      );
    }
    try {
      const response = await this.api.signup(userData);
      const { accessToken, refreshToken } = response.data;
      await this.storeTokens(accessToken, refreshToken);
      return response;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }
    try {
      const response = await this.api.login(username, password);
      const { accessToken, refreshToken, user } = response.data;

      await this.storeTokens(accessToken, refreshToken);
      await this.storeUser(user as StoredUser);

      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async refreshToken(): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshToken = await this.getStoredRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    try {
      const response = await this.api.refresh(refreshToken);
      const { accessToken, refreshToken: newRefreshToken } = response.data;
      await this.storeTokens(accessToken, newRefreshToken);
      return response.data;
    } catch (error) {
      await this.logout();
      throw this.handleApiError(error);
    }
  }

  async resetPassword(email: string, newPassword: string): Promise<ApiResponse<unknown>> {
    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email address');
    }
    if (!this.isStrongPassword(newPassword)) {
      throw new Error(
        'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@#$!%*?&#_-)',
      );
    }
    try {
      return await this.api.resetPassword(email, newPassword);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async logout(): Promise<void> {
    await clearAllAuth();
  }

  // ==================== USER OPERATIONS ====================

  async checkUsername(username: string): Promise<boolean> {
    if (!username || !this.isValidUsername(username)) {
      throw new Error('Invalid username format');
    }
    try {
      const response = await this.api.checkUsername(username);
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async getUserById(id: number): Promise<AuthUser> {
    try {
      const response = await this.api.getUserById(id);
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async getUserByUsername(username: string): Promise<AuthUser> {
    try {
      const response = await this.api.getUserByUsername(username);
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async updateUser(id: number, userData: Partial<AuthUser>): Promise<AuthUser> {
    try {
      const response = await this.api.updateUser(id, userData);
      const currentUser = await this.getStoredUser();
      if (currentUser && (currentUser as Record<string, unknown>).id === id) {
        await this.storeUser(response.data as unknown as StoredUser);
      }
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async deleteUser(id: number): Promise<void> {
    try {
      await this.api.deleteUser(id);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  // ==================== ERROR HANDLING ====================

  private handleApiError(error: unknown): Error {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;
    if (axiosError.response?.data?.error) {
      return new Error(axiosError.response.data.error);
    }
    if (axiosError.response?.data?.message) {
      return new Error(axiosError.response.data.message);
    }
    if (axiosError.message) {
      return new Error(axiosError.message);
    }
    return new Error('An unexpected error occurred');
  }
}
