import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useToast } from "@/hooks/use-toast";
import { Settings2, ShieldCheck, TrendingUp, RotateCcw, Copy, Save, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function AgentRulesEditor() {
  const { activeProfile, updateProfile } = useClientProfiles();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [rules, setRules] = useState({
    cpa_max_toleravel: activeProfile?.cpa_max_toleravel ?? 0,
    roas_min_escala: activeProfile?.roas_min_escala ?? 0,
    teto_diario_escala: activeProfile?.teto_diario_escala ?? 0,
    limite_escala: activeProfile?.limite_escala ?? 20,
    rollback_enabled: activeProfile?.rollback_enabled ?? true,
    rollback_roas_threshold: activeProfile?.rollback_roas_threshold ?? 10,
    vertical_scale_enabled: activeProfile?.vertical_scale_enabled ?? false,
  });

  // Sync when profile changes
  const profileId = activeProfile?.id;
  const [lastProfileId, setLastProfileId] = useState(profileId);
  if (profileId !== lastProfileId) {
    setLastProfileId(profileId);
    setRules({
      cpa_max_toleravel: activeProfile?.cpa_max_toleravel ?? 0,
      roas_min_escala: activeProfile?.roas_min_escala ?? 0,
      teto_diario_escala: activeProfile?.teto_diario_escala ?? 0,
      limite_escala: activeProfile?.limite_escala ?? 20,
      rollback_enabled: activeProfile?.rollback_enabled ?? true,
      rollback_roas_threshold: activeProfile?.rollback_roas_threshold ?? 10,
      vertical_scale_enabled: activeProfile?.vertical_scale_enabled ?? false,
    });
  }

  const handleSave = async () => {
    if (!activeProfile) return;
    setSaving(true);
    try {
      await updateProfile({ id: activeProfile.id, ...rules } as any);
      toast({ title: "✅ Regras salvas", description: "O agente usará as novas regras na próxima execução." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!activeProfile) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Regras do Agente
          </CardTitle>
          <CardDescription>Configure os limites que o agente autônomo deve respeitar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Guardian Rules */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-destructive" />
              <h4 className="text-sm font-semibold">Guardião — Pausa de Proteção</h4>
              <Badge variant="outline" className="text-[10px]">CPA</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">CPA Máximo Tolerável (R$)</Label>
                <Input
                  type="number" min="0" step="1"
                  value={rules.cpa_max_toleravel}
                  onChange={(e) => setRules(r => ({ ...r, cpa_max_toleravel: Number(e.target.value) }))}
                />
                <p className="text-[10px] text-muted-foreground">Pausa se CPA &gt; este valor × 1.15. Use 0 para desativar.</p>
              </div>
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1 flex flex-col justify-center">
                <p className="font-medium text-foreground">📋 Regras de Pausa:</p>
                <p>• CPA real &gt; R$ {(rules.cpa_max_toleravel * 1.15).toFixed(2)} → PAUSA</p>
                <p>• Gasto &gt; 50% budget + 0 conversões → PAUSA</p>
                <p>• Frequência &gt; 3.0 + CTR &lt; 0.8% → PAUSA</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Scale Rules */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-success" />
              <h4 className="text-sm font-semibold">Auto-Scale — Escala Horizontal</h4>
              <Badge variant="outline" className="text-[10px]">ROAS</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">ROAS Mínimo para Escala</Label>
                <Input
                  type="number" min="0" step="0.1"
                  value={rules.roas_min_escala}
                  onChange={(e) => setRules(r => ({ ...r, roas_min_escala: Number(e.target.value) }))}
                />
                <p className="text-[10px] text-muted-foreground">0 = desativado</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Teto Diário de Escala (R$)</Label>
                <Input
                  type="number" min="0" step="1"
                  value={rules.teto_diario_escala}
                  onChange={(e) => setRules(r => ({ ...r, teto_diario_escala: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Incremento de Escala (%)</Label>
                <Input
                  type="number" min="1" max="100" step="1"
                  value={rules.limite_escala}
                  onChange={(e) => setRules(r => ({ ...r, limite_escala: Number(e.target.value) }))}
                />
                <p className="text-[10px] text-muted-foreground">Ex: 20 = aumenta 20% por vez</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Rollback */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-semibold">Rollback de Escala</h4>
              </div>
              <Switch
                checked={rules.rollback_enabled}
                onCheckedChange={(checked) => setRules(r => ({ ...r, rollback_enabled: checked }))}
              />
            </div>
            {rules.rollback_enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3 border-l-2 border-amber-500/20">
                <div className="space-y-1.5">
                  <Label className="text-xs">ROAS Limiar para Rollback (x)</Label>
                  <Input
                    type="number" min="1" step="0.5"
                    value={rules.rollback_roas_threshold}
                    onChange={(e) => setRules(r => ({ ...r, rollback_roas_threshold: Number(e.target.value) }))}
                  />
                  <p className="text-[10px] text-muted-foreground">Se ROAS ≥ {rules.rollback_roas_threshold}x + 0 vendas no dia → rollback</p>
                </div>
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                  <p>• Campanha escalada + ROAS alto + 0 vendas HOJE</p>
                  <p>• Reverte ao orçamento anterior</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Vertical Scale */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-primary" />
              <div>
                <h4 className="text-sm font-semibold">Escala Vertical (Duplicação)</h4>
                <p className="text-[10px] text-muted-foreground">Duplica adsets quando budget ≥ 80% do teto</p>
              </div>
            </div>
            <Switch
              checked={rules.vertical_scale_enabled}
              onCheckedChange={(checked) => setRules(r => ({ ...r, vertical_scale_enabled: checked }))}
            />
          </div>

          <Separator />

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Regras
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
