import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-ld-frost bg-ld-light-1 py-8">
      <div className="mx-auto flex max-w-[1240px] flex-col items-center gap-4 px-4 text-center sm:flex-row sm:justify-between sm:px-10 sm:text-left">
        {/* Brand */}
        <div className="flex items-center gap-1">
          <span className="font-body text-sm font-light text-ld-ink">
            Liqui
          </span>
          <span className="font-display text-sm font-bold text-ld-ink">
            DOT
          </span>
          <span className="ml-1 text-xs text-ld-slate">&copy; 2026</span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-4 text-xs text-ld-slate sm:gap-6">
          <Link href="#" className="transition-colors hover:text-ld-ink">
            Docs
          </Link>
          <Link href="#" className="transition-colors hover:text-ld-ink">
            GitHub
          </Link>
          <Link href="#" className="transition-colors hover:text-ld-ink">
            Twitter
          </Link>
          <Link href="#" className="transition-colors hover:text-ld-ink">
            Discord
          </Link>
        </div>

        {/* Polkadot branding */}
        <span className="text-xs text-ld-slate">
          Built on{" "}
          <span className="font-medium text-ld-polkadot-pink">Polkadot</span>
        </span>
      </div>
    </footer>
  );
}
