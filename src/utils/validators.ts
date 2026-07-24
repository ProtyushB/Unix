// ─── Email ───────────────────────────────────────────────────────────────────

export function validateEmail(email: string): boolean {
  // Standard RFC-ish email regex
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Phone (10-digit Indian mobile) ─────────────────────────────────────────

/**
 * Reduces a typed phone number to the bare 10 digits the rest of the system
 * stores, or null when it isn't one.
 *
 * Drops every non-digit, then an optional 91 country code, so "+91 98200
 * 41122", "(98200) 41122" and "98200-41122" all collapse to the same value.
 * That matters beyond convenience: the person service matches walk-ins on
 * phoneNumber, so one number reaching it in two spellings would become two
 * different people and strand a claim.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return /^\d{10}$/.test(local) ? local : null;
}

export function validatePhone(phone: string): boolean {
  return normalizePhone(phone) !== null;
}

// ─── Username ────────────────────────────────────────────────────────────────

export function validateUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

// ─── Password Rules ──────────────────────────────────────────────────────────

export interface PasswordRule {
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    label: 'At least 8 characters',
    test: (pw: string) => pw.length >= 8,
  },
  {
    label: 'At least one uppercase letter',
    test: (pw: string) => /[A-Z]/.test(pw),
  },
  {
    label: 'At least one lowercase letter',
    test: (pw: string) => /[a-z]/.test(pw),
  },
  {
    label: 'At least one digit',
    test: (pw: string) => /\d/.test(pw),
  },
  {
    label: 'At least one special character (@$!%*?&#_-)',
    test: (pw: string) => /[@$!%*?&#_\-]/.test(pw),
  },
];

export function validatePassword(password: string): boolean {
  return PASSWORD_RULES.every(rule => rule.test(password));
}

// ─── Backend Regex (single-check equivalent) ────────────────────────────────

export const BACKEND_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$!%*?&#_\-])[A-Za-z\d@#$!%*?&#_\-]{8,}$/;
