"use client";

import { useState, useEffect, useCallback } from 'react';
import { WebAuthnP256 } from 'ox';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { bytesToHex, hexToBytes } from 'viem';

// --- Helper Functions ---

// Helper to generate a dummy challenge (INSECURE - FOR DEMO ONLY)
function generateChallenge(): ArrayBuffer {
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  return challenge.buffer;
}

async function generateSymmetricKey(): Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

async function encryptData(key: CryptoKey, data: Uint8Array): Promise<{ iv: Uint8Array, encryptedData: ArrayBuffer }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedData = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data
  );
  return { iv, encryptedData };
}

async function decryptData(key: CryptoKey, iv: Uint8Array, encryptedData: ArrayBuffer): Promise<Uint8Array> {
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encryptedData
  );
  return new Uint8Array(decrypted);
}

// --- Custom Hook ---

export function useWebAuthnEth() {
  const [account, setAccount] = useState<string | null>(null);
  const [hasExistingCredential, setHasExistingCredential] = useState<boolean | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [loggedInCredentialInfo, setLoggedInCredentialInfo] = useState<any>(null);
  const [ethAddress, setEthAddress] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false); // Add loading state

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

  // Wrap core logic functions in useCallback for stability
  const createAccountAndEthKey = useCallback(async () => {
    setLoginError(null);
    setIsLoading(true);
    try {
      console.log("Attempting to create WebAuthn credential...");
      const webAuthn = await WebAuthnP256.createCredential({ name: 'Superdapp' });
      console.log("WebAuthn Credential created:", webAuthn);
      const webAuthnCredId = webAuthn.id;

      const secp256k1PrivateKeyBytes = hexToBytes(generatePrivateKey());
      const ethAccount = privateKeyToAccount(bytesToHex(secp256k1PrivateKeyBytes));
      console.log("Generated Ethereum Address:", ethAccount.address);

      const symmetricKey = await generateSymmetricKey();
      const exportedSymKey = await window.crypto.subtle.exportKey("jwk", symmetricKey);

      const { iv, encryptedData } = await encryptData(symmetricKey, secp256k1PrivateKeyBytes);

      localStorage.setItem(`webauthn_cred_${webAuthnCredId}_encrypted_pk`, bytesToHex(new Uint8Array(encryptedData)));
      localStorage.setItem(`webauthn_cred_${webAuthnCredId}_iv`, bytesToHex(iv));
      localStorage.setItem(`webauthn_cred_${webAuthnCredId}_sym_key`, JSON.stringify(exportedSymKey));

      setLoggedInCredentialInfo({ id: webAuthnCredId, type: 'public-key' });
      setAccount(`WebAuthn Account Created (${webAuthnCredId.substring(0, 10)}...)`);
      setEthAddress(ethAccount.address);

    } catch (error) {
      console.error('Failed to create account/key:', error);
      const errorMsg = error instanceof Error ? error.message : "An unknown creation error occurred.";
      setLoginError(errorMsg); // Use loginError state for creation errors too
    } finally {
        setIsLoading(false);
    }
  }, []); // No dependencies needed if functions used inside are stable

  const loginAndAccessEthKey = useCallback(async () => {
    setLoginError(null);
    setLoggedInCredentialInfo(null);
    setEthAddress(null);
    setIsLoading(true);
    try {
      console.log("Attempting WebAuthn login...");
      const challenge = generateChallenge();
      const credentialAssertion = await navigator.credentials.get({
         publicKey: { challenge: challenge, allowCredentials: [], userVerification: 'preferred' }
      }) as PublicKeyCredential;
      console.log("WebAuthn Assertion received:", credentialAssertion);

      const webAuthnCredId = credentialAssertion.id;

      const storedSymKeyJWK = localStorage.getItem(`webauthn_cred_${webAuthnCredId}_sym_key`);
      const storedEncryptedPKHex = localStorage.getItem(`webauthn_cred_${webAuthnCredId}_encrypted_pk`);
      const storedIVHex = localStorage.getItem(`webauthn_cred_${webAuthnCredId}_iv`);

      let ethAccountAddress: `0x${string}`;
      let accountStatusMsg: string;

      if (storedSymKeyJWK && storedEncryptedPKHex && storedIVHex) {
        console.log("Existing encrypted key data found. Decrypting...");
        const symmetricKey = await window.crypto.subtle.importKey(
          "jwk", JSON.parse(storedSymKeyJWK), { name: "AES-GCM" }, true, ["decrypt"]
        );
        const decryptedPrivateKeyBytes = await decryptData(
          symmetricKey,
          hexToBytes(storedIVHex as `0x${string}`),
          hexToBytes(storedEncryptedPKHex as `0x${string}`).buffer as ArrayBuffer
        );
        const ethAccount = privateKeyToAccount(bytesToHex(decryptedPrivateKeyBytes));
        ethAccountAddress = ethAccount.address;
        accountStatusMsg = `Logged In & Accessed Existing Key (${webAuthnCredId.substring(0, 10)}...)`;
        console.log("Decrypted PK successfully. Address:", ethAccountAddress);

      } else {
        console.log("No encrypted key data found for this passkey. Generating and storing new key...");
        const newPrivateKeyBytes = hexToBytes(generatePrivateKey());
        const newEthAccount = privateKeyToAccount(bytesToHex(newPrivateKeyBytes));
        ethAccountAddress = newEthAccount.address;
        accountStatusMsg = `Logged In & Generated New Key (${webAuthnCredId.substring(0, 10)}...)`;
        console.log("Generated new Ethereum Address:", ethAccountAddress);

        const newSymmetricKey = await generateSymmetricKey();
        const newExportedSymKey = await window.crypto.subtle.exportKey("jwk", newSymmetricKey);

        const { iv: newIv, encryptedData: newEncryptedData } = await encryptData(newSymmetricKey, newPrivateKeyBytes);

        localStorage.setItem(`webauthn_cred_${webAuthnCredId}_encrypted_pk`, bytesToHex(new Uint8Array(newEncryptedData)));
        localStorage.setItem(`webauthn_cred_${webAuthnCredId}_iv`, bytesToHex(newIv));
        localStorage.setItem(`webauthn_cred_${webAuthnCredId}_sym_key`, JSON.stringify(newExportedSymKey));
        console.log("Stored encrypted data for new key.");
      }

      setLoggedInCredentialInfo({ id: webAuthnCredId, type: credentialAssertion.type });
      setAccount(accountStatusMsg);
      setEthAddress(ethAccountAddress);

    } catch (error) {
      console.error('Failed during login/key access/generation:', error);
      const errorMsg = error instanceof Error ? error.message : "An unknown login error occurred.";
      setLoginError(errorMsg);
    } finally {
        setIsLoading(false);
    }
  }, []); // No dependencies needed

  const logout = useCallback(() => {
    setAccount(null);
    setLoggedInCredentialInfo(null);
    setEthAddress(null);
    setLoginError(null);
    // Keep isLoading false, no async operation here
    console.log("User logged out.");
  }, []);

  // Return state and actions
  return {
    account,
    hasExistingCredential,
    loggedInCredentialInfo,
    ethAddress,
    loginError,
    isLoading, // Return loading state
    createAccountAndEthKey,
    loginAndAccessEthKey,
    logout,
  };
} 