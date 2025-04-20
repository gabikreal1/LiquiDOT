"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog'
import { 
  useConnect, 
  useDisconnect
} from 'wagmi'
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors'
import { Loader2 } from 'lucide-react'
import { useWalletContext } from '@/context/wallet-context'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { WALLET_CONNECT_PROJECT_ID } from '@/lib/walletconnect-config'

interface WalletConnectProps {
  onConnect?: () => void
}

export function WalletConnect({ onConnect }: WalletConnectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { connect, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  
  const { 
    address, 
    isConnected, 
    formatDisplayAddress
  } = useWalletContext()

  // Only render wallet UI after client-side hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isConnected && onConnect) {
      onConnect()
      setIsOpen(false)
    }
  }, [isConnected, onConnect])

  const handleConnect = (connector: any) => {
    connect({ connector })
  }

  // Only render once the component is mounted on the client
  if (!mounted) {
    return (
      <div className="h-8 w-24 rounded bg-muted animate-pulse"></div>
    )
  }

  // Display either the wallet connect button or the user profile if connected
  const renderConnectButton = () => {
    if (isConnected) {
      return (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 border border-primary">
            <AvatarFallback className="text-xs">
              {address ? formatDisplayAddress(address).substring(0, 2) : '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {address ? formatDisplayAddress(address) : '-'}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="ml-1 h-6 w-6 rounded-full p-0" 
            onClick={() => disconnect()}
          >
            <span className="sr-only">Disconnect</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </Button>
        </div>
      )
    }

    return (
      <Button 
        variant="default" 
        size="sm" 
        onClick={() => setIsOpen(true)}
        className="text-xs"
      >
        Connect Wallet
      </Button>
    )
  }

  return (
    <>
      {renderConnectButton()}
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect your wallet</DialogTitle>
            <DialogDescription>
              Connect your wallet to sign transactions
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <Button 
              onClick={() => handleConnect(injected())} 
              disabled={isPending}
              className="w-full"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "MetaMask / Browser Wallet"
              )}
            </Button>
            
            <Button 
              onClick={() => handleConnect(coinbaseWallet())} 
              disabled={isPending}
              className="w-full"
            >
              Coinbase Wallet
            </Button>
            
            <Button 
              onClick={() => handleConnect(walletConnect({ projectId: WALLET_CONNECT_PROJECT_ID }))} 
              disabled={isPending}
              className="w-full"
            >
              WalletConnect
            </Button>
          </div>
          
          {error && (
            <p className="text-sm text-red-500">
              {error.message || "Failed to connect wallet"}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
} 