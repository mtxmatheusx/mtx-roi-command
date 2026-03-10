import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 128, g: 128, b: 128 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

interface ColorEditorProps {
  color: string;
  index: number;
  onChange: (index: number, newColor: string) => void;
  onRemove?: (index: number) => void;
  canRemove?: boolean;
}

export default function ColorEditor({ color, index, onChange, onRemove, canRemove }: ColorEditorProps) {
  const [hexInput, setHexInput] = useState(color);
  const rgb = hexToRgb(color);

  useEffect(() => {
    setHexInput(color);
  }, [color]);

  const handleHexChange = (val: string) => {
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      onChange(index, val);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="w-8 h-8 rounded-full border border-border shadow-sm cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          style={{ backgroundColor: color }}
          title={`Editar ${color}`}
        />
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" side="bottom" align="start" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <p className="text-xs font-semibold text-muted-foreground">Editar Cor</p>
        <div
          className="w-full h-10 rounded-md border"
          style={{ backgroundColor: color }}
        />
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-destructive font-bold">R: {rgb.r}</Label>
            <Slider min={0} max={255} step={1} value={[rgb.r]} onValueChange={([v]) => onChange(index, rgbToHex(v, rgb.g, rgb.b))} className="[&_[role=slider]]:bg-destructive [&_.bg-primary]:bg-destructive" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-green-600 font-bold">G: {rgb.g}</Label>
            <Slider min={0} max={255} step={1} value={[rgb.g]} onValueChange={([v]) => onChange(index, rgbToHex(rgb.r, v, rgb.b))} className="[&_[role=slider]]:bg-green-600 [&_.bg-primary]:bg-green-600" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-blue-600 font-bold">B: {rgb.b}</Label>
            <Slider min={0} max={255} step={1} value={[rgb.b]} onValueChange={([v]) => onChange(index, rgbToHex(rgb.r, rgb.g, v))} className="[&_[role=slider]]:bg-blue-600 [&_.bg-primary]:bg-blue-600" />
          </div>
        </div>
        <Input
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          className="text-xs font-mono h-8"
          maxLength={7}
        />
        {canRemove && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
            onClick={() => onRemove(index)}
          >
            <X className="w-3 h-3" /> Remover cor
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
