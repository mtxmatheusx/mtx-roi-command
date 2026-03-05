import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import ActiveProfileHeader from "@/components/ActiveProfileHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Plus, Trash2, Loader2, Upload, X, ImageIcon } from "lucide-react";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UGCCharacter {
  id: string;
  name: string;
  fixed_description: string;
  image_references: string[];
  created_at: string;
}

export default function PersonagensUGC() {
  const { user } = useAuth();
  const { activeProfile } = useClientProfiles();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [characters, setCharacters] = useState<UGCCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UGCCharacter | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.id && activeProfile?.id) loadCharacters();
  }, [user?.id, activeProfile?.id]);

  const loadCharacters = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ugc_characters")
      .select("*")
      .eq("user_id", user!.id)
      .eq("profile_id", activeProfile!.id)
      .order("created_at", { ascending: false });
    if (data) setCharacters(data as UGCCharacter[]);
    setLoading(false);
  };

  const handleImageUpload = async (files: FileList) => {
    if (!user?.id || !activeProfile?.id) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const valid = Array.from(files).filter(f => allowed.includes(f.type));
    if (valid.length === 0) {
      toast({ title: "Formato inválido", description: "Use JPG, PNG ou WEBP.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const urls: string[] = [];
    for (const file of valid) {
      const ext = file.name.split(".").pop() || "png";
      const path = `ugc-characters/${activeProfile.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("creative-assets").upload(path, file, { contentType: file.type });
      if (error) {
        toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
        continue;
      }
      const { data: publicUrl } = supabase.storage.from("creative-assets").getPublicUrl(path);
      urls.push(publicUrl.publicUrl);
    }
    setUploadedImages(prev => [...prev, ...urls]);
    setIsUploading(false);
  };

  const handleSave = async () => {
    if (!user?.id || !activeProfile?.id || !name.trim()) return;
    setIsSaving(true);
    const { error } = await supabase.from("ugc_characters").insert({
      user_id: user.id,
      profile_id: activeProfile.id,
      name: name.trim(),
      fixed_description: description.trim(),
      image_references: uploadedImages,
    } as any);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Personagem salvo no cofre!" });
      setCreateOpen(false);
      setName("");
      setDescription("");
      setUploadedImages([]);
      loadCharacters();
    }
    setIsSaving(false);
  };

  const handleDelete = async (char: UGCCharacter) => {
    setIsDeleting(true);
    // Delete images from storage
    for (const url of char.image_references) {
      try {
        const path = url.split("/creative-assets/")[1];
        if (path) await supabase.storage.from("creative-assets").remove([path]);
      } catch {}
    }
    await supabase.from("ugc_characters").delete().eq("id", char.id);
    setCharacters(prev => prev.filter(c => c.id !== char.id));
    toast({ title: "Personagem removido." });
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <AppLayout>
      <ActiveProfileHeader />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              👥 Personagens UGC
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Salve personas com referências visuais para consistência nos criativos</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2" disabled={!activeProfile}>
            <Plus className="w-4 h-4" />
            Novo Personagem
          </Button>
        </div>

        {!activeProfile && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Selecione um perfil de cliente para gerenciar personagens.</p>
          </div>
        )}

        {activeProfile && loading && (
          <div className="text-center py-12"><Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" /></div>
        )}

        {activeProfile && !loading && characters.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum personagem criado ainda.</p>
            <p className="text-xs mt-1">Crie um para garantir consistência visual nos criativos gerados pela IA.</p>
          </div>
        )}

        {characters.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {characters.map(char => (
              <Card key={char.id} className="group hover:border-primary/30 transition-all">
                <CardContent className="pt-6 space-y-3">
                  {/* Image references preview */}
                  {char.image_references.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {char.image_references.slice(0, 4).map((url, i) => (
                        <img key={i} src={url} alt={`Ref ${i + 1}`} className="w-16 h-16 rounded-lg object-cover shrink-0 border border-border" />
                      ))}
                      {char.image_references.length > 4 && (
                        <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center shrink-0 text-xs text-muted-foreground">
                          +{char.image_references.length - 4}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-16 rounded-lg bg-secondary flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold text-sm">{char.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{char.fixed_description || "Sem descrição física"}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">
                      {char.image_references.length} ref(s)
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
                      onClick={() => setDeleteTarget(char)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Modal */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>👤 Novo Personagem UGC</DialogTitle>
              <DialogDescription>Salve uma persona com referências visuais para manter consistência nos criativos.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome do Personagem</label>
                <Input placeholder='Ex: "Modelo Principal" ou "Davi Fundador"' value={name} onChange={e => setName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Galeria de Referência (mín. 3 fotos recomendado)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {uploadedImages.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt={`Ref ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-border" />
                      <button
                        onClick={() => setUploadedImages(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center hover:border-primary/50 transition-all"
                    disabled={isUploading}
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  multiple
                  className="hidden"
                  onChange={e => { if (e.target.files?.length) handleImageUpload(e.target.files); }}
                />
                <p className="text-xs text-muted-foreground">Envie frente, 45° e perfil para melhor consistência.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Dossiê Físico (Prompt Fixo)</label>
                <Textarea
                  placeholder='Ex: "Homem, 35 anos, barba curta, olhos castanhos, expressão confiante, pele morena, cabelo curto escuro"'
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <Button onClick={handleSave} disabled={isSaving || !name.trim()} className="w-full gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Salvar no Cofre
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover personagem?</AlertDialogTitle>
              <AlertDialogDescription>
                "{deleteTarget?.name}" será removido permanentemente, incluindo todas as imagens de referência.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTarget && handleDelete(deleteTarget)}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
