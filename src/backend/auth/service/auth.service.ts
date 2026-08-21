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
  OtpVerificationResult,
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
import { ApiError } from '../../shared/http/axiosError';

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
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$!%*?&#_-])[A-Za-z\d@#$!%*?&#_-]{8,}$/;
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

  async resendOtp(channel: string, value: string, isReset = false): Promise<ApiResponse<unknown>> {
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

  async verifyOtp(channel: string, value: string, otp: string): Promise<OtpVerificationResult> {
    if (!otp || otp.length !== 6) {
      throw new Error('OTP must be 6 digits');
    }
    try {
      const response = await this.api.verifyOtp(channel, value, otp);
      const data = response.data as OtpVerificationResult | boolean;
      // Tolerate the legacy bare-boolean backend: wrap it with a null token.
      if (typeof data === 'boolean') {
        return { verified: data, verificationToken: null };
      }
      return data;
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

  async signup(
    userData: SignupData,
  ): Promise<ApiResponse<{ accessToken: string; refreshToken: string }>> {
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

  /**
   * Emails the account's username to the address given.
   *
   * Deliberately reveals nothing: the caller shows the same confirmation
   * whether or not an account exists for this address, so the screen can't be
   * used to enumerate registered emails. Only a malformed address throws.
   */
  async forgotUsername(email: string): Promise<ApiResponse<unknown>> {
    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email address');
    }
    try {
      return await this.api.forgotUsername(email);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * True when a login already exists for this email.
   *
   * Fails OPEN — an unreachable check returns false and lets signup proceed,
   * because /auth/signup rejects a genuine duplicate anyway. Failing closed
   * would block every registration the moment this endpoint wobbled.
   */
  async emailHasAccount(email: string): Promise<boolean> {
    if (!this.isValidEmail(email)) return false;
    try {
      const response = await this.api.checkEmailRegistered(email);
      return response?.data === true;
    } catch {
      return false;
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

  /**
   * Normalise an axios rejection into an Error whose `message` is what this module's callers
   * already branch on — while keeping the body, so what the user is SHOWN can still be gated.
   *
   * The message text here is control flow, not display copy, which is why the four branches below
   * are untouched: `LoginScreen` lower-cases `err.message` and matches 'invalid credentials',
   * 'not found with username' and a network/econnrefused/timeout/enotfound pattern to pick which
   * sentence to show; `ForgotPasswordNewScreen` matches 'same as the old password', which is the
   * substring of THIS service's "New password cannot be the same as the old password" — it also
   * still carries the three keys it shipped with ('same password', 'previously used', 'must be
   * different'), none of which appears in that literal or anywhere else in this service; and
   * `isVerificationError` in `completeSignup` regex-matches what `signup` throws to decide whether
   * to bounce the user back to re-verify. Any of those turning into a fallback would re-route a
   * screen silently, with nothing failing.
   *
   * What changed is only that the body rides along. `completeSignup` runs this error through the
   * shared extractor — as do all four pre-login screens now, for the text they DISPLAY — and until
   * the body was attached that extractor found a bare `Error` — no `response`, nothing to
   * inspect — so `auth-service`'s `RuntimeException` handler, which answers with
   * `"Internal server error: " + ex.getMessage()`, went to the user as-is. With the body attached
   * the gate sees it. The re-verify bounce is unaffected because auth-service's `buildErrorResponse`
   * writes the SAME string into `message` and `error`, and all four verification strings are short
   * marker-free sentences the gate returns unchanged ("Email verification has expired. Please
   * verify your email again.", "Email not verified via OTP", and the two reset spellings).
   */
  private handleApiError(error: unknown): Error {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;
    const body = axiosError.response?.data;
    if (body?.error) {
      return new ApiError(body.error, body);
    }
    if (body?.message) {
      return new ApiError(body.message, body);
    }
    // No body to attach, so a plain Error is all there is — and all that is needed. axios wrote
    // this string itself ("Network Error", "timeout of 4000ms exceeded"), which is exactly what the
    // login screen's connectivity branch reads.
    if (axiosError.message) {
      return new Error(axiosError.message);
    }
    return new Error('An unexpected error occurred');
  }
}
