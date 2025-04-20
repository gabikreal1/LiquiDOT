"use client"

import { createContext, useContext, ReactNode } from 'react'
import { useAccount, useBalance } from 'wagmi'

interface WalletContextType {
  address: `0x${string}` | undefined
  isConnected: boolean
  balance: bigint | undefined
  formatDisplayAddress: (address: `0x${string}`) => string
}

const WalletContext = createContext<WalletContextType>({
  address: undefined,
  isConnected: false,
  balance: undefined,
  formatDisplayAddress: () => '',
})

export const useWalletContext = () => useContext(WalletContext)

interface WalletProviderProps {
  children: ReactNode
}

export function WalletProvider({ children }: WalletProviderProps) {
  const { address, isConnected } = useAccount()
  const { data: balanceData } = useBalance({ address })

  // Format an Ethereum address for display (0x1234...5678)
  const formatDisplayAddress = (addr: `0x${string}`) => {
    if (!addr) return ''
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`
  }

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected,
        balance: balanceData?.value,
        formatDisplayAddress,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
} 