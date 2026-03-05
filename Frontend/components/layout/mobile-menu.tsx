"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth-store";
import { useUIStore } from "@/lib/store/ui-store";
import { loginWithEvm } from "@/lib/api/auth";
import { truncateHash } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home", requiresAuth: false },
  { href: "/pools", label: "Pools", requiresAuth: false },
  { href: "/dashboard", label: "Dashboard", requiresAuth: true },
  { href: "/dashboard/settings", label: "Settings", requiresAuth: true },
];

export function MobileMenu() {
  const pathname = usePathname();
  const { isAuthenticated, walletAddress, login, logout } = useAuthStore();
  const { mobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const [connecting, setConnecting] = useState(false);

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  // SIWE sign-in flow after wallet connects
  const handleSiweLogin = useCallback(
    async (walletAddr: string) => {
      try {
        const message = `Sign in to LiquiDOT\nWallet: ${walletAddr}\nTimestamp: ${Date.now()}`;
        const signature = await signMessageAsync({ message });
        const result = await loginWithEvm(walletAddr, message, signature);
        login(result.access_token, result.user.id, result.user.walletAddress);
      } catch {
        disconnect();
      } finally {
        setConnecting(false);
      }
    },
    [signMessageAsync, login, disconnect]
  );

  // When wallet connects, trigger SIWE flow
  useEffect(() => {
    if (isConnected && address && connecting && !isAuthenticated) {
      handleSiweLogin(address);
    }
  }, [isConnected, address, connecting, isAuthenticated, handleSiweLogin]);

  const handleConnect = () => {
    const connector = connectors[0];
    if (!connector) return;
    setConnecting(true);
    connect({ connector });
  };

  const handleDisconnect = () => {
    disconnect();
    logout();
    setMobileMenuOpen(false);
  };

  const visibleLinks = NAV_LINKS.filter(
    (link) => !link.requiresAuth || isAuthenticated
  );

  return (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetContent side="right" className="w-full max-w-[90vw] bg-ld-light-1 p-6 sm:w-72">
        <nav className="mt-8 flex flex-col gap-4">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "rounded-lg px-4 py-3 font-body text-base transition-colors",
                pathname === link.href
                  ? "bg-ld-primary/5 font-medium text-ld-ink"
                  : "text-ld-slate hover:bg-black/3 hover:text-ld-ink"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 border-t border-ld-frost pt-6">
          {isAuthenticated ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg bg-ld-primary/5 px-4 py-2 font-mono text-xs text-ld-primary">
                {truncateHash(walletAddress ?? "", 6)}
              </div>
              <Button
                onClick={handleDisconnect}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => {
                handleConnect();
                setMobileMenuOpen(false);
              }}
              disabled={connecting}
              variant="outline"
              className="w-full border-ld-primary text-ld-primary"
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
