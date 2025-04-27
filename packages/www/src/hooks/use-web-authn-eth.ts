"use client";

import { useState, useEffect, useCallback } from 'react';
import { WebAuthnP256 } from 'ox';
import { privateKeyToAccount } from 'viem/accounts';
import { bytesToHex, stringToBytes, hexToBytes } from 'viem';

// Local storage key for storing the credential ID
const WEBAUTHN_CREDENTIAL_ID_KEY = "webauthnCredentialId";

// --- Helper Functions ---

// Helper to generate a dummy challenge (INSECURE - FOR DEMO ONLY)
function generateChallenge(): ArrayBuffer {
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  return challenge.buffer;
}

/**
 * Derives a deterministic 32-byte private key from a WebAuthn credential ID using HKDF.
 * WARNING: This method uses the credentialId (potentially public) and a fixed salt.
 * It is NOT cryptographically secure for high-value keys. For demonstration purposes only.
 *
 * @param credentialIdB64 The base64url encoded credential ID from WebAuthn.
 * @returns A promise that resolves to the derived private key as a hex string.
 */
async function deriveEthKeyFromCredentialId(credentialIdB64: string): Promise<`0x${string}`> {
  // Fixed salt for HKDF. In a real app, this might be application-specific.
  const salt = stringToBytes("webauthn-eth-derive-salt-v1"); // Use a specific salt
  // Context information for HKDF.
  const info = stringToBytes("webauthn-eth-hkdf-info");

  // The credential ID is typically base64url encoded, needs conversion to ArrayBuffer
  // 1. Replace base64url specific chars
  const base64 = credentialIdB64.replace(/-/g, '+').replace(/_/g, '/');
  // 2. Decode base64 string to binary string
  const binaryString = window.atob(base64);
  // 3. Convert binary string to Uint8Array
  const len = binaryString.length;
  const credentialIdBytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    credentialIdBytes[i] = binaryString.charCodeAt(i);
  }
  const credentialIdBuffer = credentialIdBytes.buffer;

  // Import the credential ID as the input key material (IKM) for HKDF
  const ikm = await window.crypto.subtle.importKey(
    'raw',
    credentialIdBuffer,
    { name: 'HKDF' },
    false, // not extractable
    ['deriveBits']
  );

  // Derive the private key bits using HKDF
  const derivedBytes = await window.crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      salt: salt,
      info: info,
      hash: 'SHA-256' // Use SHA-256 for HKDF
    },
    ikm,
    256 // Derive 256 bits (32 bytes) for the private key
  );

  return bytesToHex(new Uint8Array(derivedBytes));
}

// --- Custom Hook ---

export function useWebAuthnEth() {
  const [account, setAccount] = useState<string | null>(null);
  const [hasExistingCredential, setHasExistingCredential] = useState<boolean | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [loggedInCredentialInfo, setLoggedInCredentialInfo] = useState<any>(null);
  const [ethAddress, setEthAddress] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  // Start isLoading as true to cover initial checks and auto-login attempt
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // State to track if the initial auto-login attempt is done
  const [initialAuthCheckComplete, setInitialAuthCheckComplete] = useState<boolean>(false);

  // Combined effect for checking authenticator and attempting auto-login
  useEffect(() => {
    let isMounted = true; // Prevent state updates if component unmounts

    const performInitialChecks = async () => {
        let platformAuthAvailable = false;
        // 1. Check for platform authenticator availability
        if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
            try {
                platformAuthAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                if (isMounted) setHasExistingCredential(platformAuthAvailable);
                console.log(`Platform authenticator available: ${platformAuthAvailable}`);
            } catch (error) {
                console.error("Error checking authenticator availability:", error);
                if (isMounted) setHasExistingCredential(false);
            }
        } else {
            console.log("WebAuthn or isUserVerifyingPlatformAuthenticatorAvailable not supported.");
            if (isMounted) setHasExistingCredential(false);
        }

        // 2. Attempt auto-login if platform authenticator is available
        const storedCredIdB64 = localStorage.getItem(WEBAUTHN_CREDENTIAL_ID_KEY);
        if (platformAuthAvailable && storedCredIdB64) {
            console.log("Attempting auto-login with stored credential ID:", storedCredIdB64);
            try {
                const challenge = generateChallenge();
                // Convert base64url ID back to ArrayBuffer
                const base64 = storedCredIdB64.replace(/-/g, '+').replace(/_/g, '/');
                const binaryString = window.atob(base64);
                const len = binaryString.length;
                const credentialIdBytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    credentialIdBytes[i] = binaryString.charCodeAt(i);
                }

                const credentialAssertion = await navigator.credentials.get({
                    publicKey: {
                        challenge: challenge,
                        userVerification: 'preferred',
                        allowCredentials: [{
                            type: 'public-key',
                            id: credentialIdBytes.buffer,
                        }],
                        // rpId: window.location.hostname // Include if needed, usually inferred
                    }
                }) as PublicKeyCredential;

                console.log("Auto-login assertion successful:", credentialAssertion);
                const webAuthnCredId = credentialAssertion.id; // This is base64url encoded

                console.log("Deriving ETH key for auto-login...");
                const privateKeyHex = await deriveEthKeyFromCredentialId(webAuthnCredId);
                const ethAccount = privateKeyToAccount(privateKeyHex);
                const ethAccountAddress = ethAccount.address;
                console.log(`Auto-login successful. ETH Address: ${ethAccountAddress}`);

                if (isMounted) {
                    setLoggedInCredentialInfo({ id: webAuthnCredId, type: credentialAssertion.type });
                    setAccount(`Logged In (${webAuthnCredId.substring(0, 10)}...)`);
                    setEthAddress(ethAccountAddress);
                    setLoginError(null); // Clear any previous errors
                }

            } catch (error) {
                console.error("Auto-login failed:", error);
                 if (error instanceof Error && (error.name === 'NotAllowedError' || error.message.includes('aborted'))) {
                    console.log("Auto-login cancelled or timed out.");
                    // Don't clear the stored ID if user cancelled, they might try again
                 } else {
                    // For other errors (e.g., credential invalid/not found), clear the stored ID
                    localStorage.removeItem(WEBAUTHN_CREDENTIAL_ID_KEY);
                    console.log("Removed invalid credential ID from storage.");
                 }
                 // Ensure state reflects failed auto-login if component still mounted
                 if (isMounted) {
                    setLoggedInCredentialInfo(null);
                    setAccount(null);
                    setEthAddress(null);
                 }
            }
        } else {
             console.log("Skipping auto-login: No platform authenticator or no stored credential ID.");
        }

        // Mark initial checks as complete and set loading to false
        if (isMounted) {
            setInitialAuthCheckComplete(true);
            setIsLoading(false);
        }
    };

    performInitialChecks();

    return () => {
        isMounted = false; // Cleanup function to set isMounted to false
    };
  }, []); // Run only once on mount

  // Define login first as create might call it
  const loginAndAccessEthKey = useCallback(async () => {
    // Don't run if initial checks are still loading
    if (isLoading && !initialAuthCheckComplete) {
        console.log("Login blocked: Initial auth check in progress.");
        return;
    }
    setLoginError(null);
    setLoggedInCredentialInfo(null);
    setEthAddress(null);
    setIsLoading(true);
    console.log(`[Login] Current hostname (inferred rpId): ${window.location.hostname}`);
    try {
      console.log("Attempting WebAuthn login...");
      const challenge = generateChallenge();
      // Request assertion without specific credential IDs to allow any registered passkey for this RP
      const credentialAssertion = await navigator.credentials.get({
         publicKey: { challenge: challenge, userVerification: 'preferred' /* rpId can be omitted if matching current domain */ }
      }) as PublicKeyCredential;
      console.log("WebAuthn Assertion received:", credentialAssertion);

      const webAuthnCredId = credentialAssertion.id; // This is base64url encoded
      console.log(`[Login] Obtained credentialId: ${webAuthnCredId}`);

      // Store credential ID in local storage on successful login
      localStorage.setItem(WEBAUTHN_CREDENTIAL_ID_KEY, webAuthnCredId);
      console.log(`[Login] Stored credentialId in localStorage: ${webAuthnCredId}`);

      console.log("Deriving Ethereum key from credential ID:", webAuthnCredId);
      const privateKeyHex = await deriveEthKeyFromCredentialId(webAuthnCredId);
      console.log(`[Login] Derived private key hex: ${privateKeyHex}`);
      const ethAccount = privateKeyToAccount(privateKeyHex);
      const ethAccountAddress = ethAccount.address;
      console.log(`[Login] Derived ETH address: ${ethAccountAddress}`);
      console.log("Derived Ethereum Address:", ethAccountAddress);
      console.warn("SECURITY WARNING: ETH key derived directly from credentialId. Suitable for demo only.");

      const accountStatusMsg = `Logged In (${webAuthnCredId.substring(0, 10)}...)`;

      // NO local storage check needed anymore (handled by auto-login)

      setLoggedInCredentialInfo({ id: webAuthnCredId, type: credentialAssertion.type });
      setAccount(accountStatusMsg);
      setEthAddress(ethAccountAddress);

    } catch (error) {
      console.error('Failed during login/key access:', error);
      const errorMsg = error instanceof Error ? error.message : "An unknown login error occurred.";
      // Distinguish cancellation from other errors if possible
      if (error instanceof Error && (error.name === 'NotAllowedError' || error.message.includes('aborted') || error.message.includes('The operation was aborted'))) {
          console.log("WebAuthn login operation cancelled by user or timed out.");
          // Optionally set a specific state or message for cancellation
          setLoginError("Login cancelled or timed out."); 
      } else {
          setLoginError(errorMsg);
      }
    } finally {
        setIsLoading(false);
    }
  }, [isLoading, initialAuthCheckComplete]); // Add dependencies

  const createAccountAndEthKey = useCallback(async () => {
    // Don't run if initial checks are still loading
    if (isLoading && !initialAuthCheckComplete) {
        console.log("Create account blocked: Initial auth check in progress.");
        return;
    }
    setLoginError(null);
    setIsLoading(true);
    console.log(`[Create] Current hostname (inferred rpId): ${window.location.hostname}`);

    // Remove login attempt from within create - simplify flow
    // User should explicitly click "Login" or "Create"

    try {
        console.log("Attempting to create WebAuthn credential...");
        const webAuthn = await WebAuthnP256.createCredential({ name: 'Superdapp' });
        console.log("WebAuthn Credential created:", webAuthn);
        const webAuthnCredId = webAuthn.id; // This is base64url encoded
        console.log(`[Create] Obtained credentialId: ${webAuthnCredId}`);

        // Store credential ID in local storage on successful creation
        localStorage.setItem(WEBAUTHN_CREDENTIAL_ID_KEY, webAuthnCredId);
        console.log(`[Create] Stored credentialId in localStorage: ${webAuthnCredId}`);


        console.log("Deriving Ethereum key from credential ID:", webAuthnCredId);
        const privateKeyHex = await deriveEthKeyFromCredentialId(webAuthnCredId);
        console.log(`[Create] Derived private key hex: ${privateKeyHex}`);
        const ethAccount = privateKeyToAccount(privateKeyHex);
        console.log(`[Create] Derived ETH address: ${ethAccount.address}`);
        console.log("Derived Ethereum Address:", ethAccount.address);
        console.warn("SECURITY WARNING: ETH key derived directly from credentialId. Suitable for demo only.");

        // NO local storage needed anymore (handled by auto-login)

        setLoggedInCredentialInfo({ id: webAuthnCredId, type: 'public-key' });
        setAccount(`WebAuthn Account Created (${webAuthnCredId.substring(0, 10)}...)`);
        setEthAddress(ethAccount.address);

    } catch (createError) {
      console.error('Failed to create account/key:', createError);
      // Keep existing error handling
      if (createError instanceof Error && createError.name === 'NotAllowedError') {
        console.log("Credential creation cancelled or not allowed (NotAllowedError).");
        setLoginError("Passkey creation was cancelled or is not allowed.");
      } else {
        const errorMsg = createError instanceof Error ? createError.message : "An unknown creation error occurred.";
        setLoginError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  // Remove loginAndAccessEthKey dependency, add isLoading and initialAuthCheckComplete
  }, [isLoading, initialAuthCheckComplete]);

  const logout = useCallback(() => {
    // Clear credential ID from local storage on logout
    localStorage.removeItem(WEBAUTHN_CREDENTIAL_ID_KEY);
    console.log("Cleared credential ID from localStorage.");

    setAccount(null);
    setLoggedInCredentialInfo(null);
    setEthAddress(null);
    setLoginError(null);
    // Optionally set isLoading back to false if it was true
    setIsLoading(false);
    console.log("User logged out.");
  }, []);

  // Return state and actions
  return {
    account,
    hasExistingCredential,
    loggedInCredentialInfo,
    ethAddress,
    loginError,
    isLoading,
    createAccountAndEthKey,
    loginAndAccessEthKey,
    logout,
  };
} 