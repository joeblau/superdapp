"use client";

import { useState, useEffect, useCallback } from 'react';
import { WebAuthnP256 } from 'ox';
import { privateKeyToAccount } from 'viem/accounts';
import { bytesToHex, stringToBytes } from 'viem';

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
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Check for WebAuthn availability on mount
  useEffect(() => {
    const checkCredentials = async () => {
      if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
        try {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setHasExistingCredential(available);
          if (available) {
            console.log("Platform authenticator available.");
          } else {
            console.log("Platform authenticator *not* available.");
          }
        } catch (error) {
          console.error("Error checking authenticator availability:", error);
          setHasExistingCredential(false);
        }
      } else {
        console.log("WebAuthn or isUserVerifyingPlatformAuthenticatorAvailable not supported.");
        setHasExistingCredential(false);
      }
    };
    checkCredentials();
  }, []);

  // Define login first as create might call it
  const loginAndAccessEthKey = useCallback(async () => {
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

      console.log("Deriving Ethereum key from credential ID:", webAuthnCredId);
      const privateKeyHex = await deriveEthKeyFromCredentialId(webAuthnCredId);
      console.log(`[Login] Derived private key hex: ${privateKeyHex}`);
      const ethAccount = privateKeyToAccount(privateKeyHex);
      const ethAccountAddress = ethAccount.address;
      console.log(`[Login] Derived ETH address: ${ethAccountAddress}`);
      console.log("Derived Ethereum Address:", ethAccountAddress);
      console.warn("SECURITY WARNING: ETH key derived directly from credentialId. Suitable for demo only.");

      const accountStatusMsg = `Logged In (${webAuthnCredId.substring(0, 10)}...)`;

      // NO local storage check needed anymore

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
  }, []); // No dependencies needed here
  const createAccountAndEthKey = useCallback(async () => {
    setLoginError(null);
    setIsLoading(true);
    console.log(`[Create] Current hostname (inferred rpId): ${window.location.hostname}`);
    
    try {
      // First try to login with existing credentials
      console.log("Attempting to login with existing credentials first...");
      await loginAndAccessEthKey();
      console.log("Successfully logged in with existing credential");
      
    } catch (loginError) {
      console.log("No existing credential found or login failed, creating new credential...");
      
      try {
        console.log("Attempting to create WebAuthn credential...");
        // Use a consistent name for the relying party
        const webAuthn = await WebAuthnP256.createCredential({ name: 'Superdapp' });
        console.log("WebAuthn Credential created:", webAuthn);
        const webAuthnCredId = webAuthn.id; // This is base64url encoded
        console.log(`[Create] Obtained credentialId: ${webAuthnCredId}`);

        console.log("Deriving Ethereum key from credential ID:", webAuthnCredId);
        const privateKeyHex = await deriveEthKeyFromCredentialId(webAuthnCredId);
        console.log(`[Create] Derived private key hex: ${privateKeyHex}`);
        const ethAccount = privateKeyToAccount(privateKeyHex);
        console.log(`[Create] Derived ETH address: ${ethAccount.address}`);
        console.log("Derived Ethereum Address:", ethAccount.address);
        console.warn("SECURITY WARNING: ETH key derived directly from credentialId. Suitable for demo only.");

        // NO local storage needed anymore

        setLoggedInCredentialInfo({ id: webAuthnCredId, type: 'public-key' });
        setAccount(`WebAuthn Account Created (${webAuthnCredId.substring(0, 10)}...)`);
        setEthAddress(ethAccount.address);
        
      } catch (createError) {
        console.error('Failed to create account/key:', createError);
        
        if (createError instanceof Error && createError.name === 'NotAllowedError') {
          // Handle cancellation or refusal by the user/browser separately
          console.log("Credential creation cancelled or not allowed (NotAllowedError).");
          setLoginError("Passkey creation was cancelled or is not allowed.");
        } else {
          // Handle other types of errors
          const errorMsg = createError instanceof Error ? createError.message : "An unknown creation error occurred.";
          setLoginError(errorMsg);
        }
        
        // We don't need to handle ConstraintError separately anymore since we try login first
      }
    } finally {
      setIsLoading(false);
    }
  }, [loginAndAccessEthKey]); // loginAndAccessEthKey dependency is correct here

  const logout = useCallback(() => {
    setAccount(null);
    setLoggedInCredentialInfo(null);
    setEthAddress(null);
    setLoginError(null);
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