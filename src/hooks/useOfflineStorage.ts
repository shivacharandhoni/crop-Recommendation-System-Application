import { openDB, DBSchema, IDBPDatabase } from "idb";
import { useCallback, useEffect, useState } from "react";

interface ConversationRecord {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

interface MessageRecord {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  is_voice: boolean;
  created_at: string;
  synced: boolean;
}

interface KisanDBSchema extends DBSchema {
  conversations: {
    key: string;
    value: ConversationRecord;
    indexes: { "by-updated": string };
  };
  messages: {
    key: string;
    value: MessageRecord;
    indexes: { "by-conversation": string };
  };
}

const DB_NAME = "kisan-sahayak-offline";
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<KisanDBSchema> | null = null;

async function getDB(): Promise<IDBPDatabase<KisanDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<KisanDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Conversations store
      if (!db.objectStoreNames.contains("conversations")) {
        const convStore = db.createObjectStore("conversations", { keyPath: "id" });
        convStore.createIndex("by-updated", "updated_at");
      }

      // Messages store
      if (!db.objectStoreNames.contains("messages")) {
        const msgStore = db.createObjectStore("messages", { keyPath: "id" });
        msgStore.createIndex("by-conversation", "conversation_id");
      }
    },
  });

  return dbInstance;
}

export function useOfflineStorage() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initialize DB
    getDB().then(() => setIsReady(true)).catch(console.error);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Conversation operations
  const saveConversationLocally = useCallback(
    async (conversation: Omit<ConversationRecord, "synced">, synced = true) => {
      const db = await getDB();
      await db.put("conversations", { ...conversation, synced });
    },
    []
  );

  const getLocalConversations = useCallback(async (): Promise<ConversationRecord[]> => {
    const db = await getDB();
    const all = await db.getAll("conversations");
    return all.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, []);

  const getLocalConversation = useCallback(async (id: string): Promise<ConversationRecord | undefined> => {
    const db = await getDB();
    return db.get("conversations", id);
  }, []);

  const deleteLocalConversation = useCallback(async (id: string) => {
    const db = await getDB();
    // Delete conversation and its messages
    await db.delete("conversations", id);
    const messages = await db.getAllFromIndex("messages", "by-conversation", id);
    const tx = db.transaction("messages", "readwrite");
    await Promise.all(messages.map((msg) => tx.store.delete(msg.id)));
    await tx.done;
  }, []);

  const updateLocalConversationTitle = useCallback(async (id: string, title: string) => {
    const db = await getDB();
    const conv = await db.get("conversations", id);
    if (conv) {
      await db.put("conversations", { ...conv, title, synced: false });
    }
  }, []);

  // Message operations
  const saveMessageLocally = useCallback(
    async (message: Omit<MessageRecord, "synced">, synced = true) => {
      const db = await getDB();
      await db.put("messages", { ...message, synced });

      // Update conversation's updated_at
      const conv = await db.get("conversations", message.conversation_id);
      if (conv) {
        await db.put("conversations", {
          ...conv,
          updated_at: new Date().toISOString(),
        });
      }
    },
    []
  );

  const getLocalMessages = useCallback(async (conversationId: string): Promise<MessageRecord[]> => {
    const db = await getDB();
    const messages = await db.getAllFromIndex("messages", "by-conversation", conversationId);
    return messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, []);

  // Sync operations
  const getUnsyncedConversations = useCallback(async (): Promise<ConversationRecord[]> => {
    const db = await getDB();
    const all = await db.getAll("conversations");
    return all.filter((c) => !c.synced);
  }, []);

  const getUnsyncedMessages = useCallback(async (): Promise<MessageRecord[]> => {
    const db = await getDB();
    const all = await db.getAll("messages");
    return all.filter((m) => !m.synced);
  }, []);

  const markConversationSynced = useCallback(async (id: string) => {
    const db = await getDB();
    const conv = await db.get("conversations", id);
    if (conv) {
      await db.put("conversations", { ...conv, synced: true });
    }
  }, []);

  const markMessageSynced = useCallback(async (id: string) => {
    const db = await getDB();
    const msg = await db.get("messages", id);
    if (msg) {
      await db.put("messages", { ...msg, synced: true });
    }
  }, []);

  // Clear all local data (useful for full sync)
  const clearLocalData = useCallback(async () => {
    const db = await getDB();
    await db.clear("conversations");
    await db.clear("messages");
  }, []);

  // Bulk save (for initial sync)
  const bulkSaveConversations = useCallback(async (conversations: Omit<ConversationRecord, "synced">[]) => {
    const db = await getDB();
    const tx = db.transaction("conversations", "readwrite");
    await Promise.all(conversations.map((c) => tx.store.put({ ...c, synced: true })));
    await tx.done;
  }, []);

  const bulkSaveMessages = useCallback(async (messages: Omit<MessageRecord, "synced">[]) => {
    const db = await getDB();
    const tx = db.transaction("messages", "readwrite");
    await Promise.all(messages.map((m) => tx.store.put({ ...m, synced: true })));
    await tx.done;
  }, []);

  return {
    isOnline,
    isReady,
    // Conversations
    saveConversationLocally,
    getLocalConversations,
    getLocalConversation,
    deleteLocalConversation,
    updateLocalConversationTitle,
    // Messages
    saveMessageLocally,
    getLocalMessages,
    // Sync
    getUnsyncedConversations,
    getUnsyncedMessages,
    markConversationSynced,
    markMessageSynced,
    clearLocalData,
    bulkSaveConversations,
    bulkSaveMessages,
  };
}
