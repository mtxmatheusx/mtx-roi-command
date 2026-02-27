import { ReactNode, useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientProfiles } from "@/hooks/useClientProfiles";

export default function ProfileTransitionGuard({ children }: { children: ReactNode }) {
  const { activeProfile } = useClientProfiles();
  const prevId = useRef(activeProfile?.id);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (prevId.current && activeProfile?.id && prevId.current !== activeProfile.id) {
      setTransitioning(true);
      const timer = setTimeout(() => setTransitioning(false), 600);
      return () => clearTimeout(timer);
    }
    prevId.current = activeProfile?.id;
  }, [activeProfile?.id]);

  if (transitioning) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return <>{children}</>;
}
