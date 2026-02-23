"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useWalletContext } from "@/context/wallet-context"
import { cn } from "@/lib/utils"

export function Navigation() {
  const pathname = usePathname()
  const { isConnected } = useWalletContext()

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <span className="font-bold text-lg">LiquiDOT</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/" ? "text-foreground font-medium" : "text-foreground/60"
            )}
          >
            Home
          </Link>
          {isConnected && (
            <Link
              href="/dashboard"
              className={cn(
                "transition-colors hover:text-foreground/80",
                pathname === "/dashboard" ? "text-foreground font-medium" : "text-foreground/60"
              )}
            >
              Dashboard
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
