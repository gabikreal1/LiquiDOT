import { ArrowDown } from "lucide-react"
import Hero from "@/components/hero"
import Features from "@/components/features"
import LiquidityManager from "@/components/liquidity-manager"
import TokenManagement from "@/components/contract"

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <Hero />

      {/* Scroll indicator */}
      <div className="flex justify-center my-8 animate-bounce">
        <ArrowDown className="h-8 w-8 text-primary" />
      </div>

      {/* Features Section */}
      <Features />

      {/* Liquidity Pool Manager */}
      <section id="manager" className="py-16 px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Manage Your Liquidity</h2>
        <LiquidityManager />
      </section>

      {/* Token Management */}
      <section id="token-management" className="py-16 px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Token Management</h2>
        <TokenManagement />
      </section>
    </main>
  )
}
