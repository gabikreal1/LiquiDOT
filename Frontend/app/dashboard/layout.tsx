"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth-store";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <div className="text-center">
          <h2 className="text-h3 mb-4 text-ld-ink">Connect Your Wallet</h2>
          <p className="mb-6 text-body text-ld-slate">
            You need to connect your wallet to access the dashboard.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/">
              <Button className="bg-ld-primary text-white hover:bg-ld-primary/90">
                Connect Wallet
              </Button>
            </Link>
            <Link
              href="/"
              className="text-sm text-ld-slate hover:text-ld-ink"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
