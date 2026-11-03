"use client";

import BrandLogo from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-(--ln-bg-canvas) p-6 text-center">
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-theme-sm neutral:border-[#c8c2b6] neutral:bg-[#f5f3ef] dark:border-gray-800 dark:bg-[#151921]">
        <div className="mb-6 flex justify-center">
          <BrandLogo size="md" href="/" />
        </div>
        <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold tracking-wider text-brand-700 uppercase dark:bg-brand-500/15 dark:text-brand-300">
          404 — Page Not Found
        </span>
        <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
          Resource Not Found
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          The page or attendance link you requested could not be found in the
          Light Nation Ibadan system.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Button
            backArrow
            nativeButton={false}
            render={<Link href="/" />}
          >
            Back to Dashboard
          </Button>
          <Button
            variant="outline"
            leadingArrow
            nativeButton={false}
            render={<Link href="/attend/ln-ibd-sun1-nov01" />}
          >
            Public Check-In
          </Button>
        </div>
      </div>
    </div>
  );
}
