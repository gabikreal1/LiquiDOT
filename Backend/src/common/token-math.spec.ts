import {
  assertValidDecimals,
  assertNonNegativeFinite,
  assertNonNegativeBigInt,
  smallestUnitToDecimal,
  smallestUnitToDecimalString,
  decimalToSmallestUnit,
  smallestUnitToUsd,
  usdToSmallestUnit,
  planckToDot,
  dotToPlanck,
  planckToUsd,
  usdToPlanck,
  getKnownDecimalsBySymbol,
  getKnownDecimalsByAddress,
  DOT_DECIMALS,
  GLMR_DECIMALS,
  USDC_DECIMALS,
  WBTC_DECIMALS,
} from './token-math';

// ================================================================
// Validation
// ================================================================

describe('assertValidDecimals', () => {
  it('should accept 0 decimals', () => {
    expect(() => assertValidDecimals(0)).not.toThrow();
  });

  it('should accept 10 decimals (DOT)', () => {
    expect(() => assertValidDecimals(10)).not.toThrow();
  });

  it('should accept 18 decimals (GLMR)', () => {
    expect(() => assertValidDecimals(18)).not.toThrow();
  });

  it('should accept 78 decimals (max)', () => {
    expect(() => assertValidDecimals(78)).not.toThrow();
  });

  it('should throw on negative decimals', () => {
    expect(() => assertValidDecimals(-1)).toThrow('Invalid decimals');
  });

  it('should throw on non-integer decimals (10.5)', () => {
    expect(() => assertValidDecimals(10.5)).toThrow('Invalid decimals');
  });

  it('should throw on NaN', () => {
    expect(() => assertValidDecimals(NaN)).toThrow('Invalid decimals');
  });

  it('should throw on Infinity', () => {
    expect(() => assertValidDecimals(Infinity)).toThrow('Invalid decimals');
  });

  it('should throw on decimals > 78', () => {
    expect(() => assertValidDecimals(79)).toThrow('Invalid decimals');
  });
});

describe('assertNonNegativeFinite', () => {
  it('should accept 0', () => {
    expect(() => assertNonNegativeFinite(0)).not.toThrow();
  });

  it('should accept positive number', () => {
    expect(() => assertNonNegativeFinite(123.456)).not.toThrow();
  });

  it('should throw on negative number', () => {
    expect(() => assertNonNegativeFinite(-1)).toThrow('Invalid');
  });

  it('should throw on NaN', () => {
    expect(() => assertNonNegativeFinite(NaN)).toThrow('Invalid');
  });

  it('should throw on Infinity', () => {
    expect(() => assertNonNegativeFinite(Infinity)).toThrow('Invalid');
  });

  it('should throw on -Infinity', () => {
    expect(() => assertNonNegativeFinite(-Infinity)).toThrow('Invalid');
  });
});

describe('assertNonNegativeBigInt', () => {
  it('should accept 0n', () => {
    expect(() => assertNonNegativeBigInt(0n)).not.toThrow();
  });

  it('should accept positive bigint', () => {
    expect(() => assertNonNegativeBigInt(1_000_000_000n)).not.toThrow();
  });

  it('should throw on negative bigint', () => {
    expect(() => assertNonNegativeBigInt(-1n)).toThrow('Invalid');
  });
});

// ================================================================
// smallestUnitToDecimal
// ================================================================

describe('smallestUnitToDecimal', () => {
  it('should convert 10_000_000_000n planck to 1.0 DOT (10 decimals)', () => {
    expect(smallestUnitToDecimal(10_000_000_000n, 10)).toBe(1.0);
  });

  it('should convert 15_000_000_000n planck to 1.5 DOT', () => {
    expect(smallestUnitToDecimal(15_000_000_000n, 10)).toBe(1.5);
  });

  it('should convert 0n to 0', () => {
    expect(smallestUnitToDecimal(0n, 10)).toBe(0);
  });

  it('should convert 1n to 1e-10 for DOT (smallest unit)', () => {
    expect(smallestUnitToDecimal(1n, 10)).toBeCloseTo(1e-10, 15);
  });

  it('should convert 1e18 wei to 1.0 GLMR (18 decimals)', () => {
    expect(smallestUnitToDecimal(1_000_000_000_000_000_000n, 18)).toBe(1.0);
  });

  it('should convert 1_000_000n to 1.0 USDC (6 decimals)', () => {
    expect(smallestUnitToDecimal(1_000_000n, 6)).toBe(1.0);
  });

  it('should convert 100_000_000n to 1.0 WBTC (8 decimals)', () => {
    expect(smallestUnitToDecimal(100_000_000n, 8)).toBe(1.0);
  });

  it('should accept string input "15000000000"', () => {
    expect(smallestUnitToDecimal('15000000000', 10)).toBe(1.5);
  });

  it('should handle very large amounts (10 billion DOT in planck)', () => {
    const tenBillionDotInPlanck = 10_000_000_000n * 10_000_000_000n; // 1e20
    expect(smallestUnitToDecimal(tenBillionDotInPlanck, 10)).toBe(10_000_000_000);
  });

  it('should handle 0 decimals (raw integer)', () => {
    expect(smallestUnitToDecimal(42n, 0)).toBe(42);
  });

  it('should throw on negative bigint', () => {
    expect(() => smallestUnitToDecimal(-1n, 10)).toThrow();
  });
});

// ================================================================
// smallestUnitToDecimalString
// ================================================================

describe('smallestUnitToDecimalString', () => {
  it('should return "1.5" for 15_000_000_000n with 10 decimals', () => {
    expect(smallestUnitToDecimalString(15_000_000_000n, 10)).toBe('1.5');
  });

  it('should return "0.0000000001" for 1n with 10 decimals', () => {
    expect(smallestUnitToDecimalString(1n, 10)).toBe('0.0000000001');
  });

  it('should return "0" for 0n', () => {
    expect(smallestUnitToDecimalString(0n, 10)).toBe('0');
  });

  it('should preserve full precision for large amounts', () => {
    // 123456789012345n with 10 decimals = 12345.6789012345
    expect(smallestUnitToDecimalString(123456789012345n, 10)).toBe(
      '12345.6789012345',
    );
  });

  it('should not have trailing zeros beyond decimal places', () => {
    // 10_000_000_000n with 10 decimals = exactly 1, no fraction
    expect(smallestUnitToDecimalString(10_000_000_000n, 10)).toBe('1');
    // 15_000_000_000n with 10 decimals = 1.5, not 1.5000000000
    expect(smallestUnitToDecimalString(15_000_000_000n, 10)).toBe('1.5');
  });
});

// ================================================================
// decimalToSmallestUnit
// ================================================================

describe('decimalToSmallestUnit', () => {
  it('should convert 1.0 DOT to 10_000_000_000n planck', () => {
    expect(decimalToSmallestUnit(1.0, 10)).toBe(10_000_000_000n);
  });

  it('should convert 1.5 DOT to 15_000_000_000n planck', () => {
    expect(decimalToSmallestUnit(1.5, 10)).toBe(15_000_000_000n);
  });

  it('should convert 0 to 0n', () => {
    expect(decimalToSmallestUnit(0, 10)).toBe(0n);
  });

  it('should floor fractional planck (1.00000000005 DOT → 10_000_000_000n)', () => {
    // 1.00000000005 DOT = 10,000,000,000.5 planck → floor to 10,000,000,000
    const result = decimalToSmallestUnit(1.00000000005, 10);
    expect(result).toBe(10_000_000_000n);
  });

  it('should convert 1.0 USDC to 1_000_000n (6 decimals)', () => {
    expect(decimalToSmallestUnit(1.0, 6)).toBe(1_000_000n);
  });

  it('should convert 1.0 GLMR to 1_000_000_000_000_000_000n (18 decimals)', () => {
    expect(decimalToSmallestUnit(1.0, 18)).toBe(1_000_000_000_000_000_000n);
  });

  it('should throw on negative amount', () => {
    expect(() => decimalToSmallestUnit(-1, 10)).toThrow();
  });

  it('should throw on NaN', () => {
    expect(() => decimalToSmallestUnit(NaN, 10)).toThrow();
  });

  it('should throw on Infinity', () => {
    expect(() => decimalToSmallestUnit(Infinity, 10)).toThrow();
  });
});

// ================================================================
// smallestUnitToUsd
// ================================================================

describe('smallestUnitToUsd', () => {
  it('should convert 1 DOT planck at $7.50 to $7.50', () => {
    const oneDotPlanck = 10_000_000_000n;
    expect(smallestUnitToUsd(oneDotPlanck, 10, 7.5)).toBeCloseTo(7.5, 2);
  });

  it('should convert 0n to $0', () => {
    expect(smallestUnitToUsd(0n, 10, 7.5)).toBe(0);
  });

  it('should handle DOT at $0.01 (low price)', () => {
    expect(smallestUnitToUsd(10_000_000_000n, 10, 0.01)).toBeCloseTo(0.01, 4);
  });

  it('should handle DOT at $1000 (high price)', () => {
    expect(smallestUnitToUsd(10_000_000_000n, 10, 1000)).toBeCloseTo(1000, 2);
  });

  it('should throw on negative price', () => {
    expect(() => smallestUnitToUsd(10_000_000_000n, 10, -5)).toThrow();
  });
});

// ================================================================
// usdToSmallestUnit
// ================================================================

describe('usdToSmallestUnit', () => {
  it('should convert $7.50 to 10_000_000_000n at $7.50/DOT', () => {
    expect(usdToSmallestUnit(7.5, 10, 7.5)).toBe(10_000_000_000n);
  });

  it('should convert $0 to 0n', () => {
    expect(usdToSmallestUnit(0, 10, 7.5)).toBe(0n);
  });

  it('should floor sub-planck amounts', () => {
    // $1 at $3/DOT = 0.33333... DOT = 3,333,333,333.33... planck → floor
    const result = usdToSmallestUnit(1, 10, 3);
    expect(result).toBe(3_333_333_333n);
  });

  it('should throw on $0 price (division by zero)', () => {
    expect(() => usdToSmallestUnit(100, 10, 0)).toThrow();
  });

  it('should throw on negative USD amount', () => {
    expect(() => usdToSmallestUnit(-100, 10, 7.5)).toThrow();
  });

  it('should throw on negative price', () => {
    expect(() => usdToSmallestUnit(100, 10, -7.5)).toThrow();
  });
});

// ================================================================
// DOT-specific convenience
// ================================================================

describe('planckToDot', () => {
  it('should be equivalent to smallestUnitToDecimal with decimals=10', () => {
    const planck = 25_000_000_000n; // 2.5 DOT
    expect(planckToDot(planck)).toBe(smallestUnitToDecimal(planck, 10));
  });

  it('should accept string input from DB', () => {
    expect(planckToDot('25000000000')).toBe(2.5);
  });
});

describe('dotToPlanck', () => {
  it('should be equivalent to decimalToSmallestUnit with decimals=10', () => {
    expect(dotToPlanck(2.5)).toBe(decimalToSmallestUnit(2.5, 10));
  });
});

describe('planckToUsd', () => {
  it('should convert 10_000_000_000n at $7.50 to $7.50', () => {
    expect(planckToUsd(10_000_000_000n, 7.5)).toBeCloseTo(7.5, 2);
  });
});

describe('usdToPlanck', () => {
  it('should convert $7.50 at $7.50/DOT to 10_000_000_000n', () => {
    expect(usdToPlanck(7.5, 7.5)).toBe(10_000_000_000n);
  });

  it('should convert $100 at $7.50/DOT correctly', () => {
    // $100 / $7.50 = 13.3333... DOT = 133,333,333,333.33... planck → floor
    expect(usdToPlanck(100, 7.5)).toBe(133_333_333_333n);
  });
});

// ================================================================
// Round-trip accuracy
// ================================================================

describe('round-trip conversions', () => {
  it('planck → DOT → planck should be identity for whole DOT amounts', () => {
    const original = 50_000_000_000n; // 5 DOT
    const dot = planckToDot(original);
    const backToPlanck = dotToPlanck(dot);
    expect(backToPlanck).toBe(original);
  });

  it('planck → USD → planck should be within 1 planck', () => {
    const price = 7.5;
    const original = 15_000_000_000n; // 1.5 DOT
    const usd = planckToUsd(original, price);
    const back = usdToPlanck(usd, price);
    const diff = original > back ? original - back : back - original;
    expect(diff).toBeLessThanOrEqual(1n);
  });

  it('USD → planck → USD should be within $0.01 for normal amounts', () => {
    const price = 7.5;
    const original = 1000; // $1000
    const planck = usdToPlanck(original, price);
    const back = planckToUsd(planck, price);
    expect(Math.abs(back - original)).toBeLessThan(0.01);
  });

  it('round-trip for large amounts (1M DOT)', () => {
    const original = 1_000_000; // DOT
    const planck = dotToPlanck(original);
    const back = planckToDot(planck);
    expect(back).toBe(original);
  });

  it('round-trip for tiny amounts (0.0001 DOT)', () => {
    const original = 0.0001;
    const planck = dotToPlanck(original);
    expect(planck).toBe(1_000_000n); // 0.0001 * 1e10 = 1,000,000
    const back = planckToDot(planck);
    expect(back).toBeCloseTo(original, 10);
  });
});

// ================================================================
// Token registry lookup
// ================================================================

describe('getKnownDecimalsBySymbol', () => {
  it('should return 10 for DOT', () => {
    expect(getKnownDecimalsBySymbol('DOT')).toBe(10);
  });

  it('should return 18 for GLMR', () => {
    expect(getKnownDecimalsBySymbol('GLMR')).toBe(18);
  });

  it('should return 6 for USDC', () => {
    expect(getKnownDecimalsBySymbol('USDC')).toBe(6);
  });

  it('should return 8 for WBTC', () => {
    expect(getKnownDecimalsBySymbol('WBTC')).toBe(8);
  });

  it('should return undefined for unknown token', () => {
    expect(getKnownDecimalsBySymbol('UNKNOWN_TOKEN')).toBeUndefined();
  });

  it('should be case-sensitive (matches registry keys exactly)', () => {
    expect(getKnownDecimalsBySymbol('dot')).toBeUndefined();
    expect(getKnownDecimalsBySymbol('Dot')).toBeUndefined();
  });
});

describe('getKnownDecimalsByAddress', () => {
  it('should return 10 for xcDOT address', () => {
    expect(
      getKnownDecimalsByAddress('0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080'),
    ).toBe(10);
  });

  it('should return 10 for xcDOT address (case-insensitive)', () => {
    expect(
      getKnownDecimalsByAddress('0xffffffff1fcacbd218edc0eba20fc2308c778080'),
    ).toBe(10);
  });

  it('should return undefined for unknown address', () => {
    expect(
      getKnownDecimalsByAddress('0x0000000000000000000000000000000000000000'),
    ).toBeUndefined();
  });
});

// ================================================================
// Edge cases
// ================================================================

describe('edge cases', () => {
  it('should handle 900M DOT in planck (near MAX_SAFE_INTEGER boundary)', () => {
    // 900M DOT = 9e18 planck. Number.MAX_SAFE_INTEGER ≈ 9.007e15.
    // This exceeds MAX_SAFE_INTEGER for Number, but bigint handles it.
    const planck = 9_000_000_000_000_000_000n; // 900M DOT
    const dot = planckToDot(planck);
    expect(dot).toBeCloseTo(900_000_000, 0);
  });

  it('should handle very small: 1 planck of USDC (1n with 6 dec)', () => {
    expect(smallestUnitToDecimal(1n, 6)).toBeCloseTo(0.000001, 10);
  });

  it('should handle multiple decimal conversions in sequence', () => {
    // Convert 100 USDC (6 dec) → smallest → back → smallest
    const original = decimalToSmallestUnit(100, 6);
    expect(original).toBe(100_000_000n);
    const back = smallestUnitToDecimal(original, 6);
    expect(back).toBe(100);
    const again = decimalToSmallestUnit(back, 6);
    expect(again).toBe(original);
  });

  it('should handle string with leading zeros "000100"', () => {
    expect(smallestUnitToDecimal('000100', 10)).toBeCloseTo(1e-8, 12);
  });

  it('should throw on empty string', () => {
    expect(() => smallestUnitToDecimal('', 10)).toThrow();
  });

  it('should convert "0" string to 0', () => {
    expect(smallestUnitToDecimal('0', 10)).toBe(0);
  });

  it('should throw on negative string "-100"', () => {
    expect(() => smallestUnitToDecimal('-100', 10)).toThrow();
  });

  it('should throw on decimal string "1.5" as bigint input', () => {
    expect(() => smallestUnitToDecimal('1.5', 10)).toThrow('decimal string');
  });

  it('should handle 0 decimals token (raw integer)', () => {
    expect(smallestUnitToDecimal(999n, 0)).toBe(999);
    expect(decimalToSmallestUnit(999, 0)).toBe(999n);
  });

  it('should handle 1 decimal token', () => {
    expect(smallestUnitToDecimal(15n, 1)).toBe(1.5);
    expect(decimalToSmallestUnit(1.5, 1)).toBe(15n);
  });

  it('should handle extreme decimals (50 decimals)', () => {
    const raw = 10n ** 50n; // exactly 1 token with 50 decimals
    expect(smallestUnitToDecimal(raw, 50)).toBeCloseTo(1.0, 0);
  });

  it('should use lossless string for precision where Number fails', () => {
    // 123456789012345678901234n with 10 decimals
    // Number would lose precision, but string should be exact
    const str = smallestUnitToDecimalString(123456789012345678901234n, 10);
    expect(str).toBe('12345678901234.5678901234');
  });

  it('should correctly export decimal constants', () => {
    expect(DOT_DECIMALS).toBe(10);
    expect(GLMR_DECIMALS).toBe(18);
    expect(USDC_DECIMALS).toBe(6);
    expect(WBTC_DECIMALS).toBe(8);
  });
});
