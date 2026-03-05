"use client";

interface PageSkeletonProps {
  variant?: "dashboard" | "table" | "detail" | "form";
}

export function PageSkeleton({ variant = "dashboard" }: PageSkeletonProps) {
  if (variant === "table") {
    return (
      <div className="mx-auto max-w-[1240px] px-6 py-12 sm:px-10">
        {/* Header skeleton */}
        <div className="mb-8 h-10 w-48 skeleton" />
        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 skeleton" />
          ))}
        </div>
        {/* Filter bar */}
        <div className="mb-6 h-12 skeleton" />
        {/* Table rows */}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="mx-auto max-w-[1240px] px-6 py-12 sm:px-10">
        {/* Back link */}
        <div className="mb-6 h-5 w-32 skeleton" />
        {/* Hero card */}
        <div className="mb-6 h-48 skeleton" />
        {/* Two column cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-64 skeleton" />
          <div className="h-64 skeleton" />
        </div>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className="mx-auto max-w-[1240px] px-6 py-12 sm:px-10">
        <div className="mb-8 h-10 w-64 skeleton" />
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex-1 space-y-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-32 skeleton" />
            ))}
          </div>
          <div className="w-full lg:w-[340px]">
            <div className="h-80 skeleton" />
          </div>
        </div>
      </div>
    );
  }

  // Default: dashboard
  return (
    <div className="mx-auto max-w-[1240px] px-6 py-12 sm:px-10">
      {/* Portfolio card */}
      <div className="mb-6 h-52 skeleton" />
      {/* Strategy strip */}
      <div className="mb-6 h-20 skeleton" />
      {/* Two column */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-72 skeleton" />
        <div className="h-72 skeleton" />
      </div>
      {/* Positions table */}
      <div className="mt-6 h-64 skeleton" />
    </div>
  );
}
