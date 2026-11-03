import { AttendanceProvider } from "@/context/attendance-context";
import { ThemeProvider } from "@/context/theme-context";
import { isRtl } from "@/i18n/languages";
import { type Locale, routing } from "@/i18n/routing";
import { cn } from "@/utils";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "Light Nation Ibadan — Church Attendance Management System",
    template: "%s | Light Nation Ibadan",
  },
  description:
    "Official Church Attendance & Departmental Check-in Management System for Light Nation Ibadan.",
  icons: {
    icon: [
      { url: "/images/brand/light-nation-mark.png", type: "image/png" },
    ],
    shortcut: "/images/brand/light-nation-mark.png",
    apple: "/images/brand/light-nation-mark.png",
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('ln-theme-mode');
    var resolved = 'light';
    if (saved === 'light' || saved === 'dark' || saved === 'neutral') {
      resolved = saved;
    }
    var root = document.documentElement;
    root.classList.remove('light', 'dark', 'neutral');
    root.classList.add(resolved);
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-color-scheme', resolved === 'dark' ? 'dark' : 'light');
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const rtl = isRtl(locale as Locale);

  return (
    <html lang={locale} dir={rtl ? "rtl" : "ltr"} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..800;1,9..40,400..800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        suppressHydrationWarning
        className={cn("relative isolate min-h-dvh font-outfit")}
      >
        <NextIntlClientProvider>
          <ThemeProvider>
            <AttendanceProvider>
              <DirectionProvider direction={rtl ? "rtl" : "ltr"}>
                {children}
              </DirectionProvider>
            </AttendanceProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
