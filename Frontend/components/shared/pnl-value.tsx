import { cn } from "@/lib/utils";

interface PnlValueProps {
  usd: number;
  percent: number;
  className?: string;
}

export function PnlValue({ usd, percent, className }: PnlValueProps) {
  const isPositive = usd >= 0;
  const sign = isPositive ? "+" : "";

  return (
    <span
      className={cn(
        "font-mono text-sm font-medium",
        isPositive ? "text-green-500" : "text-red-500",
        className
      )}
    >
      {sign}${Math.abs(usd).toFixed(2)} ({sign}
      {percent.toFixed(2)}%)
    </span>
  );
}
