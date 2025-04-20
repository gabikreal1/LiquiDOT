import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { QueryClient } from '@tanstack/react-query'

// Create a query client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
    },
  },
})

// Create a simple storage object for persistence between refreshes
const createLocalStorage = () => {
  if (typeof window !== 'undefined') {
    return {
      getItem: (key: string) => {
        const value = window.localStorage.getItem(key)
        return value === null ? undefined : value
      },
      setItem: (key: string, value: string) => {
        window.localStorage.setItem(key, value)
      },
      removeItem: (key: string) => {
        window.localStorage.removeItem(key)
      },
    }
  }
  // Return no-op for SSR
  return {
    getItem: () => undefined,
    setItem: () => undefined,
    removeItem: () => undefined,
  }
}

// Create wagmi config
export const config = createConfig({
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
}) 