"use client";

import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/4 bg-ld-dark pb-8 pt-16">
      <div className="mx-auto max-w-[1240px] px-10">
        <div className="mb-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <div className="mb-3 flex items-center gap-[2px]">
              <span className="font-body text-xl font-light text-ld-frost">
                Liqui
              </span>
              <span className="font-display text-xl font-bold text-ld-frost">
                DOT
              </span>
              <span className="mb-2 ml-[1px] inline-block h-1.5 w-1.5 rounded-full bg-ld-polkadot-pink" />
            </div>
            <p className="mb-5 max-w-[240px] text-sm leading-[1.6] text-ld-slate">
              Automated LP management for the Polkadot ecosystem. Set your
              strategy, let automation handle the rest.
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/6 transition-all duration-200 hover:-translate-y-0.5 hover:opacity-100"
                style={{ opacity: 0.5 }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-ld-slate">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                </svg>
              </a>
              <a
                href="#"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/6 transition-all duration-200 hover:-translate-y-0.5 hover:opacity-100"
                style={{ opacity: 0.5 }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-ld-slate">
                  <path d="M4 4l11.733 16h4.267l-11.733-16zM4 20l6.768-6.768M15.232 10.232L20 4" />
                </svg>
              </a>
              <a
                href="#"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/6 transition-all duration-200 hover:-translate-y-0.5 hover:opacity-100"
                style={{ opacity: 0.5 }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-ld-slate">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515M8.567 2.855A19.791 19.791 0 0 0 3.682 4.37M3.682 4.37A19.791 19.791 0 0 0 2 12.225c0 3.027.67 5.893 1.872 8.465M20.317 4.37A19.791 19.791 0 0 1 22 12.225c0 3.027-.67 5.893-1.872 8.465" />
                </svg>
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="mb-4 font-display text-sm font-semibold text-ld-frost">
              Product
            </h4>
            <div className="flex flex-col gap-2.5">
              <Link href="/dashboard" className="text-[13px] text-ld-slate transition-colors duration-150 hover:text-ld-frost">Dashboard</Link>
              <Link href="/pools" className="text-[13px] text-ld-slate transition-colors duration-150 hover:text-ld-frost">Pool Explorer</Link>
              <Link href="/dashboard/strategy" className="text-[13px] text-ld-slate transition-colors duration-150 hover:text-ld-frost">Strategy Config</Link>
              <Link href="/activity" className="text-[13px] text-ld-slate transition-colors duration-150 hover:text-ld-frost">Activity</Link>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 className="mb-4 font-display text-sm font-semibold text-ld-frost">
              Resources
            </h4>
            <div className="flex flex-col gap-2.5">
              <Link href="#" className="text-[13px] text-ld-slate transition-colors duration-150 hover:text-ld-frost">Documentation</Link>
              <Link href="#" className="text-[13px] text-ld-slate transition-colors duration-150 hover:text-ld-frost">WhitePaper</Link>
              <Link href="#" className="text-[13px] text-ld-slate transition-colors duration-150 hover:text-ld-frost">GitHub</Link>
              <Link href="#" className="text-[13px] text-ld-slate transition-colors duration-150 hover:text-ld-frost">Demo Video</Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-4 font-display text-sm font-semibold text-ld-frost">
              Legal
            </h4>
            <div className="flex flex-col gap-2.5">
              <Link href="#" className="text-[13px] text-ld-slate transition-colors duration-150 hover:text-ld-frost">Terms of Service</Link>
              <Link href="#" className="text-[13px] text-ld-slate transition-colors duration-150 hover:text-ld-frost">Privacy Policy</Link>
              <Link href="#" className="text-[13px] text-ld-slate transition-colors duration-150 hover:text-ld-frost">Contract Addresses</Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-ld-polkadot-pink/8 pt-6 text-xs text-ld-slate/60 sm:flex-row">
          <span>&copy; 2026 LiquiDOT. All rights reserved.</span>
          <span>
            Built on{" "}
            <span className="text-ld-polkadot-pink">Polkadot</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
