"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useWebAuthnEth } from '@/hooks/useWebAuthnEth';
import { createPublicClient, http } from 'viem';
import { holesky } from 'viem/chains';
import { Cuer } from 'cuer'

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

  useEffect(() => {
    async function fetchBalance() {
      if (!ethAddress) return;
      
      const client = createPublicClient({
        chain: holesky,
        transport: http()
      });
      
      try {
        const balanceWei = await client.getBalance({
          address: ethAddress as `0x${string}`
        });
        
        // Convert wei to ETH
        const balanceEth = Number(balanceWei) / 10**18;
        setBalance(balanceEth.toFixed(4));
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    }
    
    fetchBalance();
  }, [ethAddress]);

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
          </div>
        )}
        {hasExistingCredential === false && (
          <p className="text-sm text-gray-500 mt-2 w-full max-w-md text-center">No platform authenticator detected. You may need to use a different device/browser or security key.</p>
        )}
        {/* Display Login Error */}
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
