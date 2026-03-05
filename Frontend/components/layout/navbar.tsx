"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Settings, LogOut, LayoutDashboard } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/store/auth-store";
import { useUIStore } from "@/lib/store/ui-store";
import { loginWithEvm } from "@/lib/api/auth";
import { truncateHash } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { MobileMenu } from "./mobile-menu";

const NAV_LINKS = [
  { href: "/", label: "Home", requiresAuth: false },
  { href: "/pools", label: "Pools", requiresAuth: false },
  { href: "/dashboard", label: "Dashboard", requiresAuth: true },
];

export function Navbar() {
  const pathname = usePathname();
  const { setMobileMenuOpen } = useUIStore();
  const [hydrated, setHydrated] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  // Auth store
  const { isAuthenticated, walletAddress, login, logout } = useAuthStore();

  useEffect(() => {
    setHydrated(true);
  }, []);

  // SIWE sign-in flow after wallet connects
  const handleSiweLogin = useCallback(
    async (walletAddr: string) => {
      try {
        const message = `Sign in to LiquiDOT\nWallet: ${walletAddr}\nTimestamp: ${Date.now()}`;
        const signature = await signMessageAsync({ message });
        const result = await loginWithEvm(walletAddr, message, signature);
        login(result.access_token, result.user.id, result.user.walletAddress);
      } catch {
        // User rejected signing or API failed — disconnect wallet
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
  };

  const visibleLinks = NAV_LINKS.filter(
    (link) => !link.requiresAuth || (hydrated && isAuthenticated)
  );

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-black/6 bg-ld-light-1/85 backdrop-blur-[20px]">
        <div className="mx-auto flex h-full max-w-[1240px] items-center justify-between px-4 sm:px-10">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-[2px]">
            <span className="font-body text-xl font-light text-ld-ink">
              Liqui
            </span>
            <span className="font-display text-xl font-bold text-ld-ink">
              DOT
            </span>
            <span className="mb-2 ml-[1px] inline-block h-1.5 w-1.5 rounded-full bg-ld-polkadot-pink" />
          </Link>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-8 md:flex">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "font-body text-sm font-normal transition-colors",
                  pathname === link.href
                    ? "text-ld-ink"
                    : "text-ld-slate hover:text-ld-ink"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {!hydrated ? (
              <div className="hidden h-9 w-24 md:block" />
            ) : isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="hidden items-center gap-2 rounded-lg border border-ld-primary/20 bg-ld-primary/5 px-4 py-2 font-body text-xs font-medium text-ld-primary transition-colors hover:bg-ld-primary/10 md:flex">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-ld-accent to-ld-primary">
                      <span className="text-[8px] font-bold text-white">
                        {walletAddress
                          ? walletAddress.slice(2, 4).toUpperCase()
                          : "??"}
                      </span>
                    </div>
                    {truncateHash(walletAddress ?? "", 4)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link
                      href="/dashboard"
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/dashboard/settings"
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDisconnect}
                    className="cursor-pointer text-red-600 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={connecting}
                variant="outline"
                size="sm"
                className="hidden border-ld-primary text-ld-primary hover:bg-ld-primary/5 md:inline-flex"
              >
                {connecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/5 md:hidden"
            >
              <Menu className="h-5 w-5 text-ld-ink" />
            </button>
          </div>
        </div>
      </nav>
      <MobileMenu />
    </>
  );
}
