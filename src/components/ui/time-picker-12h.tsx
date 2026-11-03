"use client";

import { cn } from "@/utils";
import React, { useId } from "react";

interface TimePicker12hProps {
  value: string; // "HH:mm" in 24-hour format (e.g. "06:00" or "17:30")
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // [1 .. 12]
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
); // ["00" .. "59"]

export default function TimePicker12h({
  value = "06:00",
  onChange,
  disabled = false,
  className,
  id,
}: TimePicker12hProps) {
  const generatedId = useId();
  const baseId = id || generatedId;

  // Parse 24h string into 12h, minutes, and AM/PM
  const parse24h = (timeStr: string) => {
    const fallback = { hour12: 6, minute: "00", period: "AM" as "AM" | "PM" };
    if (!timeStr || !timeStr.includes(":")) return fallback;

    const parts = timeStr.trim().split(":");
    const h24 = parseInt(parts[0], 10);
    const m = parts[1]?.slice(0, 2) || "00";

    if (isNaN(h24)) return fallback;

    const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
    const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const minute = m.padStart(2, "0");

    return { hour12, minute, period };
  };

  const { hour12, minute, period } = parse24h(value);

  const emitChange = (h12: number, min: string, per: "AM" | "PM") => {
    let h24: number;
    if (per === "AM") {
      h24 = h12 === 12 ? 0 : h12;
    } else {
      h24 = h12 === 12 ? 12 : h12 + 12;
    }
    const cleanMinute = min.padStart(2, "0").slice(0, 2);
    const formatted = `${String(h24).padStart(2, "0")}:${cleanMinute}`;
    onChange(formatted);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHour = parseInt(e.target.value, 10);
    emitChange(newHour, minute, period);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMinute = e.target.value;
    emitChange(hour12, newMinute, period);
  };

  const togglePeriod = (newPeriod: "AM" | "PM") => {
    if (newPeriod === period || disabled) return;
    emitChange(hour12, minute, newPeriod);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Box 1: Select Hour */}
      <select
        id={`${baseId}-hour`}
        value={hour12}
        disabled={disabled}
        onChange={handleHourChange}
        aria-label="Hour (1-12)"
        className="h-10 w-18 cursor-pointer rounded-xl border border-gray-300 bg-white px-2.5 text-center font-mono text-sm font-semibold text-gray-900 shadow-theme-xs outline-none transition-colors hover:border-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:border-gray-600"
      >
        {HOURS.map((h) => (
          <option key={h} value={h} className="dark:bg-gray-900 dark:text-white">
            {String(h).padStart(2, "0")}
          </option>
        ))}
      </select>

      <span className="text-base font-bold text-gray-400 dark:text-gray-500">
        :
      </span>

      {/* Box 2: Select Minutes */}
      <select
        id={`${baseId}-minute`}
        value={minute}
        disabled={disabled}
        onChange={handleMinuteChange}
        aria-label="Minute (00-59)"
        className="h-10 w-18 cursor-pointer rounded-xl border border-gray-300 bg-white px-2.5 text-center font-mono text-sm font-semibold text-gray-900 shadow-theme-xs outline-none transition-colors hover:border-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:border-gray-600"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m} className="dark:bg-gray-900 dark:text-white">
            {m}
          </option>
        ))}
      </select>

      {/* AM / PM Segmented Toggle Buttons */}
      <div
        role="group"
        aria-label="AM or PM"
        className="inline-flex h-10 items-center rounded-xl border border-gray-300 bg-gray-100 p-1 shadow-theme-xs dark:border-gray-700 dark:bg-gray-800"
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => togglePeriod("AM")}
          className={cn(
            "h-full rounded-lg px-3 text-xs font-bold transition-all",
            period === "AM"
              ? "bg-brand-500 text-white shadow-theme-xs dark:bg-brand-600"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
          )}
        >
          AM
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => togglePeriod("PM")}
          className={cn(
            "h-full rounded-lg px-3 text-xs font-bold transition-all",
            period === "PM"
              ? "bg-brand-500 text-white shadow-theme-xs dark:bg-brand-600"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
          )}
        >
          PM
        </button>
      </div>
    </div>
  );
}
