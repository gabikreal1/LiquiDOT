import Link from "next/link";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-6">
      <div className="text-center">
        <p className="mb-2 font-display text-7xl font-bold text-ld-primary/20">
          404
        </p>
        <h2 className="text-h3 mb-2 text-ld-ink">Page not found</h2>
        <p className="mb-6 max-w-md text-body text-ld-slate">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Button asChild className="bg-ld-primary text-white hover:bg-ld-primary/90">
          <Link href="/">
            <Home className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
