'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteMessageApi,
  getConversationsApi,
  getMessagesApi,
  getUsersApi,
  sendMessageApi,
  startConversationApi,
  uploadFileApi,
} from '../services/api';
import {
  enqueueMessage,
  getQueuedMessages,
  removeQueuedMessage,
  requestOutboxSync,
} from '../services/outbox';
import {
  emitDeleteMessage,
  emitSendMessage,
  emitTypingStart,
  emitTypingStop,
  joinConversationRoom,
  onMessageDeleted,
  onReceiveMessage,
  onUserTyping,
  onUserStopTyping,
} from '../services/socket';
import {
  formatContact,
  formatConversation,
  formatMessage,
  getEntityId,
} from '../utils/chatFormatters';
import { playMessageSound, primeNotificationSound } from '../utils/notificationSound';

function upsertMessage(messages, incoming) {
  const matchIndex = messages.findIndex(
    (message) =>
      message.id === incoming.id ||
      (incoming.clientId && message.clientId === incoming.clientId)
  );
  if (matchIndex === -1) return [...messages, incoming];

  const existing = messages[matchIndex];
  const next = [...messages];
  next[matchIndex] = {
    ...existing,
    ...incoming,
    // Preserve replyTo from optimistic message if the server response doesn't include it
    replyTo: incoming.replyTo || existing.replyTo,
  };
  return next;
}

export function useConversations({ currentUser, isBackendConnected }) {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messagesMap, setMessagesMap] = useState({});
  const [contacts, setContacts] = useState([]);
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(false);
  const [isContactsLoading, setIsContactsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const contactsAbortRef = useRef(null);
  const messagesAbortRef = useRef(null);
  const activeConversationIdRef = useRef(activeConversationId);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const resetConversationState = useCallback(() => {
    contactsAbortRef.current?.abort();
    messagesAbortRef.current?.abort();
    setContacts([]);
    setConversations([]);
    setActiveConversationId(null);
    setMessagesMap({});
  }, []);

  useEffect(() => {
    if (!currentUser || !isBackendConnected) {
      return undefined;
    }

    const controller = new AbortController();
    const currentUserId = getEntityId(currentUser);
    queueMicrotask(() => {
      if (!controller.signal.aborted) setIsInitialDataLoading(true);
    });

    Promise.all([
      getUsersApi('', controller.signal),
      getConversationsApi(controller.signal),
    ])
      .then(([{ users }, { conversations: liveConversations }]) => {
        setContacts(
          (users || [])
            .filter((candidate) => getEntityId(candidate) !== currentUserId)
            .map(formatContact)
        );
        setConversations(
          (liveConversations || [])
            .map((conversation) => formatConversation(conversation, currentUserId))
            .filter(Boolean)
        );
      })
      .catch((error) => {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
          console.error('Unable to load initial chat data:', error);
          resetConversationState();
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsInitialDataLoading(false);
      });

    return () => controller.abort();
  }, [currentUser, isBackendConnected, resetConversationState]);

  const loadContacts = useCallback(
    async (search = '') => {
      if (!currentUser) return;
      contactsAbortRef.current?.abort();
      const controller = new AbortController();
      contactsAbortRef.current = controller;
      setIsContactsLoading(true);

      try {
        const { users } = await getUsersApi(search, controller.signal);
        const currentUserId = getEntityId(currentUser);
        setContacts(
          (users || [])
            .filter((candidate) => getEntityId(candidate) !== currentUserId)
            .map(formatContact)
        );
      } catch (error) {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
          console.error('Error loading people:', error);
        }
      } finally {
        if (contactsAbortRef.current === controller) {
          setIsContactsLoading(false);
        }
      }
    },
    [currentUser]
  );

  const selectConversation = useCallback(
    async (conversationId) => {
      messagesAbortRef.current?.abort();
      const controller = new AbortController();
      messagesAbortRef.current = controller;
      setActiveConversationId(conversationId);
      setIsMessagesLoading(true);

      setConversations((previous) =>
        previous.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
      );

      try {
        const { messages } = await getMessagesApi(conversationId, controller.signal);
        const formatted = (messages || []).map((message) =>
          formatMessage(message, getEntityId(currentUser))
        );
        setMessagesMap((previous) => ({ ...previous, [conversationId]: formatted }));
      } catch (error) {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
          console.error('Error loading conversation messages:', error);
        }
      } finally {
        if (messagesAbortRef.current === controller) setIsMessagesLoading(false);
      }
    },
    [currentUser]
  );

  // Unlock audio on the first interaction, so the very first incoming chime is
  // not swallowed by the browser's autoplay policy.
  useEffect(() => {
    const unlock = () => primeNotificationSound();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const [typingMap, setTypingMap] = useState({});

  const sendTypingStart = useCallback((conversationId) => {
    if (conversationId) emitTypingStart(conversationId);
  }, []);

  const sendTypingStop = useCallback((conversationId) => {
    if (conversationId) emitTypingStop(conversationId);
  }, []);

  useEffect(() => {
    if (!currentUser || !isBackendConnected) return undefined;

    const unbindTyping = onUserTyping(({ conversationId }) => {
      if (conversationId) {
        setTypingMap((prev) => ({ ...prev, [conversationId]: true }));
      }
    });

    const unbindStopTyping = onUserStopTyping(({ conversationId }) => {
      if (conversationId) {
        setTypingMap((prev) => ({ ...prev, [conversationId]: false }));
      }
    });

    return () => {
      unbindTyping();
      unbindStopTyping();
    };
  }, [currentUser, isBackendConnected]);

  useEffect(() => {
    if (!currentUser || !isBackendConnected) return undefined;
    if (activeConversationId) joinConversationRoom(activeConversationId);

    return onReceiveMessage((incomingMessage) => {
      const currentUserId = getEntityId(currentUserRef.current);
      const formatted = formatMessage(incomingMessage, currentUserId);
      const convId = formatted.conversationId;

      setTypingMap((prev) => ({ ...prev, [convId]: false }));

      // Chime for messages from the other person only, and only if they have
      // not switched sound off. Own messages echo back over the socket too.
      if (
        !formatted.isSentByMe &&
        currentUserRef.current?.preferences?.soundEnabled !== false
      ) {
        playMessageSound();
      }

      setMessagesMap((previous) => ({
        ...previous,
        [convId]: upsertMessage(previous[convId] || [], formatted),
      }));

      let lastMsgText = formatted.text;
      if (!lastMsgText && incomingMessage.attachment) {
        const type = incomingMessage.attachment.type;
        if (type === 'image') lastMsgText = 'Sent a photo';
        else if (type === 'video') lastMsgText = 'Sent a video';
        else if (type === 'audio') lastMsgText = 'Sent an audio file';
        else lastMsgText = 'Sent a document';
      }

      setConversations((previous) => {
        const existingIndex = previous.findIndex((c) => c.id === convId);
        const isActive = activeConversationIdRef.current === convId;

        if (existingIndex !== -1) {
          const existing = previous[existingIndex];
          const updated = {
            ...existing,
            lastMessage: lastMsgText || 'New message',
            time: formatted.time || 'Just now',
            unreadCount:
              !isActive && !formatted.isSentByMe
                ? (existing.unreadCount || 0) + 1
                : existing.unreadCount,
          };
          const remaining = previous.filter((c) => c.id !== convId);
          return [updated, ...remaining];
        }

        getConversationsApi()
          .then(({ conversations: liveConversations }) => {
            if (liveConversations) {
              setConversations(
                liveConversations
                  .map((conv) => formatConversation(conv, currentUserId))
                  .filter(Boolean)
              );
            }
          })
          .catch((err) => console.error('Failed to sync conversations:', err));

        return previous;
      });
    });
  }, [activeConversationId, currentUser, isBackendConnected]);

  const markMessage = useCallback((conversationId, clientId, changes) => {
    setMessagesMap((previous) => ({
      ...previous,
      [conversationId]: (previous[conversationId] || []).map((message) =>
        message.clientId === clientId ? { ...message, ...changes } : message
      ),
    }));
  }, []);

  const notifyOutboxChanged = useCallback(() => {
    window.dispatchEvent(new Event('pingme:outbox-changed'));
  }, []);

  /** Park a message in the IndexedDB outbox so it survives a reload while offline. */
  const queuePayload = useCallback(
    async (payload) => {
      await enqueueMessage(payload);
      markMessage(payload.conversationId, payload.clientId, {
        status: 'queued',
        error: undefined,
      });
      notifyOutboxChanged();
    },
    [markMessage, notifyOutboxChanged]
  );

  const sendPayload = useCallback(
    async (payload) => {
      const response = isBackendConnected
        ? await emitSendMessage(payload)
        : { ok: false, error: 'You are offline' };

      if (!response.ok) {
        markMessage(payload.conversationId, payload.clientId, {
          status: 'failed',
          error: response.error || 'Message was not delivered',
        });
        return false;
      }

      markMessage(payload.conversationId, payload.clientId, {
        id: response.messageId || payload.clientId,
        status: 'sent',
        error: undefined,
      });
      return true;
    },
    [isBackendConnected, markMessage]
  );

  const sendMessage = useCallback(
    async (text, file, onUploadProgress, replyTo) => {
      if (!activeConversationId) return;

      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

      let attachment;
      if (file) {
        // Uploads need Cloudinary, so an attachment can never be queued offline.
        if (isOffline) {
          throw new Error('Attachments need a connection. Reconnect and try again.');
        }
        const uploadResult = await uploadFileApi(file, onUploadProgress);
        attachment = uploadResult.attachment;
      }

      const clientId = crypto.randomUUID();
      const payload = {
        clientId,
        conversationId: activeConversationId,
        text,
        attachment,
        replyTo: replyTo || undefined,
      };
      const optimisticMessage = {
        id: clientId,
        clientId,
        conversationId: activeConversationId,
        senderId: getEntityId(currentUser),
        text,
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        isSentByMe: true,
        status: 'sending',
        attachment,
        replyTo: payload.replyTo,
        retryPayload: payload,
      };

      setMessagesMap((previous) => ({
        ...previous,
        [activeConversationId]: [
          ...(previous[activeConversationId] || []),
          optimisticMessage,
        ],
      }));

      if (isOffline || !isBackendConnected) {
        await queuePayload(payload);
        return attachment;
      }

      const sent = await sendPayload(payload);
      if (!sent) {
        // A socket failure with the network still down means it is worth replaying later.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          await queuePayload(payload);
        }
        return attachment;
      }

      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === activeConversationId
            ? {
                ...conversation,
                lastMessage:
                  text ||
                  (attachment?.type === 'image'
                    ? 'Sent a photo'
                    : attachment?.type === 'video'
                      ? 'Sent a video'
                      : attachment?.type === 'audio'
                        ? 'Sent an audio file'
                        : 'Sent a document'),
                time: 'Just now',
              }
            : conversation
        )
      );

      return attachment;
    },
    [activeConversationId, currentUser, isBackendConnected, queuePayload, sendPayload]
  );

  const retryMessage = useCallback(
    async (message) => {
      if (!message.retryPayload || message.status === 'sending') return;
      markMessage(message.conversationId, message.clientId, {
        status: 'sending',
        error: undefined,
      });

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await queuePayload(message.retryPayload);
        return;
      }

      await sendPayload(message.retryPayload);
    },
    [markMessage, queuePayload, sendPayload]
  );

  /**
   * Replay the outbox from the page. The service worker does the same over Background
   * Sync when no tab is open; clientId keeps both paths idempotent.
   */
  const flushOutbox = useCallback(async () => {
    const queued = await getQueuedMessages();
    if (queued.length === 0) return;

    for (const entry of [...queued].sort((a, b) => a.createdAt - b.createdAt)) {
      try {
        const { messageId } = await sendMessageApi({
          clientId: entry.clientId,
          conversationId: entry.conversationId,
          text: entry.text,
          attachment: entry.attachment,
          replyTo: entry.replyTo,
        });
        await removeQueuedMessage(entry.clientId);
        markMessage(entry.conversationId, entry.clientId, {
          id: messageId || entry.clientId,
          status: 'sent',
          error: undefined,
        });
      } catch {
        // Still unreachable — leave the rest queued for the next attempt.
        break;
      }
    }

    notifyOutboxChanged();
  }, [markMessage, notifyOutboxChanged]);

  useEffect(() => {
    if (!currentUser) return undefined;

    const attemptFlush = () => {
      requestOutboxSync().catch(() => {});
      flushOutbox().catch(() => {});
    };

    if (isBackendConnected) attemptFlush();
    window.addEventListener('online', attemptFlush);
    return () => window.removeEventListener('online', attemptFlush);
  }, [currentUser, isBackendConnected, flushOutbox]);

  const startChatFromContact = useCallback(
    async (contact) => {
      if (!isBackendConnected) return false;
      try {
        const { conversation } = await startConversationApi(contact.id);
        const formatted = formatConversation(conversation, getEntityId(currentUser));
        if (!formatted) return false;
        setConversations((previous) => [
          formatted,
          ...previous.filter((item) => item.id !== formatted.id),
        ]);
        await selectConversation(formatted.id);
        return true;
      } catch (error) {
        console.error('Error starting conversation via API:', error);
        return false;
      }
    },
    [currentUser, isBackendConnected, selectConversation]
  );

  const deleteMessage = useCallback(
    async (message) => {
      if (!message?.id) return;

      const targetConvId = message.conversationId || activeConversationIdRef.current;

      setMessagesMap((previous) => ({
        ...previous,
        [targetConvId]: (previous[targetConvId] || []).map((m) =>
          m.id === message.id || (message.clientId && m.clientId === message.clientId)
            ? { ...m, isDeleted: true, text: '', attachment: undefined }
            : m
        ),
      }));

      const res = await emitDeleteMessage({
        messageId: message.id,
        clientId: message.clientId,
        conversationId: targetConvId,
      });

      if (!res?.ok) {
        try {
          await deleteMessageApi(message.id);
        } catch (err) {
          console.warn('REST delete message fallback notice:', err);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!currentUser || !isBackendConnected) return undefined;

    const unbindDeleted = onMessageDeleted(({ messageId, clientId, conversationId }) => {
      setMessagesMap((previous) => {
        const targetConvId =
          conversationId ||
          Object.keys(previous).find((key) =>
            (previous[key] || []).some(
              (m) =>
                m.id === messageId ||
                (clientId && m.clientId === clientId)
            )
          );

        if (!targetConvId) return previous;

        return {
          ...previous,
          [targetConvId]: (previous[targetConvId] || []).map((m) =>
            m.id === messageId || (clientId && m.clientId === clientId)
              ? { ...m, isDeleted: true, text: '', attachment: undefined }
              : m
          ),
        };
      });
    });

    return () => {
      unbindDeleted();
    };
  }, [currentUser, isBackendConnected]);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) || null;

  return {
    conversations,
    activeConversation,
    activeConversationId,
    setActiveConversationId,
    activeMessages: messagesMap[activeConversationId] || [],
    contacts,
    isInitialDataLoading,
    isContactsLoading,
    isMessagesLoading,
    typingMap,
    isContactTyping: Boolean(typingMap[activeConversationId]),
    sendTypingStart,
    sendTypingStop,
    loadContacts,
    selectConversation,
    sendMessage,
    retryMessage,
    deleteMessage,
    startChatFromContact,
  };
}
