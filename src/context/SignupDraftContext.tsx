import React, { createContext, useContext, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignupDraft {
  email: string;
  username: string;
  password: string;
}

interface SignupDraftContextValue {
  setDraft: (draft: SignupDraft) => void;
  getDraft: () => SignupDraft | null;
  clearDraft: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SignupDraftContext = createContext<SignupDraftContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const SignupDraftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const draftRef = useRef<SignupDraft | null>(null);

  return (
    <SignupDraftContext.Provider
      value={{
        setDraft: (draft) => { draftRef.current = draft; },
        getDraft: () => draftRef.current,
        clearDraft: () => { draftRef.current = null; },
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
