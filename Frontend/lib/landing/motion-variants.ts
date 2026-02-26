import type { Variants } from "motion/react";

// Hero staggered entrance
export const heroContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

export const heroItemVariants: Variants = {
  hidden: { opacity: 0, y: 30, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 100, damping: 15, duration: 0.8 },
  },
};

export const floatingCardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 120, damping: 20, delay: 0.6 },
  },
};

// Generic section fade-up
export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.19, 1, 0.22, 1] },
  },
};

// Staggered container
export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

// Bento card reveal
export const bentoCardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 24 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.19, 1, 0.22, 1] },
  },
};

// Trust bar logo fade
export const trustLogoVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 0.4,
    y: 0,
    transition: { duration: 0.4 },
  },
};

// Chain card reveals
export const chainCardVariants = (finalOpacity: number, delay: number): Variants => ({
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: finalOpacity,
    scale: 1,
    transition: { duration: 0.5, delay },
  },
});

// Table row stagger
export const tableRowVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4 },
  },
};

// CTA entrance
export const ctaVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.19, 1, 0.22, 1] },
  },
};
