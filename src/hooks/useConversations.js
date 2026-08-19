'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteMessageApi,
  getConversationsApi,
  getMessagesApi,
  getUsersApi,
  sendMessagesBatchApi,
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
  getConversationSnapshot,
  saveConversationSnapshot,
} from '../services/offlineCache';
import {
  emitConversationRead,
  emitDeleteMessage,
  emitMessageDelivered,
  emitSendMessage,
  emitTypingStart,
  emitTypingStop,
  joinConversationRoom,
  onMessageDeleted,
  onMessageStatusChanged,
  onReceiveMessage,
  onPresenceChange,
  onUserTyping,
  onUserStopTyping,
  requestPresenceSync,
} from '../services/socket';
import {
  describeCallEvent,
  formatContact,
  formatConversation,
  formatMessage,
  getEntityId,
} from '../utils/chatFormatters';
import {
  MESSAGE_PAGE_SIZE,
  getOlderCursor,
  prependOlderMessages,
} from '../utils/messagePagination';
import { playMessageSound, primeNotificationSound } from '../utils/notificationSound';

const MESSAGE_STATUS_PRIORITY = {
  sending: 0,
  queued: 0,
  failed: 0,
  error: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

function mergeMessageChanges(message, changes) {
  if (
    changes.status &&
    (MESSAGE_STATUS_PRIORITY[message.status] || 0) >
      (MESSAGE_STATUS_PRIORITY[changes.status] || 0)
  ) {
    return { ...message, ...changes, status: message.status };
  }
  return { ...message, ...changes };
}

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

function mergeMessages(existing, incoming) {
  let merged = [...existing];
  incoming.forEach((message) => {
    merged = upsertMessage(merged, message);
  });
  return merged.sort(
    (left, right) => Date.parse(left.createdAt || 0) - Date.parse(right.createdAt || 0)
  );
}

export function useConversations({ currentUser, isBackendConnected }) {
  const cacheUserId = getEntityId(currentUser);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messagesMap, setMessagesMap] = useState({});
  const [contacts, setContacts] = useState([]);
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(Boolean(currentUser));
  const [isContactsLoading, setIsContactsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  // { [conversationId]: { hasMore, before, beforeId } } — where the next older page starts.
  const [paginationMap, setPaginationMap] = useState({});
  const contactsAbortRef = useRef(null);
  const messagesAbortRef = useRef(null);
  const activeConversationIdRef = useRef(activeConversationId);
  const currentUserRef = useRef(currentUser);
  const messagesMapRef = useRef(messagesMap);
  const cacheReadyUserIdRef = useRef('');

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    messagesMapRef.current = messagesMap;
  }, [messagesMap]);

  const resetConversationState = useCallback(() => {
    contactsAbortRef.current?.abort();
    messagesAbortRef.current?.abort();
    activeConversationIdRef.current = null;
    messagesMapRef.current = {};
    setContacts([]);
    setConversations([]);
    setActiveConversationId(null);
    setMessagesMap({});
    setPaginationMap({});
  }, []);

  useEffect(() => {
    if (!cacheUserId) {
      cacheReadyUserIdRef.current = '';
      queueMicrotask(() => {
        if (currentUserRef.current) return;
        resetConversationState();
        setIsInitialDataLoading(false);
      });
      return undefined;
    }

    let active = true;
    const controller = new AbortController();

    const loadInitialData = async () => {
      let cacheWasReady = cacheReadyUserIdRef.current === cacheUserId;

      if (!cacheWasReady) {
        resetConversationState();
        setIsInitialDataLoading(true);
        const cached = await getConversationSnapshot(cacheUserId);
        if (!active) return;

        if (cached) {
          const cachedConversations = cached.conversations || [];
          const cachedMessagesMap = cached.messagesMap || {};
          const restoredConversationId = cachedConversations.some(
            (conversation) => conversation.id === cached.activeConversationId
          )
            ? cached.activeConversationId
            : null;
          activeConversationIdRef.current = restoredConversationId;
          messagesMapRef.current = cachedMessagesMap;
          setConversations(cachedConversations);
          setMessagesMap(cachedMessagesMap);
          setActiveConversationId(restoredConversationId);
          cacheWasReady = true;
        }

        cacheReadyUserIdRef.current = cacheUserId;
      }

      if (cacheWasReady) setIsInitialDataLoading(false);
      if (!isBackendConnected) {
        setIsInitialDataLoading(false);
        return;
      }

      if (!cacheWasReady) setIsInitialDataLoading(true);

      try {
        const [{ users }, { conversations: liveConversations }] = await Promise.all([
          getUsersApi('', controller.signal),
          getConversationsApi(controller.signal),
        ]);
        if (!active) return;

        setContacts(
          (users || [])
            .filter((candidate) => getEntityId(candidate) !== cacheUserId)
            .map(formatContact)
        );
        const formattedConversations = (liveConversations || [])
          .map((conversation) => formatConversation(conversation, cacheUserId))
          .filter(Boolean);
        const visibleActiveId =
          document.visibilityState === 'visible' ? activeConversationIdRef.current : null;

        setConversations(
          formattedConversations.map((conversation) =>
            conversation.id === visibleActiveId
              ? { ...conversation, unreadCount: 0 }
              : conversation
          )
        );
        if (visibleActiveId) emitConversationRead(visibleActiveId);

        // Refresh the restored thread and every unread thread immediately. This
        // makes a pushed message ready before the user opens its conversation.
        const conversationsToRefresh = new Set(
          formattedConversations
            .filter((conversation) => conversation.unreadCount > 0)
            .map((conversation) => conversation.id)
        );
        if (activeConversationIdRef.current) {
          conversationsToRefresh.add(activeConversationIdRef.current);
        }

        const refreshedPages = await Promise.allSettled(
          [...conversationsToRefresh].map(async (conversationId) => {
            const { messages, hasMore } = await getMessagesApi(
              conversationId,
              controller.signal,
              { limit: MESSAGE_PAGE_SIZE }
            );
            return { conversationId, raw: messages || [], hasMore };
          })
        );
        if (!active) return;

        const loadedPages = refreshedPages
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value);
        if (loadedPages.length > 0) {
          setMessagesMap((previous) => {
            const next = { ...previous };
            loadedPages.forEach(({ conversationId, raw }) => {
              const formatted = raw.map((message) => formatMessage(message, cacheUserId));
              next[conversationId] = mergeMessages(next[conversationId] || [], formatted);
            });
            return next;
          });
          setPaginationMap((previous) => {
            const next = { ...previous };
            loadedPages.forEach(({ conversationId, raw, hasMore }) => {
              next[conversationId] = {
                hasMore: Boolean(hasMore),
                ...(getOlderCursor(raw) || {}),
              };
            });
            return next;
          });
        }
      } catch (error) {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
          console.error('Unable to load initial chat data:', error);
        }
      } finally {
        if (active) setIsInitialDataLoading(false);
      }
    };

    loadInitialData();

    return () => {
      active = false;
      controller.abort();
    };
  }, [cacheUserId, isBackendConnected, resetConversationState]);

  useEffect(() => {
    if (!cacheUserId || cacheReadyUserIdRef.current !== cacheUserId) return undefined;

    const timeoutId = window.setTimeout(() => {
      saveConversationSnapshot({
        userId: cacheUserId,
        conversations,
        messagesMap,
        activeConversationId,
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [activeConversationId, cacheUserId, conversations, messagesMap]);

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
      activeConversationIdRef.current = conversationId;
      setActiveConversationId(conversationId);
      setIsMessagesLoading(
        isBackendConnected && !messagesMapRef.current[conversationId]?.length
      );

      setConversations((previous) =>
        previous.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
      );

      if (!isBackendConnected) return;

      const controller = new AbortController();
      messagesAbortRef.current = controller;

      try {
        const { messages, hasMore } = await getMessagesApi(conversationId, controller.signal, {
          limit: MESSAGE_PAGE_SIZE,
        });
        const raw = messages || [];
        const formatted = raw.map((message) => formatMessage(message, getEntityId(currentUser)));
        setMessagesMap((previous) => ({
          ...previous,
          [conversationId]: mergeMessages(previous[conversationId] || [], formatted),
        }));
        setPaginationMap((previous) => ({
          ...previous,
          [conversationId]: { hasMore: Boolean(hasMore), ...(getOlderCursor(raw) || {}) },
        }));
      } catch (error) {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
          console.error('Error loading conversation messages:', error);
        }
      } finally {
        if (messagesAbortRef.current === controller) setIsMessagesLoading(false);
      }
    },
    [currentUser, isBackendConnected]
  );

  /**
   * Prepend the next older page. Guarded against re-entry so a double click cannot
   * fetch the same page twice, and deduped by id so a socket message that arrived
   * mid-flight is never rendered twice.
   */
  const loadOlderMessages = useCallback(
    async (conversationId) => {
      const cursor = paginationMap[conversationId];
      if (!conversationId || !cursor?.hasMore || !cursor.before) return;
      if (isLoadingOlderMessages) return;

      setIsLoadingOlderMessages(true);
      try {
        const { messages, hasMore } = await getMessagesApi(conversationId, undefined, {
          limit: MESSAGE_PAGE_SIZE,
          before: cursor.before,
          beforeId: cursor.beforeId,
        });
        const raw = messages || [];
        const older = raw.map((message) => formatMessage(message, getEntityId(currentUser)));

        setMessagesMap((previous) => ({
          ...previous,
          [conversationId]: prependOlderMessages(previous[conversationId], older),
        }));
        setPaginationMap((previous) => ({
          ...previous,
          [conversationId]: {
            hasMore: Boolean(hasMore),
            ...(getOlderCursor(raw) || { before: cursor.before, beforeId: cursor.beforeId }),
          },
        }));
      } catch (error) {
        console.error('Error loading older messages:', error);
      } finally {
        setIsLoadingOlderMessages(false);
      }
    },
    [currentUser, isLoadingOlderMessages, paginationMap]
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
      const isReading =
        activeConversationIdRef.current === convId && document.visibilityState === 'visible';

      if (!formatted.isSentByMe && !formatted.callEvent) {
        if (isReading) emitConversationRead(convId);
        else emitMessageDelivered(formatted.id);
      }

      setTypingMap((prev) => ({ ...prev, [convId]: false }));

      // Chime for messages from the other person only, and only if they have
      // not switched sound off. Own messages echo back over the socket too.
      if (
        !formatted.isSentByMe &&
        !formatted.callEvent &&
        currentUserRef.current?.preferences?.soundEnabled !== false
      ) {
        playMessageSound();
      }

      setMessagesMap((previous) => ({
        ...previous,
        [convId]: upsertMessage(previous[convId] || [], formatted),
      }));

      let lastMsgText = formatted.text;
      if (!lastMsgText && formatted.callEvent) {
        lastMsgText = describeCallEvent(
          formatted.callEvent,
          formatted.isSentByMe
        ).label;
      }
      if (!lastMsgText && incomingMessage.attachment) {
        const type = incomingMessage.attachment.type;
        if (type === 'image') lastMsgText = 'Sent a photo';
        else if (type === 'video') lastMsgText = 'Sent a video';
        else if (type === 'audio') lastMsgText = 'Sent an audio file';
        else lastMsgText = 'Sent a document';
      }

      setConversations((previous) => {
        const existingIndex = previous.findIndex((c) => c.id === convId);
        if (existingIndex !== -1) {
          const existing = previous[existingIndex];
          const updated = {
            ...existing,
            lastMessage: lastMsgText || 'New message',
            time: formatted.time || 'Just now',
            unreadCount:
              isReading
                ? 0
                : !formatted.isSentByMe
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

  useEffect(() => {
    if (!currentUser || !isBackendConnected || !activeConversationId) return undefined;

    const markActiveConversationRead = () => {
      if (document.visibilityState !== 'visible') return;
      emitConversationRead(activeConversationId);
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === activeConversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation
        )
      );
    };

    markActiveConversationRead();
    document.addEventListener('visibilitychange', markActiveConversationRead);
    return () => document.removeEventListener('visibilitychange', markActiveConversationRead);
  }, [activeConversationId, currentUser, isBackendConnected]);

  useEffect(() => {
    if (!currentUser || !isBackendConnected) return undefined;

    return onMessageStatusChanged(({ conversationId, messageIds = [], status }) => {
      if (!MESSAGE_STATUS_PRIORITY[status]) return;
      const ids = new Set(messageIds.map(String));
      setMessagesMap((previous) => ({
        ...previous,
        [conversationId]: (previous[conversationId] || []).map((message) =>
          ids.has(String(message.id)) ? mergeMessageChanges(message, { status }) : message
        ),
      }));
    });
  }, [currentUser, isBackendConnected]);

  useEffect(() => {
    if (!currentUser || !isBackendConnected) return undefined;

    const unbindPresence = onPresenceChange(({ userId, status, lastSeen }) => {
      if (!userId) return;
      const normalizedUserId = String(userId);
      const isOnline = status === 'online';

      setConversations((previous) =>
        previous.map((conversation) =>
          String(conversation.contact?.id) === normalizedUserId
            ? {
                ...conversation,
                isOnline,
                contact: {
                  ...conversation.contact,
                  status,
                  lastSeen,
                },
              }
            : conversation
        )
      );

      setContacts((previous) =>
        previous.map((contact) =>
          String(contact.id) === normalizedUserId
            ? { ...contact, status, lastSeen }
            : contact
        )
      );
    });

    // The initial connection event may have fired before this hook mounted.
    // Ask the server for the current user's presence after subscribing.
    requestPresenceSync();
    return unbindPresence;
  }, [currentUser, isBackendConnected]);

  const markMessage = useCallback((conversationId, clientId, changes) => {
    setMessagesMap((previous) => ({
      ...previous,
      [conversationId]: (previous[conversationId] || []).map((message) =>
        message.clientId === clientId ? mergeMessageChanges(message, changes) : message
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
        createdAt: new Date().toISOString(),
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

    const sorted = [...queued].sort((a, b) => a.createdAt - b.createdAt);
    const batches = [];
    for (let index = 0; index < sorted.length; index += 10) {
      batches.push(sorted.slice(index, index + 10));
    }

    const requests = await Promise.allSettled(
      batches.map((batch) =>
        sendMessagesBatchApi(
          batch.map((entry) => ({
            clientId: entry.clientId,
            conversationId: entry.conversationId,
            text: entry.text,
            attachment: entry.attachment,
            replyTo: entry.replyTo,
          }))
        )
      )
    );

    const queuedByClientId = new Map(sorted.map((entry) => [entry.clientId, entry]));
    await Promise.allSettled(
      requests.flatMap((request) => {
        if (request.status === 'rejected') return [];
        return (request.value.results || []).map(async (result) => {
          const entry = queuedByClientId.get(result.clientId);
          if (!entry || (!result.ok && (result.status === 401 || result.status >= 500))) return;

          await removeQueuedMessage(entry.clientId);
          markMessage(
            entry.conversationId,
            entry.clientId,
            result.ok
              ? { id: result.messageId || entry.clientId, status: 'sent', error: undefined }
              : { status: 'error', error: result.error || 'Message could not be sent' }
          );
        });
      })
    );

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
    isLoadingOlderMessages,
    hasMoreMessages: Boolean(paginationMap[activeConversationId]?.hasMore),
    loadOlderMessages,
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
