import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquarePlus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Note {
  id: string;
  content: string;
  created_at: string;
  campaign_id: string;
}

interface CampaignNotesProps {
  campaignId: string;
  campaignName: string;
}

export default function CampaignNotes({ campaignId, campaignName }: CampaignNotesProps) {
  const { user } = useAuth();
  const { activeProfile } = useClientProfiles();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const profileId = activeProfile?.id;

  useEffect(() => {
    if (!profileId || !campaignId) return;
    loadNotes();
  }, [profileId, campaignId]);

  const loadNotes = async () => {
    setLoading(true);
    // Store notes in knowledge_base table tagged via field_key
    const { data } = await supabase
      .from("knowledge_base")
      .select("id, extracted_text, created_at")
      .eq("profile_id", profileId as string)
      .eq("field_key", `campaign_note_${campaignId}`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setNotes(data.map((d: any) => ({
        id: d.id,
        content: d.extracted_text || "",
        created_at: d.created_at,
        campaign_id: campaignId,
      })));
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newNote.trim() || !profileId || !user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("knowledge_base")
      .insert({
        profile_id: profileId,
        user_id: user.id,
        doc_type: "campaign_note",
        field_key: `campaign_note_${campaignId}`,
        file_name: `Nota: ${campaignName}`,
        extracted_text: newNote.trim(),
      });

    if (error) {
      toast({ title: "Erro ao salvar nota", description: error.message, variant: "destructive" });
    } else {
      setNewNote("");
      loadNotes();
    }
    setSaving(false);
  };

  const handleDelete = async (noteId: string) => {
    const { error } = await supabase
      .from("knowledge_base")
      .delete()
      .eq("id", noteId);

    if (!error) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquarePlus className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-medium">Notas</h4>
      </div>

      {/* Add note */}
      <div className="flex gap-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Ex: Troquei criativo dia 15, testando novo público..."
          className="min-h-[60px] text-sm resize-none"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={saving || !newNote.trim()}
          className="shrink-0 self-end"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
        </Button>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhuma nota ainda.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {notes.map((note) => (
            <div
              key={note.id}
              className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-muted/30 border border-border text-sm group"
            >
              <div className="flex-1">
                <p className="text-foreground text-xs whitespace-pre-wrap">{note.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(note.created_at).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(note.id)}
                className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
