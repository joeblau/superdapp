"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useWebAuthnEth } from '@/hooks/useWebAuthnEth';
import { createPublicClient, http, isAddress, createWalletClient, parseEther, hexToBytes, bytesToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { holesky } from 'viem/chains';
import { Cuer } from 'cuer'
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Helper function to decrypt data (mirrors the one in the hook)
async function decryptData(key: CryptoKey, iv: Uint8Array, encryptedData: ArrayBuffer): Promise<Uint8Array> {
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encryptedData
  );
  return new Uint8Array(decrypted);
}

export default function Home() {
  const {
    account,
    hasExistingCredential,
    loggedInCredentialInfo,
    ethAddress,
    loginError,
    createAccountAndEthKey,
    loginAndAccessEthKey
  } = useWebAuthnEth();

  const [balance, setBalance] = useState<string | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [isValidAddress, setIsValidAddress] = useState<boolean | null>(null);
  const [sendAmount, setSendAmount] = useState<string>('0.001');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!ethAddress) return;
    setBalance(null);

    const client = createPublicClient({
      chain: holesky,
      transport: http()
    });

    try {
      const balanceWei = await client.getBalance({
        address: ethAddress as `0x${string}`
      });

      const balanceEth = Number(balanceWei) / 10**18;
      setBalance(balanceEth.toFixed(6));
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  }, [ethAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    if (destinationAddress === '') {
      setIsValidAddress(null);
    } else {
      setIsValidAddress(isAddress(destinationAddress));
    }
  }, [destinationAddress]);

  const handleSend = async () => {
    if (!isValidAddress || !ethAddress || !loggedInCredentialInfo?.id || isSending) return;

    setIsSending(true);
    setTxHash(null);
    setSendError(null);

    try {
      const webAuthnCredId = loggedInCredentialInfo.id;
      const storedSymKeyJWK = localStorage.getItem(`webauthn_cred_${webAuthnCredId}_sym_key`);
      const storedEncryptedPKHex = localStorage.getItem(`webauthn_cred_${webAuthnCredId}_encrypted_pk`);
      const storedIVHex = localStorage.getItem(`webauthn_cred_${webAuthnCredId}_iv`);

      if (!storedSymKeyJWK || !storedEncryptedPKHex || !storedIVHex) {
        throw new Error("Could not find necessary key information in local storage.");
      }

      const symmetricKey = await window.crypto.subtle.importKey(
        "jwk", JSON.parse(storedSymKeyJWK), { name: "AES-GCM" }, true, ["decrypt"]
      );

      const decryptedPrivateKeyBytes = await decryptData(
        symmetricKey,
        hexToBytes(storedIVHex as `0x${string}`),
        hexToBytes(storedEncryptedPKHex as `0x${string}`).buffer as ArrayBuffer
      );
      const privateKeyHex = bytesToHex(decryptedPrivateKeyBytes);

      const account = privateKeyToAccount(privateKeyHex);

      const walletClient = createWalletClient({
        account,
        chain: holesky,
        transport: http()
      });

      const amountToSendWei = parseEther(sendAmount);
      console.log(`Sending ${sendAmount} ETH (${amountToSendWei} wei) from ${account.address} to ${destinationAddress}`);

      const hash = await walletClient.sendTransaction({
        to: destinationAddress as `0x${string}`,
        value: amountToSendWei,
      });

      console.log("Transaction sent! Hash:", hash);
      setTxHash(hash);

      const publicClient = createPublicClient({ chain: holesky, transport: http() });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log("Transaction confirmed!");
      fetchBalance();

    } catch (error) {
      console.error("Error sending transaction:", error);
      const errorMsg = error instanceof Error ? error.message : "An unknown error occurred during sending.";
      if (errorMsg.includes("insufficient funds")) {
        setSendError("Insufficient funds for transaction.");
      } else if (errorMsg.includes("User denied transaction signature")) {
        setSendError("Transaction rejected by user.");
      } else {
        setSendError(`Failed to send: ${errorMsg}`);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen p-4 md:p-8">
      <main className="w-full max-w-4xl flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold mb-6">WebAuthn + Eth Key Demo</h1>
        {hasExistingCredential === null && <p>Checking passkey support...</p>}
        {hasExistingCredential === true && !loggedInCredentialInfo && (
          <Button onClick={loginAndAccessEthKey} className="w-full max-w-md">
            Login & Access Eth Key
          </Button>
        )}
        {hasExistingCredential === false && !account && (
          <Button onClick={createAccountAndEthKey} className="w-full max-w-md">
            Create WebAuthn Acc & Eth Key
          </Button>
        )}
        {account && (
          <div className="mt-2 p-4 border rounded bg-green-100 text-green-800 text-sm w-full max-w-md">
            <p className="font-bold">{account}</p>
          </div>
        )}
        {loggedInCredentialInfo && (
          <div className="mt-2 p-4 border rounded bg-blue-100 text-blue-800 text-sm break-all w-full max-w-md">
            <p className="font-bold">WebAuthn Credential:</p>
            <p>ID: {loggedInCredentialInfo.id}</p>
            <p>Type: {loggedInCredentialInfo.type}</p>
          </div>
        )}
        {ethAddress && (
          <div className="mt-2 p-4 border rounded bg-purple-100 text-purple-800 text-sm break-all w-full max-w-md">
            <p className="font-bold">Associated Ethereum Address:</p>
            <p>{ethAddress}</p>
            {balance !== null && (
              <p className="mt-1 font-semibold">Balance: {balance} ETH</p>
            )}
            {balance === null && ethAddress && (
              <p className="mt-1 text-xs">Loading balance...</p>
            )}
            <div className="mt-4 flex justify-center">
              <Cuer arena="/doghat.png" value={ethAddress} />
            </div>
            <div className="mt-6 border-t pt-4 space-y-3">
              <h3 className="text-lg font-semibold mb-2">Send ETH</h3>
              <div>
                <Label htmlFor="destinationAddress" className="block text-sm font-medium mb-1">To Address</Label>
                <Input
                  id="destinationAddress"
                  type="text"
                  placeholder="0x..."
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  className={`w-full ${isValidAddress === false ? 'border-red-500' : ''} ${isValidAddress === true ? 'border-green-500' : ''}`}
                  disabled={isSending}
                />
                {isValidAddress === false && destinationAddress !== '' && (
                  <p className="text-xs text-red-600 mt-1">Invalid Ethereum address</p>
                )}
              </div>
              <div>
                <Label htmlFor="sendAmount" className="block text-sm font-medium mb-1">Amount (ETH)</Label>
                <Input
                  id="sendAmount"
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0.001"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  className="w-full"
                  disabled={isSending}
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={!isValidAddress || !destinationAddress || isSending || !sendAmount || parseFloat(sendAmount) <= 0}
                className="w-full mt-2"
              >
                {isSending ? 'Sending...' : 'Send ETH'}
              </Button>
              {txHash && (
                <div className="mt-2 p-2 border rounded bg-green-100 text-green-800 text-xs break-all">
                  <p className="font-bold">Transaction Sent:</p>
                  <a href={`https://holesky.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-900">
                    {txHash}
                  </a>
                </div>
              )}
              {sendError && (
                <div className="mt-2 p-2 border rounded bg-red-100 text-red-800 text-xs">
                  <p className="font-bold">Send Error:</p>
                  <p>{sendError}</p>
                </div>
              )}
            </div>
          </div>
        )}
        {hasExistingCredential === false && (
          <p className="text-sm text-gray-500 mt-2 w-full max-w-md text-center">No platform authenticator detected. You may need to use a different device/browser or security key.</p>
        )}
        {loginError && (
          <div className="mt-2 p-4 border rounded bg-red-100 text-red-800 text-sm w-full max-w-md">
            <p className="font-bold">Login Error:</p>
            <p>{loginError}</p>
          </div>
        )}
      </main>       
    </div>
  );
}
