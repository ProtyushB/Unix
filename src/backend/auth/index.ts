/**
 * Auth Module - Public API
 *
 * Only the hook should be the primary interface for components.
 */

export { useAuth } from './hook/useAuth';
export { AUTH_API_CONFIG, OTP_CONFIG, AUTH_BASE_URL } from './config/api.config';
export { AuthService } from './service/auth.service';
export { getAuthService } from './provider/auth.provider';
export type { ApiResponse, SignupData, LoginResponse, TokenResponse, AuthUser } from './api/auth.api.interface';
