/**
 * Token Math — pure, stateless utility functions for on-chain amount conversions.
 *
 * All functions are synchronous and have zero external dependencies.
 * They throw on invalid input (fail-fast) rather than returning NaN or 0.
 *
 * Terminology:
 *   smallestUnit  — on-chain integer (planck for DOT, wei for GLMR, etc.)
 *   decimal       — human-readable number (1.5 DOT, 100 USDC)
 *   USD           — fiat dollar value
 */

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

export const DOT_DECIMALS = 10;
export const GLMR_DECIMALS = 18;
export const USDC_DECIMALS = 6;
export const WBTC_DECIMALS = 8;

/**
 * Known token decimals by symbol (Polkadot / Moonbeam ecosystem).
 * On-chain lookups should override these when available.
 */
export const KNOWN_TOKEN_DECIMALS: Readonly<Record<string, number>> = {
  // DOT ecosystem (10 decimals)
  DOT: 10,
  xcDOT: 10,

  // Moonbeam native (18 decimals)
  GLMR: 18,
  WGLMR: 18,

  // Stablecoins (6 decimals)
  USDC: 6,
  USDT: 6,
  'USDC.e': 6,
  'USDT.e': 6,
  xcUSDT: 6,
  xcUSDC: 6,

  // Other common tokens
  WETH: 18,
  'WETH.e': 18,
  ETH: 18,
  WBTC: 8,
  DAI: 18,
  FRAX: 18,
};

/**
 * Known token decimals by Moonbeam contract address (checksummed).
 */
export const KNOWN_ADDRESS_DECIMALS: Readonly<Record<string, number>> = {
  '0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080': 10, // xcDOT
  '0xAcc15dC74880C9944775448304B263D191c6077F': 18, // WGLMR
};

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

const MAX_DECIMALS = 78; // uint256 has at most 78 digits

export function assertValidDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
    throw new Error(
      `Invalid decimals: ${decimals}. Must be an integer in [0, ${MAX_DECIMALS}].`,
    );
  }
}

export function assertNonNegativeFinite(value: number, label = 'value'): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `Invalid ${label}: ${value}. Must be a non-negative finite number.`,
    );
  }
}

export function assertNonNegativeBigInt(value: bigint, label = 'value'): void {
  if (value < 0n) {
    throw new Error(`Invalid ${label}: ${value}. Must be non-negative.`);
  }
}

// ──────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────

/** Parse input to bigint. Accepts bigint or numeric string. */
function toBigInt(input: bigint | string): bigint {
  if (typeof input === 'bigint') return input;
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error(`Cannot convert to bigint: "${input}"`);
  }
  // Reject decimal strings like "1.5"
  if (input.includes('.')) {
    throw new Error(
      `Cannot convert decimal string "${input}" to bigint. Provide an integer string.`,
    );
  }
  try {
    return BigInt(input);
  } catch {
    throw new Error(`Cannot convert "${input}" to bigint.`);
  }
}

/** 10n ** BigInt(exp) — cached for common decimal counts. */
const POW10_CACHE = new Map<number, bigint>();
function pow10(exp: number): bigint {
  let cached = POW10_CACHE.get(exp);
  if (cached === undefined) {
    cached = 10n ** BigInt(exp);
    POW10_CACHE.set(exp, cached);
  }
  return cached;
}

// ──────────────────────────────────────────────
// Core conversions
// ──────────────────────────────────────────────

/**
 * Convert a smallest-unit integer to a human-readable decimal number.
 *
 * WARNING: For very large amounts, Number precision loss may occur.
 * Use `smallestUnitToDecimalString` for lossless output.
 */
export function smallestUnitToDecimal(
  smallestUnit: bigint | string,
  decimals: number,
): number {
  assertValidDecimals(decimals);
  const raw = toBigInt(smallestUnit);
  assertNonNegativeBigInt(raw, 'smallestUnit');

  if (decimals === 0) return Number(raw);

  const divisor = pow10(decimals);
  const whole = raw / divisor;
  const remainder = raw % divisor;

  // Combine as a float: whole + (remainder / divisor)
  return Number(whole) + Number(remainder) / Number(divisor);
}

/**
 * Lossless conversion: returns a string like "1234.5678901234".
 * No floating-point rounding. Useful for display and DB storage.
 */
export function smallestUnitToDecimalString(
  smallestUnit: bigint | string,
  decimals: number,
): string {
  assertValidDecimals(decimals);
  const raw = toBigInt(smallestUnit);
  assertNonNegativeBigInt(raw, 'smallestUnit');

  if (decimals === 0) return raw.toString();

  const divisor = pow10(decimals);
  const whole = raw / divisor;
  const remainder = raw % divisor;

  if (remainder === 0n) return whole.toString();

  // Pad remainder to `decimals` digits, then strip trailing zeros
  const fracStr = remainder.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

/**
 * Convert a human-readable decimal amount to smallest-unit bigint.
 * Floors sub-unit fractions (rounds toward zero).
 */
export function decimalToSmallestUnit(
  decimalAmount: number,
  decimals: number,
): bigint {
  assertValidDecimals(decimals);
  assertNonNegativeFinite(decimalAmount, 'decimalAmount');

  if (decimalAmount === 0) return 0n;
  if (decimals === 0) return BigInt(Math.floor(decimalAmount));

  // Use string-based multiplication to avoid floating-point drift for large values.
  // Split the decimal into integer and fractional parts.
  const str = decimalAmount.toFixed(decimals + 2); // extra digits for rounding
  const [intPart, fracPart = ''] = str.split('.');

  // Take only `decimals` fractional digits (truncate, don't round)
  const truncatedFrac = fracPart.slice(0, decimals).padEnd(decimals, '0');

  const combined = BigInt(intPart) * pow10(decimals) + BigInt(truncatedFrac);
  return combined;
}

// ──────────────────────────────────────────────
// USD conversions
// ──────────────────────────────────────────────

/**
 * Convert smallest-unit to USD value.
 */
export function smallestUnitToUsd(
  smallestUnit: bigint | string,
  decimals: number,
  priceUsd: number,
): number {
  assertNonNegativeFinite(priceUsd, 'priceUsd');
  return smallestUnitToDecimal(smallestUnit, decimals) * priceUsd;
}

/**
 * Convert USD value to smallest-unit bigint.
 * Throws on zero price (division by zero).
 */
export function usdToSmallestUnit(
  usdAmount: number,
  decimals: number,
  priceUsd: number,
): bigint {
  assertNonNegativeFinite(usdAmount, 'usdAmount');
  assertNonNegativeFinite(priceUsd, 'priceUsd');
  if (priceUsd === 0) {
    throw new Error('Cannot convert USD to smallest unit: priceUsd is 0.');
  }
  if (usdAmount === 0) return 0n;

  const tokenAmount = usdAmount / priceUsd;
  return decimalToSmallestUnit(tokenAmount, decimals);
}

// ──────────────────────────────────────────────
// DOT-specific convenience
// ──────────────────────────────────────────────

/** Convert DOT planck to human-readable DOT. */
export function planckToDot(planck: bigint | string): number {
  return smallestUnitToDecimal(planck, DOT_DECIMALS);
}

/** Convert human-readable DOT to planck bigint. */
export function dotToPlanck(dot: number): bigint {
  return decimalToSmallestUnit(dot, DOT_DECIMALS);
}

/** Convert DOT planck to USD. */
export function planckToUsd(planck: bigint | string, dotPriceUsd: number): number {
  return smallestUnitToUsd(planck, DOT_DECIMALS, dotPriceUsd);
}

/** Convert USD to DOT planck. */
export function usdToPlanck(usdAmount: number, dotPriceUsd: number): bigint {
  return usdToSmallestUnit(usdAmount, DOT_DECIMALS, dotPriceUsd);
}

// ──────────────────────────────────────────────
// Token registry lookup
// ──────────────────────────────────────────────

/** Look up decimals for a known token by symbol. Returns undefined if not found. */
export function getKnownDecimalsBySymbol(symbol: string): number | undefined {
  return KNOWN_TOKEN_DECIMALS[symbol];
}

/** Look up decimals for a known token by address. Returns undefined if not found. */
export function getKnownDecimalsByAddress(address: string): number | undefined {
  // Try exact match first, then try checksummed form
  return (
    KNOWN_ADDRESS_DECIMALS[address] ??
    KNOWN_ADDRESS_DECIMALS[address.toLowerCase()] ??
    // Check all known addresses case-insensitively
    Object.entries(KNOWN_ADDRESS_DECIMALS).find(
      ([k]) => k.toLowerCase() === address.toLowerCase(),
    )?.[1]
  );
}
