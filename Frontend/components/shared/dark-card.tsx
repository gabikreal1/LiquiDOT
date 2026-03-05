import { cn } from "@/lib/utils";

interface DarkCardProps {
  children: React.ReactNode;
  className?: string;
}

export function DarkCard({ children, className }: DarkCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--ld-radius)] bg-ld-dark p-8",
        "before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_30%_50%,rgba(230,0,122,0.04)_0%,transparent_50%)]",
        "after:absolute after:inset-0 after:bg-[radial-gradient(ellipse_at_70%_40%,rgba(13,107,88,0.06)_0%,transparent_50%)]",
        className
      )}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
