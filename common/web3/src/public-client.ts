import { createPublicClient, type PublicClient } from "viem";
import { http } from "viem"
import * as chains from "viem/chains"

export const publicClients = () => {
    const clients: Record<number, PublicClient> = {}

    for (const chain of Object.values(chains)) {
        clients[chain.id] = createPublicClient({
            batch: {
                multicall: true, 
            },
            chain,
            transport: http()
        }) as PublicClient
    }

    return clients
}