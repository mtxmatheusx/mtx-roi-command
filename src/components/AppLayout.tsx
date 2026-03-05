import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import AIChatPanel from "./AIChatPanel";
import ProfileTransitionGuard from "./ProfileTransitionGuard";
import LanguageSelector from "./LanguageSelector";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-60">
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
