"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { PageTransition } from "./page-transition";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <>
      <Navbar />
      {isLanding ? (
        // Landing page: full-bleed, no top padding, own footer
        <main className="min-h-screen">{children}</main>
      ) : (
        // App pages: top padding for fixed nav, page transition, global footer
        <>
          <main className="min-h-screen pt-16">
            <PageTransition key={pathname}>{children}</PageTransition>
          </main>
          <Footer />
        </>
      )}
    </>
  );
}
