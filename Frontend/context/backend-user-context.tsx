"use client"

import { createContext, useContext, ReactNode } from 'react'

interface BackendUserContextType {
  // Add your backend user context values here
}

const BackendUserContext = createContext<BackendUserContextType>({})

export const useBackendUserContext = () => useContext(BackendUserContext)

interface BackendUserProviderProps {
  children: ReactNode
}

export function BackendUserProvider({ children }: BackendUserProviderProps) {
  return (
    <BackendUserContext.Provider value={{}}>
      {children}
    </BackendUserContext.Provider>
  )
} 