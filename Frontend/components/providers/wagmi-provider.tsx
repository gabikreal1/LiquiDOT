"use client"

import { ReactNode, useEffect, useState } from 'react'
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setupZoraEventListeners();
  }, []);

  // To avoid hydration mismatch, only render the children once the component has mounted
  return (
    <Provider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <BackendUserProvider>
            {mounted ? children : null}
          </BackendUserProvider>
        </WalletProvider>
      </QueryClientProvider>
    </Provider>
  )
} 