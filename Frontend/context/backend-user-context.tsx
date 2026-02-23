"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useWalletContext } from './wallet-context'
import { registerUser, type UserData } from '@/lib/api'

interface BackendUserContextType {
  userId: string | undefined
  backendUser: UserData | undefined
  isLoading: boolean
}

const BackendUserContext = createContext<BackendUserContextType>({
  userId: undefined,
  backendUser: undefined,
  isLoading: false,
})

export const useBackendUserContext = () => useContext(BackendUserContext)

interface BackendUserProviderProps {
  children: ReactNode
}

export function BackendUserProvider({ children }: BackendUserProviderProps) {
  const { address, isConnected } = useWalletContext()
  const [backendUser, setBackendUser] = useState<UserData | undefined>()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isConnected || !address) {
      setBackendUser(undefined)
      return
    }

    let cancelled = false
    setIsLoading(true)

    registerUser(address)
      .then((user) => {
        if (!cancelled) setBackendUser(user)
      })
      .catch((err) => {
        console.error('Failed to register user:', err)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [address, isConnected])

  return (
    <BackendUserContext.Provider value={{
      userId: backendUser?.id,
      backendUser,
      isLoading,
    }}>
      {children}
    </BackendUserContext.Provider>
  )
}
