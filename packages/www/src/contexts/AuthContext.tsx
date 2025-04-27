"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useWebAuthnEth } from '@/hooks/use-web-authn-eth';

// Define the shape of the context value based on the hook's return
type AuthContextType = {
  account: string | null;
  hasExistingCredential: boolean | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loggedInCredentialInfo: any; // Keep 'any' for now as it was in the hook
  ethAddress: string | null;
  loginError: string | null;
  isLoading: boolean;
  createAccountAndEthKey: () => Promise<void>;
  loginAndAccessEthKey: () => Promise<void>;
  logout: () => void;
};

// Create the context with a default value
const AuthContext = createContext<AuthContextType | null>(null);

// Create a provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useWebAuthnEth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

// Create a custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 