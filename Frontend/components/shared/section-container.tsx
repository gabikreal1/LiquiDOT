import { cn } from "@/lib/utils";

interface SectionContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionContainer({
  children,
  className,
}: SectionContainerProps) {
  return (
    <div className={cn("mx-auto max-w-[1240px] px-10", className)}>
      {children}
    </div>
  );
}
