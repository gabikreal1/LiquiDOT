"use client"

import { ReactNode, useEffect } from 'react'
import { WagmiProvider as Provider } from 'wagmi'
import { QueryClientProvider } from '@tanstack/react-query'
import { config, queryClient } from '@/lib/wagmi'
import { WalletProvider } from '@/context/wallet-context'
import { BackendUserProvider } from '@/context/backend-user-context'
import { setupZoraEventListeners } from '@/lib/wallet-utils'

interface WagmiProviderProps {
  children: ReactNode
}

export function WagmiProvider({ children }: WagmiProviderProps) {
  useEffect(() => {
    setupZoraEventListeners();
  }, []);

  return (
    <Provider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <BackendUserProvider>
            {children}
          </BackendUserProvider>
        </WalletProvider>
      </QueryClientProvider>
    </Provider>
  )
} 