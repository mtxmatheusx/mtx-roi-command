import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Search, Trash2, CheckCircle, Clock, MessageSquare, Loader2, Filter } from "lucide-react";

interface FeedbackItem {
  id: string;
  copy_type: string | null;
  original_copy: string;
  suggested_correction: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  profile_id: string | null;
}

const copyTypeLabels: Record<string, string> = {
  direct_response: "Direct Response",
  storytelling: "Storytelling",
  social_proof: "Social Proof",
};

export default function FeedbackAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchFeedbacks = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("copy_feedback" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setFeedbacks(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchFeedbacks(); }, [user?.id]);

  const filtered = feedbacks.filter(f => {
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (typeFilter !== "all" && f.copy_type !== typeFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return f.original_copy.toLowerCase().includes(q) || f.suggested_correction.toLowerCase().includes(q);
    }
    return true;
  });

  const toggleStatus = async (fb: FeedbackItem) => {
    const newStatus = fb.status === "pending" ? "resolved" : "pending";
    await supabase.from("copy_feedback" as any).update({ status: newStatus } as any).eq("id", fb.id);
    setFeedbacks(prev => prev.map(f => f.id === fb.id ? { ...f, status: newStatus } : f));
    toast({ title: `Status: ${newStatus === "resolved" ? "Resolvido" : "Pendente"}` });
  };

  const deleteFeedback = async (id: string) => {
    await supabase.from("copy_feedback" as any).delete().eq("id", id);
    setFeedbacks(prev => prev.filter(f => f.id !== id));
    toast({ title: "Feedback excluído" });
  };

  const saveNotes = async () => {
    if (!selectedFeedback) return;
    setSaving(true);
    await supabase.from("copy_feedback" as any).update({ admin_notes: adminNotes } as any).eq("id", selectedFeedback.id);
    setFeedbacks(prev => prev.map(f => f.id === selectedFeedback.id ? { ...f, admin_notes: adminNotes } : f));
    setSaving(false);
    setSelectedFeedback(null);
    toast({ title: "Notas salvas" });
  };

  const pendingCount = feedbacks.filter(f => f.status === "pending").length;
  const resolvedCount = feedbacks.filter(f => f.status === "resolved").length;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            Feedbacks de Copy
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie sugestões de correção para melhorar as copies geradas pela IA</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{feedbacks.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent></Card>
          <Card className="border-warning/30"><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-warning">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent></Card>
          <Card className="border-success/30"><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-success">{resolvedCount}</p>
            <p className="text-xs text-muted-foreground">Resolvidos</p>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Filter className="w-4 h-4" />Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por termo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Tipos</SelectItem>
                  <SelectItem value="direct_response">Direct Response</SelectItem>
                  <SelectItem value="storytelling">Storytelling</SelectItem>
                  <SelectItem value="social_proof">Social Proof</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground">Nenhum feedback encontrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Copy Original (resumo)</TableHead>
                    <TableHead>Sugestão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(fb => (
                    <TableRow key={fb.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedFeedback(fb); setAdminNotes(fb.admin_notes || ""); }}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(fb.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        {fb.copy_type ? (
                          <Badge variant="outline" className="text-xs">{copyTypeLabels[fb.copy_type] || fb.copy_type}</Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">{fb.original_copy.slice(0, 80)}...</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs font-medium">{fb.suggested_correction.slice(0, 80)}...</TableCell>
                      <TableCell>
                        <Badge
                          className={fb.status === "resolved" ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"}
                          onClick={e => { e.stopPropagation(); toggleStatus(fb); }}
                        >
                          {fb.status === "resolved" ? <><CheckCircle className="w-3 h-3 mr-1" />Resolvido</> : <><Clock className="w-3 h-3 mr-1" />Pendente</>}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); deleteFeedback(fb.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedFeedback} onOpenChange={open => { if (!open) setSelectedFeedback(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Detalhe do Feedback
              {selectedFeedback?.copy_type && (
                <Badge variant="outline">{copyTypeLabels[selectedFeedback.copy_type] || selectedFeedback.copy_type}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedFeedback && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Copy Original</p>
                <div className="p-3 rounded-md bg-muted/50 text-sm whitespace-pre-wrap">{selectedFeedback.original_copy}</div>
              </div>
              <div>
                <p className="text-xs font-semibold text-primary uppercase mb-1">Sugestão de Correção</p>
                <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-sm whitespace-pre-wrap">{selectedFeedback.suggested_correction}</div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Notas do Admin</p>
                <Textarea placeholder="Adicione notas ou comentários..." value={adminNotes} onChange={e => setAdminNotes(e.target.value)} className="min-h-[80px]" />
              </div>
              <div className="flex justify-between items-center">
                <Badge
                  className={`cursor-pointer ${selectedFeedback.status === "resolved" ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"}`}
                  onClick={() => { toggleStatus(selectedFeedback); setSelectedFeedback({ ...selectedFeedback, status: selectedFeedback.status === "pending" ? "resolved" : "pending" }); }}
                >
                  {selectedFeedback.status === "resolved" ? <><CheckCircle className="w-3 h-3 mr-1" />Resolvido</> : <><Clock className="w-3 h-3 mr-1" />Pendente</>}
                </Badge>
                <Button onClick={saveNotes} disabled={saving} className="gap-1">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Salvar Notas
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
