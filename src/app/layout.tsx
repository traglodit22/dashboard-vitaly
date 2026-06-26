import { Fira_Sans, Fira_Code } from "next/font/google";
import type { Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { query } from "@/lib/db/index";
import { getPwaSettings, PWA_BACKGROUND_COLOR, PWA_THEME_COLOR } from "@/lib/pwa/settings";

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "cyrillic"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PWA_THEME_COLOR },
    { media: "(prefers-color-scheme: dark)", color: PWA_BACKGROUND_COLOR },
  ],
};

export async function generateMetadata() {
  const { name, shortName } = await getPwaSettings();
  try {
    const rows = await query<Record<string, unknown>>('SELECT site_title, favicon_base64 FROM system_settings WHERE id=1')
    const s = rows[0] ?? {}
    const title = (s.site_title as string) || name
    const hasFavicon = Boolean(s.favicon_base64)
    return {
      title,
      description: 'Отправки, товары, зарплаты',
      applicationName: title,
      appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: shortName,
      },
      formatDetection: {
        telephone: false,
      },
      ...(hasFavicon
        ? {
            icons: {
              icon: "/api/favicon",
              apple: "/apple-icon",
            },
          }
        : {
            icons: {
              apple: "/apple-icon",
            },
          }),
    }
  } catch {
    return {
      title: name,
      description: 'Отправки, товары, зарплаты',
      applicationName: name,
      appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: shortName,
      },
      icons: {
        apple: "/apple-icon",
      },
    }
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${firaSans.variable} ${firaCode.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AuthProvider>{children}</AuthProvider>
          <Toaster
            richColors
            position="top-center"
            closeButton
            offset={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
