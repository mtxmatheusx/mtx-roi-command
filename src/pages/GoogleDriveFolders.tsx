import { useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FolderPlus, Download, Copy, Check } from "lucide-react";

const FOLDER_TEMPLATE = [
  "01 - Briefing & Identidade Visual",
  "02 - Criativos",
  "02 - Criativos/Fotos",
  "02 - Criativos/Vídeos",
  "02 - Criativos/Carrosséis",
  "03 - Copies & Scripts",
  "04 - Relatórios",
  "04 - Relatórios/Semanais",
  "04 - Relatórios/Mensais",
  "05 - Referências",
  "06 - Assets da Marca",
  "06 - Assets da Marca/Logo",
  "06 - Assets da Marca/Fontes",
  "06 - Assets da Marca/Paleta",
  "07 - Contratos & Docs",
];

export default function GoogleDriveFolders() {
  const { toast } = useToast();
  const { activeProfile, profiles } = useClientProfiles();
  const [clientName, setClientName] = useState(activeProfile?.name || "");
  const [copied, setCopied] = useState(false);

  const generateScript = (name: string) => {
    const folders = FOLDER_TEMPLATE.map((f) => `  "${name}/${f}"`).join(",\n");
    return `#!/bin/bash
# Script de criação de pastas no Google Drive (local)
# Cliente: ${name}
# Gerado pelo MTX Command Center

# Instruções:
# 1. Instale o rclone: https://rclone.org/install/
# 2. Configure o remote do Google Drive: rclone config
# 3. Substitua "gdrive:" pelo nome do seu remote
# 4. Execute: chmod +x create_folders.sh && ./create_folders.sh

REMOTE="gdrive:"
BASE_PATH="Clientes"

FOLDERS=(
${folders}
)

echo "🚀 Criando estrutura de pastas para: ${name}"
echo ""

for folder in "\${FOLDERS[@]}"; do
  echo "📁 Criando: \$folder"
  rclone mkdir "\$REMOTE\$BASE_PATH/\$folder"
done

echo ""
echo "✅ Estrutura criada com sucesso!"
echo "📂 Verifique em: Google Drive > Clientes > ${name}"
`;
  };

  const generateAllClientsScript = () => {
    const allScripts = profiles.map((p) => {
      const folders = FOLDER_TEMPLATE.map((f) => `  "${p.name}/${f}"`).join(",\n");
      return `# --- ${p.name} ---\nFOLDERS_${p.name.replace(/[^a-zA-Z0-9]/g, "_")}=(\n${folders}\n)\nfor folder in "\${FOLDERS_${p.name.replace(/[^a-zA-Z0-9]/g, "_")}[@]}"; do\n  rclone mkdir "$REMOTE$BASE_PATH/$folder"\ndone\necho "✅ ${p.name} - OK"`;
    });

    return `#!/bin/bash
# Script de criação de pastas para TODOS os clientes
# Gerado pelo MTX Command Center

REMOTE="gdrive:"
BASE_PATH="Clientes"

echo "🚀 Criando estrutura para ${profiles.length} clientes..."
echo ""

${allScripts.join("\n\n")}

echo ""
echo "✅ Todas as pastas foram criadas!"
`;
  };

  const downloadScript = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Script baixado!", description: `${filename} salvo com sucesso.` });
  };

  const copyScript = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copiado!" });
  };

  const script = generateScript(clientName || activeProfile?.name || "Cliente");

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pastas Google Drive</h1>
          <p className="text-sm text-muted-foreground mt-1">Gere scripts para criar a estrutura de pastas de cada cliente automaticamente</p>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Nome do cliente"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="flex-1"
              />
              <Button
                className="gap-2 shrink-0"
                onClick={() => downloadScript(script, `criar_pastas_${(clientName || "cliente").replace(/\s/g, "_")}.sh`)}
              >
                <Download className="w-4 h-4" /> Baixar Script
              </Button>
              {profiles.length > 1 && (
                <Button
                  variant="outline"
                  className="gap-2 shrink-0"
                  onClick={() => downloadScript(generateAllClientsScript(), "criar_pastas_todos_clientes.sh")}
                >
                  <FolderPlus className="w-4 h-4" /> Todos os Clientes
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Preview da Estrutura</CardTitle>
            <Button variant="ghost" size="sm" className="gap-2 text-xs" onClick={() => copyScript(script)}>
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {FOLDER_TEMPLATE.map((folder, i) => {
                const depth = folder.split("/").length - 1;
                const name = folder.split("/").pop();
                return (
                  <motion.div
                    key={folder}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-2"
                    style={{ paddingLeft: `${depth * 20}px` }}
                  >
                    <FolderPlus className="w-4 h-4 text-primary/60 shrink-0" />
                    <span className="text-sm">{name}</span>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">Como usar o script:</h3>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Instale o <a href="https://rclone.org/install/" target="_blank" rel="noopener" className="text-primary underline">rclone</a></li>
              <li>Configure o remote do Google Drive: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">rclone config</code></li>
              <li>Execute o script: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">chmod +x criar_pastas.sh && ./criar_pastas.sh</code></li>
            </ol>
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
}
