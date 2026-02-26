"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-6">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-h3 mb-2 text-ld-ink">Something went wrong</h2>
        <p className="mb-6 max-w-md text-body text-ld-slate">
          An unexpected error occurred. Please try again or contact support if
          the issue persists.
        </p>
        <Button
          onClick={reset}
          className="bg-ld-primary text-white hover:bg-ld-primary/90"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
