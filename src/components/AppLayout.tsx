import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import AIChatPanel from "./AIChatPanel";
import ProfileTransitionGuard from "./ProfileTransitionGuard";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background noise-bg">
      <AppSidebar />
      <main className="ml-64 p-8">
        <ProfileTransitionGuard>
          {children}
        </ProfileTransitionGuard>
      </main>
      <AIChatPanel />
    </div>
  );
}
