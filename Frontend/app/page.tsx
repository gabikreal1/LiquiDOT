"use client";

import dynamic from "next/dynamic";
import { LenisProvider } from "@/components/landing/lenis-provider";
import { HeroSection } from "@/components/landing/hero-section";
import { TrustBar } from "@/components/landing/trust-bar";
import { ProblemSection } from "@/components/landing/problem-section";
import { FeaturesBento } from "@/components/landing/features-bento";
import { ArchitectureSection } from "@/components/landing/architecture-section";
import { ChainsSection } from "@/components/landing/chains-section";
import { PoolsPreview } from "@/components/landing/pools-preview";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { CtaSection } from "@/components/landing/cta-section";
import { LandingFooter } from "@/components/landing/landing-footer";

// Heavy scroll-driven sections loaded dynamically
const ProductShowcase = dynamic(
  () =>
    import("@/components/landing/product-showcase").then(
      (m) => m.ProductShowcase
    ),
  { ssr: false }
);

const HowItWorks = dynamic(
  () =>
    import("@/components/landing/how-it-works").then((m) => m.HowItWorks),
  { ssr: false }
);

export default function LandingPage() {
  return (
    <LenisProvider>
      {/* 1. Hero */}
      <HeroSection />

      {/* 2. Trust Bar */}
      <TrustBar />

      {/* 3. Problem Statement */}
      <ProblemSection />

      {/* 4. Product Showcase (sticky scroll) */}
      <ProductShowcase />

      {/* 5. Features Bento */}
      <FeaturesBento />

      {/* 6. Architecture */}
      <ArchitectureSection />

      {/* 7. How It Works (scroll-driven steps) */}
      <HowItWorks />

      {/* 8. Supported Chains */}
      <ChainsSection />

      {/* 9. Live Pools */}
      <PoolsPreview />

      {/* 10. Testimonials */}
      <TestimonialsSection />

      {/* 11. CTA */}
      <CtaSection />

      {/* 12. Landing Footer (replaces global footer) */}
      <LandingFooter />
    </LenisProvider>
  );
}
