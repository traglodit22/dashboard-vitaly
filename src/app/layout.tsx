import { Fira_Sans, Fira_Code } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { query } from "@/lib/db/index";

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

export async function generateMetadata() {
  try {
    const rows = await query<Record<string, unknown>>('SELECT site_title, favicon_base64 FROM system_settings WHERE id=1')
    const s = rows[0] ?? {}
    const title = (s.site_title as string) || 'Dashboard'
    const hasFavicon = Boolean(s.favicon_base64)
    return {
      title,
      description: 'Отправки, товары, зарплаты',
      ...(hasFavicon ? { icons: { icon: '/api/favicon' } } : {}),
    }
  } catch {
    return { title: 'Dashboard', description: 'Отправки, товары, зарплаты' }
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
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
