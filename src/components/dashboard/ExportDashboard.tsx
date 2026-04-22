import { useState, useRef, useEffect } from "react";
import { 
  Download, 
  FileText, 
  Image as ImageIcon, 
  Check, 
  Loader2, 
  Settings2, 
  FileCode, 
  Maximize, 
  Type, 
  Palette,
  Eye,
  History,
  FileDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { toPng, toJpeg, toSvg } from "html-to-image";
import jsPDF from "jspdf";
import { format } from "date-fns";

interface ExportDashboardProps {
  elementId: string;
  dashboardName?: string;
  dateRange?: { since: string; until: string };
  variant?: "dropdown" | "button";
}


export default function ExportDashboard({ elementId, dashboardName = "Dashboard", dateRange, variant = "dropdown" }: ExportDashboardProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [exportType, setExportType] = useState<"pdf" | "png" | "jpeg" | "svg">("pdf");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  // Export options
  const [options, setOptions] = useState({
    includeKpis: true,
    includeCharts: true,
    includeCampaigns: true,
    includeLogs: false,
    includeDemographics: true,
    includeUtm: true,
    quality: 1,
    pixelRatio: 2,
    margins: 20,
    title: dashboardName,
    author: "MTX Intelligence",
    batchMode: false,
    theme: "light",
    customBg: "#f9fafb",
  });

  const handleExportClick = (type: "pdf" | "png" | "jpeg" | "svg") => {
    setExportType(type);
    setShowOptions(true);
    generatePreview();
  };

  const generatePreview = async () => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    try {
      const dataUrl = await toPng(element, { 
        pixelRatio: 0.5, 
        backgroundColor: options.customBg 
      });
      setPreviewUrl(dataUrl);
    } catch (e) {
      console.error("Preview failed", e);
    }
  };

  const generateFileName = (extension: string) => {
    const dateStr = format(new Date(), "yyyy-MM-dd");
    const rangeStr = dateRange ? `${dateRange.since}_to_${dateRange.until}` : dateStr;
    const sanitizedTitle = options.title.replace(/\s+/g, "_");
    return `MTX_${sanitizedTitle}_${rangeStr}.${extension}`;
  };

  const performExport = async () => {
    const element = document.getElementById(elementId);
    if (!element) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível encontrar o conteúdo do dashboard.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    setShowOptions(false);

    const formats: ("pdf" | "png" | "jpeg" | "svg")[] = options.batchMode 
      ? ["pdf", "png", "svg"] 
      : [exportType];

    try {
      // Temporarily hide elements
      const hideList: string[] = [];
      if (!options.includeKpis) hideList.push("[data-section='kpis']");
      if (!options.includeCharts) hideList.push("[data-section='charts']");
      if (!options.includeCampaigns) hideList.push("[data-section='campaigns']");
      if (!options.includeLogs) hideList.push("[data-section='logs']");
      if (!options.includeDemographics) hideList.push("[data-section='demographics']");
      if (!options.includeUtm) hideList.push("[data-section='utm']");

      const hiddenElements: HTMLElement[] = [];
      hideList.forEach(selector => {
        const els = element.querySelectorAll(selector);
        els.forEach(el => {
          (el as HTMLElement).style.display = "none";
          hiddenElements.push(el as HTMLElement);
        });
      });

      const captureOptions = {
        quality: options.quality,
        pixelRatio: options.pixelRatio,
        backgroundColor: options.customBg,
        style: {
          padding: `${options.margins}px`,
        }
      };

      for (const format of formats) {
        const fileName = generateFileName(format);
        
        if (format === "png") {
          const dataUrl = await toPng(element, captureOptions);
          downloadFile(dataUrl, fileName);
        } else if (format === "jpeg") {
          const dataUrl = await toJpeg(element, captureOptions);
          downloadFile(dataUrl, fileName);
        } else if (format === "svg") {
          const dataUrl = await toSvg(element, captureOptions);
          downloadFile(dataUrl, fileName);
        } else if (format === "pdf") {
          // For PDF, we use high-quality JPEG as the base
          const dataUrl = await toJpeg(element, { ...captureOptions, quality: 1, pixelRatio: 3 });
          const pdf = new jsPDF({
            orientation: "portrait",
            unit: "px",
            format: "a4",
            putOnlyUsedFonts: true,
          });

          // Add metadata to PDF
          pdf.setProperties({
            title: options.title,
            subject: "Dashboard Performance Report",
            author: options.author,
            keywords: "dashboard, analytics, mtx",
            creator: "MTX Dashboard System"
          });

          const imgProps = pdf.getImageProperties(dataUrl);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          pdf.addImage(dataUrl, "JPEG", 0, 0, pdfWidth, pdfHeight);
          pdf.save(fileName);
        }
        
        // Brief delay between batch exports
        if (options.batchMode) await new Promise(r => setTimeout(r, 500));
      }

      // Restore hidden elements
      hiddenElements.forEach(el => {
        el.style.display = "";
      });

      toast({
        title: options.batchMode ? "Exportação em lote concluída" : "Exportação concluída",
        description: `Arquivos gerados com alta qualidade e metadados incluídos.`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um problema ao gerar o arquivo. Tente reduzir a resolução.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const downloadFile = (dataUrl: string, fileName: string) => {
    const link = document.createElement("a");
    link.download = fileName;
    link.href = dataUrl;
    link.click();
  };


  return (
    <>
      {variant === "dropdown" ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-8" disabled={isExporting}>
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Formato do Arquivo</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExportClick("pdf")} className="gap-2">
              <FileText className="w-4 h-4" /> PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportClick("png")} className="gap-2">
              <ImageIcon className="w-4 h-4" /> PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportClick("jpeg")} className="gap-2">
              <ImageIcon className="w-4 h-4" /> JPEG
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 h-8" 
          disabled={isExporting}
          onClick={() => handleExportClick("pdf")}
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Gerar PDF
        </Button>
      )}

      <Dialog open={showOptions} onOpenChange={setShowOptions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Opções de Exportação
            </DialogTitle>
            <DialogDescription>
              Personalize o que será incluído no seu {exportType.toUpperCase()}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium leading-none">Elementos do Dashboard</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="kpis" 
                    checked={options.includeKpis} 
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includeKpis: !!checked }))}
                  />
                  <Label htmlFor="kpis">KPIs Principais</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="charts" 
                    checked={options.includeCharts} 
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includeCharts: !!checked }))}
                  />
                  <Label htmlFor="charts">Gráficos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="campaigns" 
                    checked={options.includeCampaigns} 
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includeCampaigns: !!checked }))}
                  />
                  <Label htmlFor="campaigns">Tabela de Campanhas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="demographics" 
                    checked={options.includeDemographics} 
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includeDemographics: !!checked }))}
                  />
                  <Label htmlFor="demographics">Demografia</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="utm" 
                    checked={options.includeUtm} 
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includeUtm: !!checked }))}
                  />
                  <Label htmlFor="utm">Análise UTM</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="logs" 
                    checked={options.includeLogs} 
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includeLogs: !!checked }))}
                  />
                  <Label htmlFor="logs">Logs de Automação</Label>
                </div>
              </div>
            </div>

            <DropdownMenuSeparator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="quality">Qualidade / Resolução</Label>
                <span className="text-xs font-mono text-muted-foreground">{options.pixelRatio}x</span>
              </div>
              <Slider
                id="quality"
                min={1}
                max={3}
                step={0.5}
                value={[options.pixelRatio]}
                onValueChange={(val) => setOptions(prev => ({ ...prev, pixelRatio: val[0] }))}
              />
              <p className="text-[10px] text-muted-foreground">
                Valores mais altos geram imagens mais nítidas, porém arquivos maiores.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOptions(false)}>Cancelar</Button>
            <Button onClick={performExport} className="gap-2">
              Gerar {exportType.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
