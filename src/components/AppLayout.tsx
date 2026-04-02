import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import AIChatPanel from "./AIChatPanel";
import ProfileTransitionGuard from "./ProfileTransitionGuard";
import LanguageSelector from "./LanguageSelector";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
        <div className="min-h-screen flex w-full glass-bg">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 h-14 glass border-b border-white/10" style={{ borderRadius: 0 }}>
            <SidebarTrigger className="-ml-2" />
            <div className="ml-auto">
              <LanguageSelector />
            </div>
          </header>
          <main className="px-4 sm:px-8 py-5 sm:py-6 flex-1">
            <ProfileTransitionGuard>
              {children}
            </ProfileTransitionGuard>
          </main>
        </div>
        <AIChatPanel />
      </div>
    </SidebarProvider>
  );
}
