// ─── Email ───────────────────────────────────────────────────────────────────

export function validateEmail(email: string): boolean {
  // Standard RFC-ish email regex
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Phone (10-digit Indian mobile) ─────────────────────────────────────────

export function validatePhone(phone: string): boolean {
  return /^\d{10}$/.test(phone);
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
