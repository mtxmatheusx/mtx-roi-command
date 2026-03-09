import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Instagram, Linkedin, FileText, Video, Image, Layers } from "lucide-react";

export type Platform = "instagram" | "tiktok" | "linkedin" | "blog";
export type ContentType = "carousel" | "static";

const platformConfig: Record<Platform, { label: string; icon: React.ReactNode; dimensions: string }> = {
  instagram: { label: "Instagram", icon: <Instagram className="w-4 h-4" />, dimensions: "1080×1350" },
  tiktok: { label: "TikTok", icon: <Video className="w-4 h-4" />, dimensions: "1080×1920" },
  linkedin: { label: "LinkedIn", icon: <Linkedin className="w-4 h-4" />, dimensions: "1200×627" },
  blog: { label: "Blog", icon: <FileText className="w-4 h-4" />, dimensions: "1200×630" },
};

interface ContentPlatformSelectorProps {
  platforms: Platform[];
  onPlatformsChange: (platforms: Platform[]) => void;
  contentType: ContentType;
  onContentTypeChange: (type: ContentType) => void;
}

export default function ContentPlatformSelector({
  platforms,
  onPlatformsChange,
  contentType,
  onContentTypeChange,
}: ContentPlatformSelectorProps) {
  const togglePlatform = (p: Platform) => {
    if (platforms.includes(p)) {
      if (platforms.length > 1) onPlatformsChange(platforms.filter((x) => x !== p));
    } else {
      onPlatformsChange([...platforms, p]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Platform Selection */}
      <div>
        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Plataformas</p>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(platformConfig) as [Platform, typeof platformConfig[Platform]][]).map(
            ([key, config]) => (
              <button
                key={key}
                onClick={() => togglePlatform(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  platforms.includes(key)
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {config.icon}
                {config.label}
                {platforms.includes(key) && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-primary-foreground/20 text-primary-foreground">
                    {config.dimensions}
                  </Badge>
                )}
              </button>
            )
          )}
        </div>
      </div>

      {/* Content Type */}
      <div>
        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Tipo de Conteúdo</p>
        <ToggleGroup
          type="single"
          value={contentType}
          onValueChange={(v) => v && onContentTypeChange(v as ContentType)}
          className="justify-start"
        >
          <ToggleGroupItem value="carousel" className="gap-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <Layers className="w-3.5 h-3.5" />
            Carrossel
          </ToggleGroupItem>
          <ToggleGroupItem value="static" className="gap-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <Image className="w-3.5 h-3.5" />
            Post Estático
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
