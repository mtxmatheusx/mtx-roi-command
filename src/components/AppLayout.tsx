import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import AIChatPanel from "./AIChatPanel";
import ProfileTransitionGuard from "./ProfileTransitionGuard";
import LanguageSelector from "./LanguageSelector";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background noise-bg">
      <AppSidebar />
      <div className="ml-64">
        <div className="flex justify-end items-center px-8 pt-4">
          <LanguageSelector />
        </div>
        <main className="px-8 pb-8">
          <ProfileTransitionGuard>
            {children}
          </ProfileTransitionGuard>
        </main>
      </div>
      <AIChatPanel />
    </div>
  );
}
