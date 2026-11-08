"use client";

import CreateSessionModal from "@/components/attendance/create-session-modal";
import QrCodeModal from "@/components/attendance/qr-code-modal";
import BrandLogo from "@/components/shared/brand-logo";
import ThemeSelector from "@/components/shared/theme-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAttendance } from "@/context/attendance-context";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
  AlertIcon,
  BarChartIcon,
  BuildingIcon,
  CalendarIcon,
  GearIcon,
  LayoutGridIcon,
  LogOutIcon,
  PlusIcon,
  QrCodeIcon,
  TableIcon,
  XIcon,
} from "@/icons";
import type { AttendanceSession } from "@/types/attendance";
import { cn, getInitials } from "@/utils";
import { useState } from "react";

interface NavItem {
  id: string;
  label: string;
  mobileLabel: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  count?: number;
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sessions,
    records,
    departments,
    settings,
    error,
    clearError,
    signOut,
  } = useAttendance();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const openSession = sessions.find((s) => s.status === "open");
  const activeQrSession =
    sessions.find((s) => s.id === qrSessionId) ?? null;

  const activeDeptsCount = departments.filter((d) => d.isEnabled).length;

  const navItems: NavItem[] = [
    {
      id: "overview",
      label: "Overview",
      mobileLabel: "Overview",
      href: "/",
      icon: LayoutGridIcon,
    },
    {
      id: "sessions",
      label: "Attendance Sessions",
      mobileLabel: "Sessions",
      href: "/attendance",
      icon: CalendarIcon,
      count: sessions.length,
    },
    {
      id: "records",
      label: "Attendance Records",
      mobileLabel: "Records",
      href: "/records",
      icon: TableIcon,
      count: records.length,
    },
    {
      id: "analytics",
      label: "Analytics & Trends",
      mobileLabel: "Analytics",
      href: "/analytics",
      icon: BarChartIcon,
    },
    {
      id: "departments",
      label: "Departments",
      mobileLabel: "Depts",
      href: "/departments",
      icon: BuildingIcon,
      count: activeDeptsCount,
    },
    {
      id: "settings",
      label: "Settings",
      mobileLabel: "Settings",
      href: "/settings",
      icon: GearIcon,
    },
  ];

  const isNavItemActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || pathname === "/admin";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleSessionCreated = (created: AttendanceSession) => {
    setQrSessionId(created.id);
  };

  const handleSignOutConfirm = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      window.location.href = "/login";
    } catch {
      setIsSigningOut(false);
      setIsSignOutModalOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-(--ln-bg-canvas) text-(--ln-fg-primary)">
      {/* Desktop Minimalist Fixed Sidebar (Daily Tracker Architecture) */}
      <aside className="fixed inset-y-0 inset-s-0 z-30 hidden border-e border-(--ln-border) bg-(--ln-surface) lg:flex lg:w-64 lg:flex-col xl:w-72">
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-(--ln-border) px-6">
          <BrandLogo badge="Admin" />
        </div>

        {/* Primary Quick Action CTA */}
        <div className="px-4 pt-5 pb-2">
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="w-full justify-center shadow-theme-xs"
          >
            <PlusIcon className="size-4" />
            New Attendance Session
          </Button>
        </div>

        {/* Navigation Links */}
        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-1 overflow-y-auto px-3 py-3"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-(--ln-surface-warm) font-semibold text-brand-600 dark:text-brand-400"
                    : "text-(--ln-fg-muted) hover:bg-(--ln-surface-warm)/60 hover:text-(--ln-fg-primary)",
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "size-4.5 shrink-0 transition-transform duration-200 group-hover:scale-105",
                      active
                        ? "text-brand-600 dark:text-brand-400"
                        : "text-(--ln-fg-muted) group-hover:text-(--ln-fg-primary)",
                    )}
                  />
                  <span>{item.label}</span>
                </span>

                {typeof item.count === "number" && (
                  <span
                    className={cn(
                      "tabular rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-brand-500/30 bg-brand-500/12 text-brand-600 dark:text-brand-400"
                        : "border-(--ln-border) bg-(--ln-bg-canvas) text-(--ln-fg-secondary)",
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Live Session Status Callout */}
        {openSession && (
          <div className="mx-3 mb-3 rounded-xl border border-brand-500/25 bg-(--ln-surface-warm) p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                Live Check-In
              </span>
              <span className="tabular text-xs font-semibold text-(--ln-fg-primary)">
                {openSession.registrationCount} logged
              </span>
            </div>
            <p className="mt-1 truncate text-xs font-semibold text-(--ln-fg-primary)">
              {openSession.eventName}
            </p>
            <div className="mt-2.5 flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setQrSessionId(openSession.id)}
                className="flex-1"
              >
                <QrCodeIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
                QR Pass
              </Button>
              <Button
                variant="outline"
                size="xs"
                trailingArrow
                nativeButton={false}
                render={<Link href={`/attend/${openSession.token}`} />}
              >
                Portal
              </Button>
            </div>
          </div>
        )}

        {/* Sidebar Footer — Administrator Profile & Appearance Theme */}
        <div className="space-y-3 border-t border-(--ln-border) p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white shadow-theme-xs">
                {getInitials(settings.adminName || "Light Nation")}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-(--ln-fg-primary)">
                  {settings.adminName || "Administrator"}
                </p>
                <p className="truncate text-xs text-(--ln-fg-muted)">
                  {settings.adminEmail || "Signed in"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSignOutModalOpen(true)}
              title="Sign out"
              aria-label="Sign out"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-(--ln-border) text-(--ln-fg-muted) transition-colors hover:bg-(--ln-surface-warm) hover:text-(--ln-fg-primary)"
            >
              <LogOutIcon className="size-4" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[11px] font-medium text-(--ln-fg-muted)">
              Theme
            </span>
            <ThemeSelector variant="compact" />
          </div>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex min-h-screen flex-1 flex-col pb-20 lg:ps-64 lg:pb-10 xl:ps-72">
        {/* Mobile Sticky Top Header */}
        <header className="sticky top-0 z-30 border-b border-(--ln-border) bg-(--ln-surface)/95 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center justify-between gap-2 px-4">
            <BrandLogo size="sm" badge="Admin" />

            <div className="flex items-center gap-2">
              <ThemeSelector variant="compact" />
              <Button size="xs" onClick={() => setIsCreateOpen(true)}>
                <PlusIcon className="size-3.5" />
                Session
              </Button>
              <button
                type="button"
                onClick={() => setIsSignOutModalOpen(true)}
                title="Sign out"
                aria-label="Sign out"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-(--ln-border) text-(--ln-fg-muted) hover:text-(--ln-fg-primary)"
              >
                <LogOutIcon className="size-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Container */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          {error && (
            <div
              role="alert"
              className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-700 dark:text-red-300"
            >
              <div className="flex items-center gap-2.5">
                <AlertIcon className="size-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={clearError}
                aria-label="Dismiss error"
                className="rounded-lg p-1 text-red-700 hover:bg-red-500/15 dark:text-red-300"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (Daily Tracker 6-Column Grid) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-6 border-t border-(--ln-border) bg-(--ln-surface)/95 backdrop-blur-md lg:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                active
                  ? "font-semibold text-brand-600 dark:text-brand-400"
                  : "text-(--ln-fg-muted) hover:text-(--ln-fg-primary)",
              )}
            >
              <Icon className="size-4.5" />
              <span>{item.mobileLabel}</span>
            </Link>
          );
        })}
      </nav>

      {/* Global Create Session & QR Pass Modals accessible from Sidebar/Mobile Header */}
      <CreateSessionModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={handleSessionCreated}
      />

      <QrCodeModal
        session={activeQrSession}
        open={Boolean(activeQrSession)}
        onOpenChange={(open) => {
          if (!open) setQrSessionId(null);
        }}
      />

      {/* Sign Out Confirmation Dialog */}
      <Dialog
        open={isSignOutModalOpen}
        onOpenChange={(open) => {
          if (!open && !isSigningOut) setIsSignOutModalOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign Out</DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              disabled={isSigningOut}
              onClick={() => setIsSignOutModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={isSigningOut}
              loadingText="Signing out..."
              onClick={handleSignOutConfirm}
            >
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
