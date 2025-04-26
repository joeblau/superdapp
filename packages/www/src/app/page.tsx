"use client";

import { WebAuthnP256 } from 'ox'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

// Helper to generate a dummy challenge (INSECURE - FOR DEMO ONLY)
function generateChallenge(): ArrayBuffer {
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  return challenge.buffer;
}

export default function Home() {
  const [account, setAccount] = useState<string | null>(null)
  const [hasExistingCredential, setHasExistingCredential] = useState<boolean | null>(null);
  const [loggedInCredentialInfo, setLoggedInCredentialInfo] = useState<any>(null); // State for login info

  useEffect(() => {
    const checkCredentials = async () => {
      if (window.PublicKeyCredential &&
          PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
        try {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setHasExistingCredential(available);
          if (available) {
            console.log("Platform authenticator available. User might have a passkey.");
          } else {
            console.log("Platform authenticator *not* available.");
          }
        } catch (error) {
          console.error("Error checking authenticator availability:", error);
          setHasExistingCredential(false);
        }
      } else {
        console.log("WebAuthn or isUserVerifyingPlatformAuthenticatorAvailable not supported by this browser.");
        setHasExistingCredential(false);
      }
    };

    checkCredentials();
  }, []);

  const createAccount = async () => {
    try {
      console.log("Attempting to create credential...");
      const webAuthn = await WebAuthnP256.createCredential({ name: 'Joe' }); // Assuming RP name/id is handled by library
      console.log("Credential created:", webAuthn);
      // TODO: Extract and set the actual account identifier from 'webAuthn' object
      // setAccount(webAuthn.publicKey); // Example: Adjust based on actual structure
      setLoggedInCredentialInfo({ id: webAuthn.id, type: 'public-key' }); // Display basic info, assume type
      setAccount("Account Created - See Details Below"); // Placeholder
    } catch (error) {
      console.error('Failed to create account:', error);
    }
  }

  const loginWithPasskey = async () => {
    try {
      console.log("Attempting to get credential (login)...");
      // **INSECURE**: Challenge should come from your server (Relying Party)
      const challenge = generateChallenge();

      // Fix for linter error: Use standard navigator.credentials.get
      const credentialAssertion = await navigator.credentials.get({
         publicKey: {
           challenge: challenge,
           // rpId: window.location.hostname, // Usually needed, might be handled by ox library
           allowCredentials: [], // Empty allows discoverable credentials
           userVerification: 'preferred',
         }
      }) as PublicKeyCredential; // Cast to PublicKeyCredential

      console.log("Assertion received:", credentialAssertion);
      // TODO: Send assertion to server for verification
      // On success, server confirms login, and you update UI

      // For demo: Display some info from the assertion
      const response = credentialAssertion.response as AuthenticatorAssertionResponse;
      const userId = response.userHandle ? new TextDecoder().decode(response.userHandle) : 'N/A'; // Fix: Check userHandle before decoding

      setLoggedInCredentialInfo({
        id: credentialAssertion.id, // Base64 encoded likely
        type: credentialAssertion.type,
        userId: userId
      });
      setAccount("Logged In - See Details Below"); // Placeholder


    } catch (error) {
      console.error('Failed to login with passkey:', error);
      setLoggedInCredentialInfo(null); // Clear info on error
    }
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col items-center gap-4">
        <h1>WebAuthn Demo</h1>
        {hasExistingCredential === null && <p>Checking passkey support...</p>}
        {hasExistingCredential === true && !loggedInCredentialInfo && (
          <Button onClick={loginWithPasskey}>
            Login with Passkey
          </Button>
        )}
        {hasExistingCredential === false && !account && (
          <Button onClick={createAccount}>
            Create Account with Passkey
          </Button>
        )}
        {account && (
          <div className="mt-4 p-4 border rounded bg-green-100 text-green-800">
            <p className="font-bold">{account}</p>
          </div>
        )}
        {loggedInCredentialInfo && (
          <div className="mt-4 p-4 border rounded bg-blue-100 text-blue-800 text-sm break-all">
            <p className="font-bold">Credential Info:</p>
            <p>ID: {loggedInCredentialInfo.id}</p>
            <p>Type: {loggedInCredentialInfo.type}</p>
            <p>User ID (handle): {loggedInCredentialInfo.userId}</p>
            {/* Add other relevant info extracted from the credential/assertion */}
          </div>
        )}
        {hasExistingCredential === false && (
          <p className="text-sm text-gray-500 mt-2">No platform authenticator detected. You may need to use a different device/browser or security key.</p>
        )}
      </main>       
    </div>
  );
}
