import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { MobileSubNav } from "@/components/MobileSubNav";
import { AuthGate } from "@/components/auth/AuthGate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="flex min-h-dvh flex-col [@media(display-mode:standalone)]:pt-[env(safe-area-inset-top)]">
        <TopNav />
        <MobileSubNav />
        <div className="flex flex-1 overflow-hidden [@media(display-mode:standalone)]:pb-[env(safe-area-inset-bottom)]">
          <Sidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </AuthGate>
  );
}
