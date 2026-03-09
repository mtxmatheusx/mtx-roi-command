import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClientProfiles } from "@/hooks/useClientProfiles";

export type Msg = { role: "user" | "assistant"; content: string };

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function useChatHistory() {
  const { user } = useAuth();
  const { activeProfile } = useClientProfiles();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    setConversations((data as Conversation[]) || []);
  }, [user?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages((data as Msg[]) || []);
    setActiveConversationId(conversationId);
    setLoadingHistory(false);
  }, []);

  // Create new conversation
  const createConversation = useCallback(async (firstMessage: string): Promise<string | null> => {
    if (!user?.id) return null;
    const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "..." : "");
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({
        user_id: user.id,
        profile_id: activeProfile?.id || null,
        title,
      })
      .select("id")
      .single();
    if (error || !data) return null;
    await loadConversations();
    return data.id;
  }, [user?.id, activeProfile?.id, loadConversations]);

  // Save a message
  const saveMessage = useCallback(async (conversationId: string, role: "user" | "assistant", content: string) => {
    if (!user?.id) return;
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role,
      content,
    });
    // Touch conversation updated_at
    await supabase
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  }, [user?.id]);

  // Start new chat
  const startNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (id: string) => {
    await supabase.from("chat_conversations").delete().eq("id", id);
    if (activeConversationId === id) {
      startNewChat();
    }
    await loadConversations();
  }, [activeConversationId, startNewChat, loadConversations]);

  return {
    conversations,
    activeConversationId,
    messages,
    setMessages,
    loadingHistory,
    loadMessages,
    createConversation,
    saveMessage,
    startNewChat,
    deleteConversation,
    setActiveConversationId,
  };
}
