"use client";

import { useEffect, useState } from "react";
import { publicClients } from "@common/web3";
import { useAuth } from "@/contexts/AuthContext";
import { formatEther } from "viem";
import { useIsMobile } from "@/hooks/use-mobile";

type ChainBalance = {
  chainId: number;
  chainName: string;
  balance: bigint;
  formattedBalance: string;
};

export function PortfolioBalances() {
  const { ethAddress } = useAuth();
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    async function fetchBalances() {
      if (!ethAddress) return;
      
      setIsLoading(true);
      const clients = publicClients();
      
      try {
        const results = await Promise.all(
          Object.entries(clients).map(async ([chainId, client]) => {
            try {
              const balance = await client.getBalance({
                address: ethAddress as `0x${string}`,
              });
              
              const chainName = client.chain?.name || `Chain ${chainId}`;
              
              return {
                chainId: Number(chainId),
                chainName,
                balance,
                formattedBalance: formatEther(balance),
              };
            } catch (error) {
              console.error(`Error fetching balance for chain ${chainId}:`, error);
              return null;
            }
          })
        );
        
        // Filter out failed requests and sort by balance (highest first)
        const validBalances = results
          .filter((result): result is ChainBalance => result !== null)
          .filter(balance => balance.balance > 0n)
          .sort((a, b) => (b.balance > a.balance ? 1 : -1));
        
        setBalances(validBalances);
      } catch (error) {
        console.error("Error fetching balances:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchBalances();
  }, [ethAddress]);

  if (isLoading) {
    return <div className="p-4 text-center">Loading balances...</div>;
  }

  if (balances.length === 0) {
    return <div className="p-4 text-center">No balances found across any chains.</div>;
  }

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4">Your Balances</h2>
      <div className="space-y-2">
        {balances.map((balance) => (
          <div 
            key={balance.chainId} 
            className="flex justify-between items-center p-3 bg-secondary/20 rounded-lg"
          >
            <div className="flex flex-col">
              <span className="font-medium">{balance.chainName}</span>
              {!isMobile && (
                <span className="text-xs text-muted-foreground">Chain ID: {balance.chainId}</span>
              )}
            </div>
            <div className="text-right">
              <span className="font-mono">{parseFloat(balance.formattedBalance).toFixed(6)} ETH</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}