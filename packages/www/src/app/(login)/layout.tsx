"use client";

import { useEffect } from 'react';
// import { useWebAuthnEth } from '@/hooks/use-web-authn-eth'; // Remove old hook import
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { useRouter } from 'next/navigation';

export default function LoggedInLayout({ children }: { children: React.ReactNode }) {
  // Use context hook
  const { loggedInCredentialInfo, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If loading is finished and user is not logged in, redirect to login page
    if (!isLoading && !loggedInCredentialInfo) {
      router.replace('/login');
    }
  }, [isLoading, loggedInCredentialInfo, router]);

  // While loading or if logged in, show the children (the actual page)
  // We might show a loading spinner while isLoading is true
  if (isLoading || !loggedInCredentialInfo) {
    // Render a loading state or null while checking auth or redirecting
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading user session...</p>
        {/* Consider a more visually appealing loading indicator */}
      </div>
    );
  }

  // User is logged in, render the protected page content
  return <>{children}</>;
} 