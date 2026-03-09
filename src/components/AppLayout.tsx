import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import AIChatPanel from "./AIChatPanel";
import ProfileTransitionGuard from "./ProfileTransitionGuard";
import LanguageSelector from "./LanguageSelector";
import { SidebarStateProvider, useSidebarState } from "@/hooks/useSidebarState";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";

function AppLayoutInner({ children }: { children: ReactNode }) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebarState();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <AppSidebar />

      <div
        className={cn(
          "transition-all duration-200 min-w-0",
          isMobile ? "ml-0" : collapsed ? "ml-[52px]" : "ml-60"
        )}
      >
        <header className="flex items-center justify-between px-4 sm:px-8 py-3 border-b border-border bg-card">
          {isMobile && (
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-2 rounded-md hover:bg-accent text-muted-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="ml-auto">
            <LanguageSelector />
          </div>
        </header>
        <main className="px-4 sm:px-8 py-4 sm:py-6">
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
