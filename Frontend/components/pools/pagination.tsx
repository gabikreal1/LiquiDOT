"use client";

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
}

export function Pagination({
  total,
  limit,
  offset,
  onPageChange,
}: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  if (totalPages <= 1) return null;

  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <span className="text-[13px] text-ld-slate">
        Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} pools
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          disabled={currentPage === 1}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ld-slate transition-colors hover:bg-ld-light-2 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange((page - 1) * limit)}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors"
          >
            {page === currentPage && (
              <motion.div
                layoutId="activePage"
                className="absolute inset-0 rounded-lg bg-ld-primary"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span
              className={`relative z-10 ${
                page === currentPage ? "text-white" : "text-ld-slate hover:text-ld-ink"
              }`}
            >
              {page}
            </span>
          </button>
        ))}

        <button
          onClick={() =>
            onPageChange(Math.min((totalPages - 1) * limit, offset + limit))
          }
          disabled={currentPage === totalPages}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ld-slate transition-colors hover:bg-ld-light-2 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
