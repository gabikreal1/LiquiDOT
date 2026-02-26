import type { Metadata } from "next";
import { Space_Grotesk, Outfit, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { LayoutShell } from "@/components/layout/layout-shell";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "LiquiDOT — Automated LP Management for Polkadot",
    template: "%s | LiquiDOT",
  },
  description:
    "Deposit DOT. Set your strategy. LiquiDOT optimizes your LP positions across Polkadot parachains with stop-loss, take-profit, and automated rebalancing.",
  metadataBase: new URL("https://liquidot.app"),
  openGraph: {
    title: "LiquiDOT — Automated LP Management for Polkadot",
    description:
      "Deposit DOT. Set your strategy. LiquiDOT optimizes your LP positions across Polkadot parachains.",
    siteName: "LiquiDOT",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "LiquiDOT — Automated LP Management for Polkadot",
    description:
      "Deposit DOT. Set your strategy. LiquiDOT optimizes your LP positions across Polkadot parachains.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${outfit.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Providers>
          <LayoutShell>{children}</LayoutShell>
        </Providers>
      </body>
    </html>
  );
}
