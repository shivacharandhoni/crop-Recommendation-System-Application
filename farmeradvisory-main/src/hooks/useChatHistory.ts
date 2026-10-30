import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineStorage } from "./useOfflineStorage";

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  is_voice: boolean;
  created_at: string;
}

export function useChatHistory() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInProgress = useRef(false);

  const {
    isOnline,
    isReady,
    saveConversationLocally,
    getLocalConversations,
    deleteLocalConversation,
    updateLocalConversationTitle,
    saveMessageLocally,
    getLocalMessages,
    getUnsyncedConversations,
    getUnsyncedMessages,
    markConversationSynced,
    markMessageSynced,
    bulkSaveConversations,
    bulkSaveMessages,
  } = useOfflineStorage();

  // Sync unsynced data to server when coming online
  const syncToServer = useCallback(async () => {
    if (!isOnline || syncInProgress.current) return;
    
    syncInProgress.current = true;
    setIsSyncing(true);

    try {
      // Sync unsynced conversations
      const unsyncedConvs = await getUnsyncedConversations();
      for (const conv of unsyncedConvs) {
        const { error } = await supabase
          .from("conversations")
          .upsert({
            id: conv.id,
            title: conv.title,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
          });

        if (!error) {
          await markConversationSynced(conv.id);
        }
      }

      // Sync unsynced messages
      const unsyncedMsgs = await getUnsyncedMessages();
      for (const msg of unsyncedMsgs) {
        const { error } = await supabase
          .from("messages")
          .upsert({
            id: msg.id,
            conversation_id: msg.conversation_id,
            role: msg.role,
            content: msg.content,
            is_voice: msg.is_voice,
            created_at: msg.created_at,
          });

        if (!error) {
          await markMessageSynced(msg.id);
        }
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      syncInProgress.current = false;
      setIsSyncing(false);
    }
  }, [isOnline, getUnsyncedConversations, getUnsyncedMessages, markConversationSynced, markMessageSynced]);

  // Fetch all conversations (from server if online, local if offline)
  const fetchConversations = useCallback(async () => {
    if (!isReady) return;
    
    setIsLoading(true);
    try {
      if (isOnline) {
        const { data, error } = await supabase
          .from("conversations")
          .select("*")
          .order("updated_at", { ascending: false });

        if (error) throw error;

        const convs = data || [];
        setConversations(convs);

        // Cache to local storage
        await bulkSaveConversations(convs);
      } else {
        // Load from local storage when offline
        const localConvs = await getLocalConversations();
        setConversations(localConvs);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
      // Fallback to local on error
      const localConvs = await getLocalConversations();
      setConversations(localConvs);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, isReady, bulkSaveConversations, getLocalConversations]);

  // Create a new conversation
  const createConversation = useCallback(async (title?: string): Promise<string | null> => {
    const newConv = {
      id: crypto.randomUUID(),
      title: title || "New Conversation",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      if (isOnline) {
        const { data, error } = await supabase
          .from("conversations")
          .insert(newConv)
          .select()
          .single();

        if (error) throw error;

        await saveConversationLocally(data);
        setConversations((prev) => [data, ...prev]);
        setCurrentConversationId(data.id);
        return data.id;
      } else {
        // Create locally when offline
        await saveConversationLocally(newConv, false);
        setConversations((prev) => [newConv, ...prev]);
        setCurrentConversationId(newConv.id);
        return newConv.id;
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
      // Fallback to local creation
      await saveConversationLocally(newConv, false);
      setConversations((prev) => [newConv, ...prev]);
      setCurrentConversationId(newConv.id);
      return newConv.id;
    }
  }, [isOnline, saveConversationLocally]);

  // Update conversation title
  const updateConversationTitle = useCallback(async (id: string, title: string) => {
    try {
      if (isOnline) {
        const { error } = await supabase
          .from("conversations")
          .update({ title })
          .eq("id", id);

        if (error) throw error;
      }

      await updateLocalConversationTitle(id, title);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      );
    } catch (error) {
      console.error("Error updating conversation:", error);
      // Update locally anyway
      await updateLocalConversationTitle(id, title);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      );
    }
  }, [isOnline, updateLocalConversationTitle]);

  // Delete a conversation
  const deleteConversation = useCallback(async (id: string) => {
    try {
      if (isOnline) {
        const { error } = await supabase
          .from("conversations")
          .delete()
          .eq("id", id);

        if (error) throw error;
      }

      await deleteLocalConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  }, [isOnline, currentConversationId, deleteLocalConversation]);

  // Save a message
  const saveMessage = useCallback(
    async (
      conversationId: string,
      role: "user" | "assistant",
      content: string,
      isVoice = false
    ) => {
      const newMsg = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        role,
        content,
        is_voice: isVoice,
        created_at: new Date().toISOString(),
      };

      try {
        if (isOnline) {
          const { error } = await supabase.from("messages").insert(newMsg);
          if (error) throw error;
          await saveMessageLocally(newMsg, true);
        } else {
          await saveMessageLocally(newMsg, false);
        }
      } catch (error) {
        console.error("Error saving message:", error);
        // Save locally on error
        await saveMessageLocally(newMsg, false);
      }
    },
    [isOnline, saveMessageLocally]
  );

  // Load messages for a conversation
  const loadMessages = useCallback(
    async (conversationId: string): Promise<Message[]> => {
      try {
        if (isOnline) {
          const { data, error } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true });

          if (error) throw error;

          const messages = (data || []) as Message[];
          
          // Cache messages locally
          await bulkSaveMessages(messages.map((m) => ({
            ...m,
            is_voice: m.is_voice ?? false,
          })));

          return messages;
        } else {
          // Load from local storage when offline
          const localMsgs = await getLocalMessages(conversationId);
          return localMsgs as Message[];
        }
      } catch (error) {
        console.error("Error loading messages:", error);
        // Fallback to local
        const localMsgs = await getLocalMessages(conversationId);
        return localMsgs as Message[];
      }
    },
    [isOnline, bulkSaveMessages, getLocalMessages]
  );

  // Load conversations on mount and when online status changes
  useEffect(() => {
    if (isReady) {
      fetchConversations();
    }
  }, [isReady, fetchConversations]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && isReady) {
      syncToServer();
    }
  }, [isOnline, isReady, syncToServer]);

  return {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    isLoading,
    isOnline,
    isSyncing,
    fetchConversations,
    createConversation,
    updateConversationTitle,
    deleteConversation,
    saveMessage,
    loadMessages,
  };
}
