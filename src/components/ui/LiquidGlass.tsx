import * as React from "react";
import { cn } from "@/lib/utils";

interface LiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong" | "dark";
  noDistortion?: boolean;
  noPadding?: boolean;
}

const LiquidGlass = React.forwardRef<HTMLDivElement, LiquidGlassProps>(
  ({ className, variant = "default", noDistortion = false, noPadding = false, children, ...props }, ref) => {
    const baseClass =
      variant === "strong" ? "liquid-glass-strong" :
      variant === "dark" ? "liquid-glass-dark" :
      "liquid-glass";

    return (
      <div ref={ref} className={cn(baseClass, className)} {...props}>
        {!noDistortion && variant !== "dark" && <div className="lg-distortion" />}
        <div className="lg-overlay" />
        <div className="lg-specular" />
        <div className={cn("lg-content", noPadding && "!p-0")}>
          {children}
        </div>
      </div>
    );
  }
);
LiquidGlass.displayName = "LiquidGlass";

export { LiquidGlass };
