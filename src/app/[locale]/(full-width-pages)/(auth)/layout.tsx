import AmbientBackground from "@/components/shared/ambient-background";
import BrandLogo from "@/components/shared/brand-logo";
import ThemeSelector from "@/components/shared/theme-selector";
import { CheckCircleIcon, QrCodeIcon, UsersIcon } from "@/icons";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-(--ln-bg-canvas) text-(--ln-fg-primary) transition-colors duration-200">
      <AmbientBackground intensity="vivid" />

      {/* Top Bar (Daily Tracker AuthShell Pattern) */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <BrandLogo size="md" href="/" />
        <ThemeSelector variant="compact" />
      </header>

      {/* Main Split Editorial + Glassmorphic Form Area */}
      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-10 px-6 py-6 sm:px-10 lg:grid-cols-12 lg:py-10">
        {/* Left: Editorial Brand Narrative (Desktop) */}
        <div className="hidden space-y-6 lg:col-span-6 lg:block lg:pe-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-(--ln-surface-warm) px-3.5 py-1.5 text-xs font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-400">
            Light Nation Ibadan · Administration
          </span>

          <h2 className="text-3xl leading-[1.15] font-semibold tracking-tight text-(--ln-fg-primary) xl:text-4xl">
            Calm, orderly church attendance &amp; departmental check-in.
          </h2>

          <p className="max-w-lg text-base leading-relaxed text-(--ln-fg-muted)">
            Generate service QR passes in seconds, monitor live turnout across
            Sunday and Midweek services, and export verified departmental
            attendance records with zero friction.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3.5 rounded-2xl border border-(--ln-border) bg-(--ln-surface)/90 p-4 shadow-theme-xs backdrop-blur-md">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--ln-surface-warm) text-brand-600 dark:text-brand-400">
                <QrCodeIcon className="size-4.5" />
              </span>
              <div className="text-xs">
                <p className="font-semibold text-(--ln-fg-primary)">
                  Instant Service QR Passes
                </p>
                <p className="mt-0.5 text-(--ln-fg-muted)">
                  Mobile-first 5-second check-in for congregation and workforce
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-2xl border border-(--ln-border) bg-(--ln-surface)/90 p-4 shadow-theme-xs backdrop-blur-md">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--ln-surface-warm) text-brand-600 dark:text-brand-400">
                <UsersIcon className="size-4.5" />
              </span>
              <div className="text-xs">
                <p className="font-semibold text-(--ln-fg-primary)">
                  Departmental Workforce Insights
                </p>
                <p className="mt-0.5 text-(--ln-fg-muted)">
                  Track Choir, Ushering, Media, Protocol, Sanctuary Keepers &amp;
                  more
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-2xl border border-(--ln-border) bg-(--ln-surface)/90 p-4 shadow-theme-xs backdrop-blur-md">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--ln-surface-warm) text-brand-600 dark:text-brand-400">
                <CheckCircleIcon className="size-4.5" />
              </span>
              <div className="text-xs">
                <p className="font-semibold text-(--ln-fg-primary)">
                  Duplicate Prevention &amp; Clean Exports
                </p>
                <p className="mt-0.5 text-(--ln-fg-muted)">
                  Automated session windows and one-click CSV reporting
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Form Card */}
        <div className="lg:col-span-6">{children}</div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 text-center text-xs text-(--ln-fg-muted) sm:px-10">
        © {new Date().getFullYear()} Light Nation Ibadan · Church Attendance
        Management System
      </footer>
    </div>
  );
}
