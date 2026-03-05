import { cn } from "@/lib/utils";

const TOKEN_COLORS: Record<string, string> = {
  xcDOT: "#E6007A",
  WGLMR: "#627EEA",
  USDC: "#2775CA",
  USDT: "#26A17B",
  WETH: "#627EEA",
  WBTC: "#F7931A",
  DAI: "#F5AC37",
  GLMR: "#627EEA",
};

interface TokenPairDotsProps {
  token0: string;
  token1: string;
  className?: string;
}

export function TokenPairDots({
  token0,
  token1,
  className,
}: TokenPairDotsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: TOKEN_COLORS[token0] ?? "#6B8299" }}
        />
        <span
          className="inline-block h-2 w-2 rounded-full -ml-0.5"
          style={{ backgroundColor: TOKEN_COLORS[token1] ?? "#6B8299" }}
        />
      </div>
      <span className="font-display text-sm font-semibold">
        {token0}/{token1}
      </span>
    </div>
  );
}
