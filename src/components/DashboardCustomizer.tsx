import { useDashboardPrefs } from "@/hooks/useDashboardPrefs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings2, RotateCcw } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function DashboardCustomizer() {
  const { sections, toggle, reset } = useDashboardPrefs();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">Personalizar</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Seções do Dashboard</p>
          <Button variant="ghost" size="sm" onClick={reset} className="h-6 text-[10px] gap-1 text-muted-foreground">
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
        </div>
        <div className="space-y-2.5">
          {sections.map((section) => (
            <div
              key={section.id}
              className="flex items-center justify-between"
            >
              <span className="text-xs text-foreground">{section.label}</span>
              <Switch
                checked={section.visible}
                onCheckedChange={() => toggle(section.id)}
                className="scale-75"
              />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
