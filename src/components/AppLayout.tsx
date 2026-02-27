import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import AIChatPanel from "./AIChatPanel";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background noise-bg">
      <AppSidebar />
      <main className="ml-64 p-8">
        {children}
      </main>
      <AIChatPanel />
    </div>
  );
}
