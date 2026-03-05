"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { getPools } from "@/lib/api/pools";
import { StatsRow } from "@/components/pools/stats-row";
import { FilterBar } from "@/components/pools/filter-bar";
import { PoolTable } from "@/components/pools/pool-table";
import { Pagination } from "@/components/pools/pagination";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useMemo(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);

  return debounced;
}

export default function PoolsPage() {
  // Filter state
  const [search, setSearch] = useState("");
  const [minTvl, setMinTvl] = useState("");
  const [minApr, setMinApr] = useState("");
  const [chain, setChain] = useState("");
  const [dex, setDex] = useState("");

  // Sort state
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({
    key: "apr",
    order: "desc",
  });

  // Pagination state
  const [offset, setOffset] = useState(0);
  const limit = 10;

  // Debounce filter values
  const debouncedSearch = useDebounce(search, 300);
  const debouncedMinTvl = useDebounce(minTvl, 300);
  const debouncedMinApr = useDebounce(minApr, 300);

  const queryParams = useMemo(
    () => ({
      limit,
      offset,
      sort: sort.key,
      order: sort.order,
      token: debouncedSearch || undefined,
      minTvl: debouncedMinTvl ? parseFloat(debouncedMinTvl) : undefined,
      minApr: debouncedMinApr ? parseFloat(debouncedMinApr) : undefined,
      chain: chain || undefined,
      dex: dex || undefined,
    }),
    [offset, sort, debouncedSearch, debouncedMinTvl, debouncedMinApr, chain, dex]
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["pools", queryParams],
    queryFn: () => getPools(queryParams),
    placeholderData: keepPreviousData,
  });

  const handleSort = useCallback(
    (key: string) => {
      setSort((prev) => ({
        key,
        order: prev.key === key && prev.order === "desc" ? "asc" : "desc",
      }));
      setOffset(0);
    },
    []
  );

  const handleReset = useCallback(() => {
    setSearch("");
    setMinTvl("");
    setMinApr("");
    setChain("");
    setDex("");
    setOffset(0);
  }, []);

  const handlePageChange = useCallback((newOffset: number) => {
    setOffset(newOffset);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mx-auto max-w-[1240px] px-6 py-10 sm:px-10"
    >
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-display text-[32px] font-bold tracking-[-0.5px] text-ld-ink">
          Pool Explorer
        </h1>
        <p className="mt-1 text-base text-ld-slate">
          Discover and compare liquidity pools across Polkadot parachains.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6">
        <StatsRow />
      </div>

      {/* Filters */}
      <div className="mb-6">
        <FilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setOffset(0);
          }}
          minTvl={minTvl}
          onMinTvlChange={(v) => {
            setMinTvl(v);
            setOffset(0);
          }}
          minApr={minApr}
          onMinAprChange={(v) => {
            setMinApr(v);
            setOffset(0);
          }}
          chain={chain}
          onChainChange={(v) => {
            setChain(v);
            setOffset(0);
          }}
          dex={dex}
          onDexChange={(v) => {
            setDex(v);
            setOffset(0);
          }}
          onReset={handleReset}
        />
      </div>

      {/* Table or loading/empty state */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-[var(--ld-radius-xs)] bg-ld-light-2"
            />
          ))}
        </div>
      ) : data && data.pools.length > 0 ? (
        <>
          <div className="mb-6">
            <PoolTable
              pools={data.pools}
              sort={sort}
              onSort={handleSort}
              isFetching={isFetching}
            />
          </div>
          <Pagination
            total={data.total}
            limit={data.limit}
            offset={data.offset}
            onPageChange={handlePageChange}
          />
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center rounded-[var(--ld-radius)] bg-white py-20 shadow-[var(--shadow-card)]"
        >
          <p className="mb-2 text-lg font-medium text-ld-ink">
            No pools match your filters
          </p>
          <button
            onClick={handleReset}
            className="text-sm text-ld-primary transition-colors hover:text-ld-accent"
          >
            Reset filters
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
