"use client";

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const {
    loggedInCredentialInfo,
    hasExistingCredential,
    isLoading,
    createAccountAndEthKey,
    loginAndAccessEthKey,
  } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && loggedInCredentialInfo) {
      router.replace('/portfolio');
    }
  }, [isLoading, loggedInCredentialInfo, router]);

  if (loggedInCredentialInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen p-4 md:p-8">
      <main className="w-full max-w-md flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold mb-6">Login / Register</h1>

        {/* Loading State */}
        {isLoading && <p>Processing...</p>}

        {/* Initial Check State */}
        {hasExistingCredential === null && !isLoading && <p>Checking passkey support...</p>}

        {/* WebAuthn Not Supported State */}
        {hasExistingCredential === false && !isLoading && (
            <p className="text-sm text-red-500 mt-2 w-full text-center">
              No platform authenticator detected or supported. You may need to use a different device/browser or security key.
            </p>
        )}

        {/* WebAuthn Supported, Not Logged In State */}
        {hasExistingCredential === true && !isLoading && !loggedInCredentialInfo && (
          <div className="flex flex-col gap-3 w-full">
            <Button onClick={loginAndAccessEthKey} className="w-full">
              Login with Passkey
            </Button>
            <Button onClick={createAccountAndEthKey} variant="secondary" className="w-full">
              Create New Passkey Account
            </Button>
          </div>
        )}

        {/* Add a placeholder or message if the user is somehow already logged in on this page */}
        {/* This might happen if redirection hasn't occurred yet */}
        {/* We might need a redirect based on loggedInCredentialInfo later */}

      </main>
    </div>
  );
}
