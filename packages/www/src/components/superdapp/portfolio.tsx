
"use client";

import { useAuth } from "@/contexts/AuthContext";
import { PortfolioBalances } from "@/components/superdapp/portfolio/portfolio-balances";

export default function Portfolio() {
  const { ethAddress } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Portfolio</h1>
      
      {ethAddress ? (
        <div className="space-y-6">
          <div className="p-4 bg-secondary/10 rounded-lg">
            <p className="text-sm font-mono break-all">Address: {ethAddress}</p>
          </div>
          
          <PortfolioBalances />
        </div>
      ) : (
        <div className="p-4 text-center">
          Loading wallet address...
        </div>
      )}
    </div>
  );
}