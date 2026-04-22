import { useState } from "react";
import { Download, FileText, Image as ImageIcon, Check, Loader2, Settings2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { toPng, toJpeg } from "html-to-image";
import jsPDF from "jspdf";

interface ExportDashboardProps {
  elementId: string;
  dashboardName?: string;
  dateRange?: { since: string; until: string };
}

export default function ExportDashboard({ elementId, dashboardName = "Dashboard", dateRange }: ExportDashboardProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [exportType, setExportType] = useState<"pdf" | "png" | "jpeg">("pdf");
  const { toast } = useToast();

  // Export options
  const [options, setOptions] = useState({
    includeKpis: true,
    includeCharts: true,
    includeCampaigns: true,
    includeLogs: false,
    includeDemographics: true,
    includeUtm: true,
    quality: 0.95,
    pixelRatio: 2,
  });

  const handleExportClick = (type: "pdf" | "png" | "jpeg") => {
    setExportType(type);
    setShowOptions(true);
  };

  const generateFileName = (extension: string) => {
    const rangeStr = dateRange ? `${dateRange.since}_a_${dateRange.until}` : new Date().toISOString().split("T")[0];
    return `MTX_${dashboardName}_${rangeStr}.${extension}`;
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

    try {
      // Temporarily hide elements if needed
      // Note: We can use classes to hide elements during capture
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

      const fileName = generateFileName(exportType);
      const captureOptions = {
        quality: options.quality,
        pixelRatio: options.pixelRatio,
        backgroundColor: "#f9fafb", // Match app background
        style: {
          padding: "20px",
        }
      };

      if (exportType === "png") {
        const dataUrl = await toPng(element, captureOptions);
        downloadFile(dataUrl, fileName);
      } else if (exportType === "jpeg") {
        const dataUrl = await toJpeg(element, captureOptions);
        downloadFile(dataUrl, fileName);
      } else if (exportType === "pdf") {
        const dataUrl = await toJpeg(element, { ...captureOptions, quality: 0.95 });
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "px",
          format: "a4",
        });

        const imgProps = pdf.getImageProperties(dataUrl);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(dataUrl, "JPEG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(fileName);
      }

      // Restore hidden elements
      hiddenElements.forEach(el => {
        el.style.display = "";
      });

      toast({
        title: "Exportação concluída",
        description: `O arquivo ${fileName} foi gerado com sucesso.`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um problema ao gerar o arquivo.",
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
