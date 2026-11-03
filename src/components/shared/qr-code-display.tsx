"use client";

import { cn, generateQrMatrix } from "@/utils";
import Image from "next/image";
import { useMemo } from "react";

interface QrCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
  showCenterMark?: boolean;
}

export default function QrCodeDisplay({
  value,
  size = 220,
  className,
  showCenterMark = true,
}: QrCodeDisplayProps) {
  const matrix = useMemo(
    () => generateQrMatrix(value || "https://localhost:3000"),
    [value],
  );
  const gridCount = matrix.length;
  const center = Math.floor(gridCount / 2);

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-sm neutral:border-[#d5d0c7] dark:border-gray-700 dark:bg-white",
        className,
      )}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${gridCount} ${gridCount}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`QR Code for ${value}`}
        shapeRendering="crispEdges"
        className="block select-none"
      >
        <rect width={gridCount} height={gridCount} fill="#FFFFFF" />
        {matrix.map((row, rIdx) =>
          row.map((cell, cIdx) => {
            if (!cell) return null;
            if (
              showCenterMark &&
              Math.abs(rIdx - center) <= 2 &&
              Math.abs(cIdx - center) <= 2
            ) {
              return null;
            }
            return (
              <rect
                key={`${rIdx}-${cIdx}`}
                x={cIdx}
                y={rIdx}
                width={1}
                height={1}
                fill="#0F172A"
              />
            );
          }),
        )}
      </svg>

      {showCenterMark && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex size-9 items-center justify-center rounded-xl border-2 border-white bg-white p-1 shadow-sm ring-1 ring-gray-200">
            <Image
              src="/images/brand/light-nation-mark.png"
              alt="Light Nation Mark"
              width={28}
              height={28}
              className="size-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
