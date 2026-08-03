/**
 * Auth API Interface
 *
 * Defines the contract for all auth-related backend operations.
 * Contains NO implementation - only method signatures.
 *
 * IMPORTANT: This file must NEVER import anything except type definitions.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  totalPages?: number;
  error: string | null;
}

export interface SignupData {
  username: string;
  email: string;
  phone?: string;
  password: string;
  roles: string[];
  /**
   * Durable proof that the email was OTP-verified (minted by /auth/verify-otp,
   * ~30 min lifetime). Sent so signup validates against the token rather than
   * the 10-min Redis flag, which expires during a long profile/business/review
   * flow. Optional — the backend still falls back to the flag when absent.
   */
  verificationToken?: string;
}

/** Shape returned by /auth/verify-otp. Older backends returned a bare boolean. */
export interface OtpVerificationResult {
  verified: boolean;
  verificationToken: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  phone?: string;
  roles: string[];
  [key: string]: unknown;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export abstract class AuthApiInterface {
  // OTP Management
  abstract requestOtp(channel: string, value: string): Promise<ApiResponse<unknown>>;
  abstract resendOtp(
    channel: string,
    value: string,
    isReset?: boolean,
  ): Promise<ApiResponse<unknown>>;
  abstract verifyOtp(
    channel: string,
    value: string,
    otp: string,
  ): Promise<ApiResponse<OtpVerificationResult>>;

  // Reset Password OTP
  abstract requestResetPasswordOtp(channel: string, value: string): Promise<ApiResponse<unknown>>;
  abstract resendResetOtp(channel: string, value: string): Promise<ApiResponse<unknown>>;
  abstract verifyResetPasswordOtp(
    channel: string,
    value: string,
    otp: string,
  ): Promise<ApiResponse<boolean>>;

  // Authentication
  abstract signup(userData: SignupData): Promise<ApiResponse<TokenResponse>>;
  abstract login(username: string, password: string): Promise<ApiResponse<LoginResponse>>;
  abstract refresh(refreshToken: string): Promise<ApiResponse<TokenResponse>>;
  abstract resetPassword(email: string, newPassword: string): Promise<ApiResponse<unknown>>;
  abstract forgotUsername(email: string): Promise<ApiResponse<unknown>>;
  abstract checkEmailRegistered(email: string): Promise<ApiResponse<boolean>>;

  // User Management
  abstract getUserById(id: number): Promise<ApiResponse<AuthUser>>;
  abstract getUserByUsername(username: string): Promise<ApiResponse<AuthUser>>;
  abstract getUserByEmail(email: string): Promise<ApiResponse<AuthUser>>;
  abstract getUserByPhone(phone: string): Promise<ApiResponse<AuthUser>>;
  abstract checkUsername(username: string): Promise<ApiResponse<boolean>>;
  abstract updateUser(id: number, userData: Partial<AuthUser>): Promise<ApiResponse<AuthUser>>;
  abstract deleteUser(id: number): Promise<ApiResponse<unknown>>;
}
