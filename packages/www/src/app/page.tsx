"use client";

import { WebAuthnP256 } from 'ox'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { bytesToHex, hexToBytes } from 'viem'

// Helper to generate a dummy challenge (INSECURE - FOR DEMO ONLY)
function generateChallenge(): ArrayBuffer {
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  return challenge.buffer;
}

// --- Encryption Helpers (using Web Crypto API) ---

async function generateSymmetricKey(): Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

async function encryptData(key: CryptoKey, data: Uint8Array): Promise<{ iv: Uint8Array, encryptedData: ArrayBuffer }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Standard IV size for AES-GCM
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

// --- Component ---

export default function Home() {
  const [account, setAccount] = useState<string | null>(null)
  const [hasExistingCredential, setHasExistingCredential] = useState<boolean | null>(null);
  const [loggedInCredentialInfo, setLoggedInCredentialInfo] = useState<any>(null); // State for login info
  const [ethAddress, setEthAddress] = useState<string | null>(null); // State for eth address
  const [loginError, setLoginError] = useState<string | null>(null); // State for login errors

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

  const createAccountAndEthKey = async () => {
    try {
      console.log("Attempting to create WebAuthn credential...");
      // 1. Create WebAuthn Credential
      const webAuthn = await WebAuthnP256.createCredential({ name: 'Joe' });
      console.log("WebAuthn Credential created:", webAuthn);
      const webAuthnCredId = webAuthn.id; // Get the credential ID

      // 2. Generate secp256k1 key pair (using viem)
      const secp256k1PrivateKeyBytes = hexToBytes(generatePrivateKey());
      const ethAccount = privateKeyToAccount(bytesToHex(secp256k1PrivateKeyBytes));
      console.log("Generated Ethereum Address:", ethAccount.address);

      // 3. Generate Symmetric Key
      const symmetricKey = await generateSymmetricKey();
      const exportedSymKey = await window.crypto.subtle.exportKey("jwk", symmetricKey); // Export for storage

      // 4. Encrypt secp256k1 Private Key
      const { iv, encryptedData } = await encryptData(symmetricKey, secp256k1PrivateKeyBytes);

      // 5. Store (INSECURELY for demo - needs server/better method)
      localStorage.setItem(`webauthn_cred_${webAuthnCredId}_encrypted_pk`, bytesToHex(new Uint8Array(encryptedData)));
      localStorage.setItem(`webauthn_cred_${webAuthnCredId}_iv`, bytesToHex(iv));
      // !!! Storing the raw symmetric key is insecure !!!
      localStorage.setItem(`webauthn_cred_${webAuthnCredId}_sym_key`, JSON.stringify(exportedSymKey));

      setLoggedInCredentialInfo({ id: webAuthnCredId, type: 'public-key' });
      setAccount(`WebAuthn Account Created (${webAuthnCredId.substring(0, 10)}...)`);
      setEthAddress(ethAccount.address); // Show the generated address

    } catch (error) {
      console.error('Failed to create account/key:', error);
    }
  }

  const loginAndAccessEthKey = async () => {
    setLoginError(null); // Clear previous errors
    setLoggedInCredentialInfo(null);
    setEthAddress(null);
    try {
      console.log("Attempting WebAuthn login...");
      const challenge = generateChallenge();
      const credentialAssertion = await navigator.credentials.get({
         publicKey: { challenge: challenge, allowCredentials: [], userVerification: 'preferred' }
      }) as PublicKeyCredential;
      console.log("WebAuthn Assertion received:", credentialAssertion);

      const webAuthnCredId = credentialAssertion.id;

      // Try to retrieve existing key data
      const storedSymKeyJWK = localStorage.getItem(`webauthn_cred_${webAuthnCredId}_sym_key`);
      const storedEncryptedPKHex = localStorage.getItem(`webauthn_cred_${webAuthnCredId}_encrypted_pk`);
      const storedIVHex = localStorage.getItem(`webauthn_cred_${webAuthnCredId}_iv`);

      let ethAccountAddress: `0x${string}`;
      let accountStatusMsg: string;

      // Check if data exists
      if (storedSymKeyJWK && storedEncryptedPKHex && storedIVHex) {
        // Data exists - Decrypt existing key
        console.log("Existing encrypted key data found. Decrypting...");

        const symmetricKey = await window.crypto.subtle.importKey(
          "jwk",
          JSON.parse(storedSymKeyJWK),
          { name: "AES-GCM" },
          true,
          ["decrypt"]
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
        // Data NOT found - Generate and store a new key pair
        console.log("No encrypted key data found for this passkey. Generating and storing new key...");

        // Generate new secp256k1 key pair
        const newPrivateKeyBytes = hexToBytes(generatePrivateKey());
        const newEthAccount = privateKeyToAccount(bytesToHex(newPrivateKeyBytes));
        ethAccountAddress = newEthAccount.address;
        accountStatusMsg = `Logged In & Generated New Key (${webAuthnCredId.substring(0, 10)}...)`;
        console.log("Generated new Ethereum Address:", ethAccountAddress);

        // Generate new Symmetric Key
        const newSymmetricKey = await generateSymmetricKey();
        const newExportedSymKey = await window.crypto.subtle.exportKey("jwk", newSymmetricKey);

        // Encrypt new secp256k1 Private Key
        const { iv: newIv, encryptedData: newEncryptedData } = await encryptData(newSymmetricKey, newPrivateKeyBytes);

        // Store new data (INSECURELY for demo)
        localStorage.setItem(`webauthn_cred_${webAuthnCredId}_encrypted_pk`, bytesToHex(new Uint8Array(newEncryptedData)));
        localStorage.setItem(`webauthn_cred_${webAuthnCredId}_iv`, bytesToHex(newIv));
        localStorage.setItem(`webauthn_cred_${webAuthnCredId}_sym_key`, JSON.stringify(newExportedSymKey)); // Still insecure storage
        console.log("Stored encrypted data for new key.");
      }

      // Update state common to both paths (found or generated)
      setLoggedInCredentialInfo({ id: webAuthnCredId, type: credentialAssertion.type });
      setAccount(accountStatusMsg);
      setEthAddress(ethAccountAddress);

    } catch (error) {
      console.error('Failed during login/key access/generation:', error);
      const errorMsg = error instanceof Error ? error.message : "An unknown login error occurred.";
      setLoginError(errorMsg);
      setLoggedInCredentialInfo(null);
      setEthAddress(null);
    }
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col items-center gap-4">
        <h1>WebAuthn + Eth Key Demo</h1>
        {hasExistingCredential === null && <p>Checking passkey support...</p>}
        {hasExistingCredential === true && !loggedInCredentialInfo && (
          <Button onClick={loginAndAccessEthKey}>
            Login & Access Eth Key
          </Button>
        )}
        {hasExistingCredential === false && !account && (
          <Button onClick={createAccountAndEthKey}>
            Create WebAuthn Acc & Eth Key
          </Button>
        )}
        {account && (
          <div className="mt-2 p-2 border rounded bg-green-100 text-green-800 text-sm">
            <p className="font-bold">{account}</p>
          </div>
        )}
        {loggedInCredentialInfo && (
          <div className="mt-2 p-2 border rounded bg-blue-100 text-blue-800 text-sm break-all">
            <p className="font-bold">WebAuthn Credential:</p>
            <p>ID: {loggedInCredentialInfo.id}</p>
            <p>Type: {loggedInCredentialInfo.type}</p>
          </div>
        )}
        {ethAddress && (
          <div className="mt-2 p-2 border rounded bg-purple-100 text-purple-800 text-sm break-all">
            <p className="font-bold">Associated Ethereum Address:</p>
            <p>{ethAddress}</p>
          </div>
        )}
        {hasExistingCredential === false && (
          <p className="text-sm text-gray-500 mt-2">No platform authenticator detected. You may need to use a different device/browser or security key.</p>
        )}
        {/* Display Login Error */}
        {loginError && (
          <div className="mt-2 p-2 border rounded bg-red-100 text-red-800 text-sm">
            <p className="font-bold">Login Error:</p>
            <p>{loginError}</p>
          </div>
        )}
      </main>       
    </div>
  );
}
