"use client";

import { useEffect } from 'react';
// import { useWebAuthnEth } from '@/hooks/use-web-authn-eth'; // Remove old hook import
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { useRouter } from 'next/navigation';

export default function HomePage() {
  // Use context hook
  const { loggedInCredentialInfo, isLoading, hasExistingCredential } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && hasExistingCredential !== null) {
      if (loggedInCredentialInfo) {
        router.replace('/portfolio');
      } else {
        router.replace('/login');
      }
    }
  }, [loggedInCredentialInfo, isLoading, hasExistingCredential, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Loading...</p>
    </div>
  );
}
