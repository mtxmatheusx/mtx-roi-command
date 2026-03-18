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
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <AppSidebar />

      <div
        className={cn(
          "transition-all duration-200 ease-out min-w-0",
          isMobile ? "ml-0" : collapsed ? "ml-[56px]" : "ml-60"
        )}
      >
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 h-14 border-b border-border bg-card/80 backdrop-blur-xl backdrop-saturate-150">
          {isMobile && (
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors duration-150 active:scale-95"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="ml-auto">
            <LanguageSelector />
          </div>
        </header>
        <main className="px-4 sm:px-8 py-5 sm:py-6">
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
