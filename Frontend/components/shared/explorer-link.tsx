"use client";

import { ExternalLink } from "lucide-react";
import { truncateHash } from "@/lib/utils/format";
import { getExplorerUrl, type ChainId } from "@/lib/utils/explorer";

interface ExplorerLinkProps {
  hash: string;
  chainId: ChainId;
  chars?: number;
  className?: string;
}

export function ExplorerLink({
  hash,
  chainId,
  chars = 4,
  className,
}: ExplorerLinkProps) {
  const url = getExplorerUrl(chainId, hash);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 font-mono text-sm text-ld-primary hover:underline ${className ?? ""}`}
    >
      {truncateHash(hash, chars)}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
