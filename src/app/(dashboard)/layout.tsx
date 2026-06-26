import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { MobileSubNav } from "@/components/MobileSubNav";
import { AuthGate } from "@/components/auth/AuthGate";
import { NavOrderProvider } from "@/components/navigation/NavOrderProvider";
import { OverviewNavProvider } from "@/components/overview/OverviewNavContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <NavOrderProvider>
        <OverviewNavProvider>
          <div className="flex h-dvh max-h-dvh flex-col overflow-hidden [@media(display-mode:standalone)]:pt-[env(safe-area-inset-top)]">
            <TopNav />
            <MobileSubNav />
            <div className="flex min-h-0 flex-1 overflow-hidden [@media(display-mode:standalone)]:pb-[env(safe-area-inset-bottom)]">
              <Sidebar />
              <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y">{children}</main>
            </div>
          </div>
        </OverviewNavProvider>
      </NavOrderProvider>
    </AuthGate>
  );
}
