import React, { createContext, useContext, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignupDraft {
  email: string;
  username: string;
  password: string;
  /**
   * Durable OTP-verification proof (JWT, ~30 min) minted at the verify step and
   * carried through to signup, so account creation isn't gated by the 10-min
   * Redis flag during a long profile/business/review flow. Null on legacy
   * backends that return a bare boolean.
   */
  verificationToken?: string | null;
}

/**
 * Set when the post-OTP triage matches an existing walk-in Person for the
 * verified email. Its presence is what makes the final step call claimCustomer
 * (link the existing profile) instead of createPerson (insert a new one), and
 * it seeds the prefilled name/phone on the profile step.
 */
export interface ClaimContext {
  personId: number;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

interface SignupDraftContextValue {
  setDraft: (draft: SignupDraft) => void;
  getDraft: () => SignupDraft | null;
  clearDraft: () => void;
  setClaim: (claim: ClaimContext) => void;
  getClaim: () => ClaimContext | null;
  clearClaim: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SignupDraftContext = createContext<SignupDraftContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const SignupDraftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const draftRef = useRef<SignupDraft | null>(null);
  const claimRef = useRef<ClaimContext | null>(null);

  return (
    <SignupDraftContext.Provider
      value={{
        setDraft: (draft) => {
          draftRef.current = draft;
        },
        getDraft: () => draftRef.current,
        clearDraft: () => {
          draftRef.current = null;
        },
        setClaim: (claim) => {
          claimRef.current = claim;
        },
        getClaim: () => claimRef.current,
        clearClaim: () => {
          claimRef.current = null;
        },
      }}
    >
      {children}
    </SignupDraftContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useSignupDraft = (): SignupDraftContextValue => {
  const ctx = useContext(SignupDraftContext);
  if (!ctx) throw new Error('useSignupDraft must be used within SignupDraftProvider');
  return ctx;
};
