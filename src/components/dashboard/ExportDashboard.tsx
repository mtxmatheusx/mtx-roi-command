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
  FileDown,
  Users
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
    margins: 40,
    title: dashboardName,
    author: "MTX Assessoria Estratégica",
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
    
    // Add temporary header and footer for preview
    const header = document.createElement("div");
    header.style.width = "100%";
    header.style.marginBottom = "20px";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.borderBottom = "1px solid #027F97";
    header.style.paddingBottom = "10px";
    header.innerHTML = `
      <div style="font-weight: 900; font-size: 18px; color: #027F97;">MTX ROI COMMAND</div>
      <div style="font-size: 8px; color: #8A8A8A; text-transform: uppercase;">Preview</div>
    `;

    const footer = document.createElement("div");
    footer.style.width = "100%";
    footer.style.marginTop = "20px";
    footer.style.display = "flex";
    footer.style.justifyContent = "space-between";
    footer.style.alignItems = "center";
    footer.style.borderTop = "1px solid #1E1E1E";
    footer.style.paddingTop = "10px";
    footer.innerHTML = `
      <div style="font-size: 8px; color: #8A8A8A;">MTX Assessoria Estratégica</div>
      <div style="font-size: 8px; color: #8A8A8A;">${format(new Date(), "dd/MM/yyyy")}</div>
    `;

    element.prepend(header);
    element.append(footer);

    try {
      const dataUrl = await toPng(element, { 
        pixelRatio: 0.5, 
        backgroundColor: options.customBg,
        style: {
          padding: `${options.margins}px`,
        }
      });
      setPreviewUrl(dataUrl);
    } catch (e) {
      console.error("Preview failed", e);
    } finally {
      header.remove();
      footer.remove();
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

    // Add temporary header and footer for visual identity
    const header = document.createElement("div");
    header.style.width = "100%";
    header.style.marginBottom = "40px";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.borderBottom = "2px solid #027F97";
    header.style.paddingBottom = "15px";
    header.innerHTML = `
      <div style="font-weight: 900; font-size: 28px; letter-spacing: -0.02em; color: #027F97; font-family: 'Inter', sans-serif;">MTX ROI COMMAND</div>
      <div style="font-size: 12px; color: #8A8A8A; font-family: 'Inter', sans-serif; text-transform: uppercase; letter-spacing: 0.1em;">Diagrama de Performance</div>
    `;

    const footer = document.createElement("div");
    footer.style.width = "100%";
    footer.style.marginTop = "40px";
    footer.style.display = "flex";
    footer.style.justifyContent = "space-between";
    footer.style.alignItems = "center";
    footer.style.borderTop = "1px solid #1E1E1E";
    footer.style.paddingTop = "15px";
    footer.innerHTML = `
      <div style="font-size: 11px; color: #8A8A8A; font-family: 'Inter', sans-serif;">MTX Assessoria Estratégica</div>
      <div style="font-size: 11px; color: #8A8A8A; font-family: 'Inter', sans-serif;">Exportado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
    `;

    element.prepend(header);
    element.append(footer);

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
          margin: "0",
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

      // Remove temporary header and footer
      header.remove();
      footer.remove();

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
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2">
              <FileDown className="w-4 h-4 text-primary" />
              Alta Qualidade
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExportClick("pdf")} className="gap-2">
              <FileText className="w-4 h-4" /> PDF Documento
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportClick("png")} className="gap-2">
              <ImageIcon className="w-4 h-4" /> PNG Imagem
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportClick("svg")} className="gap-2">
              <FileCode className="w-4 h-4" /> SVG Vetorial
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setOptions(p => ({ ...p, batchMode: true })); setShowOptions(true); }} className="gap-2 text-primary font-medium">
              <History className="w-4 h-4" /> Exportação em Lote
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
          Gerar Relatório
        </Button>
      )}

      <Dialog open={showOptions} onOpenChange={setShowOptions}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Settings2 className="w-5 h-5 text-primary" />
              Configurar Diagramação e Exportação
            </DialogTitle>
            <DialogDescription>
              Ajuste as diretrizes visuais e metadados antes da geração final.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="elements" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-3 h-11">
              <TabsTrigger value="elements" className="gap-2">
                <Maximize className="w-4 h-4" /> Elementos
              </TabsTrigger>
              <TabsTrigger value="style" className="gap-2">
                <Palette className="w-4 h-4" /> Estilos
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="w-4 h-4" /> Prévia
              </TabsTrigger>
            </TabsList>

            <TabsContent value="elements" className="space-y-6 pt-4">
              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Conteúdo do Diagrama</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {[
                    { id: "kpis", label: "KPIs Principais", state: options.includeKpis, key: "includeKpis" },
                    { id: "charts", label: "Gráficos Visuais", state: options.includeCharts, key: "includeCharts" },
                    { id: "campaigns", label: "Tabela de Campanhas", state: options.includeCampaigns, key: "includeCampaigns" },
                    { id: "demographics", label: "Dados Demográficos", state: options.includeDemographics, key: "includeDemographics" },
                    { id: "utm", label: "Análise de Canais (UTM)", state: options.includeUtm, key: "includeUtm" },
                    { id: "logs", label: "Histórico de Automação", state: options.includeLogs, key: "includeLogs" },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-secondary/20 transition-colors">
                      <Checkbox 
                        id={item.id} 
                        checked={item.state} 
                        onCheckedChange={(checked) => setOptions(prev => ({ ...prev, [item.key]: !!checked }))}
                      />
                      <Label htmlFor={item.id} className="cursor-pointer font-medium">{item.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <DropdownMenuSeparator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Resolução do Export (DPI)</Label>
                    <p className="text-[10px] text-muted-foreground">Nível de nitidez das linhas e textos.</p>
                  </div>
                  <span className="text-xs font-black px-2 py-1 bg-primary/10 text-primary rounded">{options.pixelRatio}x</span>
                </div>
                <Slider
                  min={1}
                  max={4}
                  step={0.5}
                  value={[options.pixelRatio]}
                  onValueChange={(val) => setOptions(prev => ({ ...prev, pixelRatio: val[0] }))}
                  className="py-2"
                />
              </div>
            </TabsContent>

            <TabsContent value="style" className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-primary" /> Título do Arquivo
                  </Label>
                  <Input 
                    value={options.title} 
                    onChange={(e) => setOptions(p => ({ ...p, title: e.target.value }))}
                    placeholder="Ex: Dashboard Performance Q3"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> Autor / Agência
                  </Label>
                  <Input 
                    value={options.author} 
                    onChange={(e) => setOptions(p => ({ ...p, author: e.target.value }))}
                    placeholder="Nome do responsável"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Ajustes de Diagramação</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label>Margens Internas</Label>
                      <span className="text-xs font-mono">{options.margins}px</span>
                    </div>
                    <Slider
                      min={0}
                      max={60}
                      step={5}
                      value={[options.margins]}
                      onValueChange={(val) => setOptions(prev => ({ ...prev, margins: val[0] }))}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Cor de Fundo</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="color" 
                        value={options.customBg} 
                        onChange={(e) => setOptions(p => ({ ...p, customBg: e.target.value }))}
                        className="w-12 h-10 p-1"
                      />
                      <Input 
                        value={options.customBg} 
                        onChange={(e) => setOptions(p => ({ ...p, customBg: e.target.value }))}
                        className="flex-1 font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
                <Checkbox 
                  id="batch" 
                  checked={options.batchMode} 
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, batchMode: !!checked }))}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="batch" className="cursor-pointer font-bold text-primary flex items-center gap-2">
                    <History className="w-4 h-4" /> Exportação Simultânea (Multi-formato)
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Gera PDF, PNG e SVG simultaneamente com um único clique.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="pt-4">
              <div className="relative aspect-video bg-secondary/30 rounded-xl border-2 border-dashed border-muted flex items-center justify-center overflow-hidden">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-contain shadow-2xl" />
                ) : (
                  <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Gerando prévia em tempo real...</p>
                  </div>
                )}
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-bold text-white flex items-center gap-2">
                  <Eye className="w-3 h-3" /> Visualização do Diagrama
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-4 text-center italic">
                * A prévia é gerada em baixa resolução para performance. O export final seguirá sua configuração de DPI.
              </p>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-8 gap-3 sm:gap-0">
            <Button variant="ghost" onClick={() => setShowOptions(false)}>Descartar</Button>
            <Button onClick={performExport} className="gap-2 bg-primary hover:bg-primary/90 px-8">
              {options.batchMode ? (
                <> <History className="w-4 h-4" /> Iniciar Lote </>
              ) : (
                <> <Download className="w-4 h-4" /> Gerar {exportType.toUpperCase()} </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
