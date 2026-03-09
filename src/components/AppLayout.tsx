import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import AIChatPanel from "./AIChatPanel";
import ProfileTransitionGuard from "./ProfileTransitionGuard";
import LanguageSelector from "./LanguageSelector";
import { SidebarStateProvider, useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";

function AppLayoutInner({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebarState();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className={cn("transition-all duration-200", collapsed ? "ml-[52px]" : "ml-60")}>
        <header className="flex justify-end items-center px-8 py-3 border-b border-border bg-card">
          <LanguageSelector />
        </header>
        <main className="px-8 py-6">
          <ProfileTransitionGuard>
            {children}
          </ProfileTransitionGuard>
        </main>
      </div>
      <AIChatPanel />
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarStateProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </SidebarStateProvider>
  );
}
