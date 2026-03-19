import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, GripVertical, Trash2, Calendar, User, Loader2 } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
}

const COLUMNS = [
  { id: "todo", label: "A Fazer", color: "bg-muted" },
  { id: "in_progress", label: "Fazendo", color: "bg-primary/10" },
  { id: "done", label: "Concluído", color: "bg-success/10" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/10 text-warning border-warning/20",
  high: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function KanbanBoard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeProfile } = useClientProfiles();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", priority: "medium", assigned_to: "", due_date: "" });

  const fetchTasks = async () => {
    if (!user?.id || !activeProfile?.id) return;
    const { data } = await supabase
      .from("team_tasks")
      .select("*")
      .eq("profile_id", activeProfile.id)
      .order("created_at", { ascending: false });
    if (data) setTasks(data as Task[]);
    setIsLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [user?.id, activeProfile?.id]);

  const createTask = async () => {
    if (!user?.id || !activeProfile?.id || !newTask.title.trim()) return;
    const { error } = await supabase.from("team_tasks").insert({
      user_id: user.id,
      profile_id: activeProfile.id,
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      assigned_to: newTask.assigned_to || null,
      due_date: newTask.due_date || null,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Tarefa criada!" });
      setNewTask({ title: "", description: "", priority: "medium", assigned_to: "", due_date: "" });
      setDialogOpen(false);
      fetchTasks();
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    await supabase.from("team_tasks").update({ status: newStatus }).eq("id", taskId);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from("team_tasks").delete().eq("id", taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    toast({ title: "Tarefa removida" });
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quadro de Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-1">Delegação e acompanhamento de tarefas da equipe</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Nova Tarefa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Tarefa</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <Input placeholder="Título da tarefa" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
              <Textarea placeholder="Descrição (opcional)" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                  <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Responsável" value={newTask.assigned_to} onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })} />
              </div>
              <Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} />
              <Button className="w-full" onClick={createTask} disabled={!newTask.title.trim()}>Criar Tarefa</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="space-y-3">
                <div className={`flex items-center justify-between p-3 rounded-lg ${col.color}`}>
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <Badge variant="secondary" className="text-xs">{columnTasks.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  <AnimatePresence>
                    {columnTasks.map((task) => (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="glass-card-interactive"
                      >
                        <Card className="border-border/50">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-medium leading-tight">{task.title}</h4>
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => deleteTask(task.id)}>
                                <Trash2 className="w-3 h-3 text-muted-foreground" />
                              </Button>
                            </div>
                            {task.description && <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[task.priority]}`}>
                                {task.priority === "low" ? "Baixa" : task.priority === "medium" ? "Média" : "Alta"}
                              </Badge>
                              {task.assigned_to && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <User className="w-3 h-3" />{task.assigned_to}
                                </span>
                              )}
                              {task.due_date && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Calendar className="w-3 h-3" />{new Date(task.due_date).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                            </div>
                            <Select value={task.status} onValueChange={(v) => updateTaskStatus(task.id, v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {COLUMNS.map((c) => (
                                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {columnTasks.length === 0 && (
                    <div className="flex items-center justify-center h-24 border border-dashed rounded-lg text-xs text-muted-foreground">
                      Sem tarefas
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
