import { io } from 'socket.io-client';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';

let socket = null;
let joinedConversationId = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socket.on('connect', () => {
      if (!joinedConversationId) return;
      socket.emit('join_conversation', joinedConversationId);
      if (document.visibilityState === 'visible') {
        socket.emit('messages_read', { conversationId: joinedConversationId });
      }
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket() {
  joinedConversationId = null;
  socket?.disconnect();
}

export function reconnectSocket() {
  const s = getSocket();
  if (s.connected) s.disconnect();
  s.connect();
}

export function joinConversationRoom(conversationId) {
  const s = getSocket();
  joinedConversationId = conversationId || null;
  if (s.connected) {
    s.emit('join_conversation', conversationId);
  }
}

export function emitMessageDelivered(messageId) {
  const s = getSocket();
  if (s.connected && messageId) s.emit('message_delivered', { messageId });
}

export function emitConversationRead(conversationId) {
  const s = getSocket();
  if (s.connected && conversationId) s.emit('messages_read', { conversationId });
}

export function onMessageStatusChanged(callback) {
  return subscribeToSocketEvent('message_status', callback);
}

export function emitSendMessage(data) {
  const s = getSocket();
  if (!s.connected) return Promise.resolve({ ok: false, error: 'You are offline' });

  return new Promise((resolve) => {
    s.timeout(10000).emit('send_message', data, (error, response) => {
      if (error) {
        resolve({ ok: false, error: 'Message delivery timed out' });
        return;
      }
      resolve(response || { ok: false, error: 'Message service did not respond' });
    });
  });
}

export function onReceiveMessage(callback) {
  const s = getSocket();
  s.on('receive_message', callback);
  return () => {
    s.off('receive_message', callback);
  };
}

export function emitTypingStart(conversationId) {
  const s = getSocket();
  if (s.connected && conversationId) {
    s.emit('typing_start', { conversationId });
  }
}

export function emitTypingStop(conversationId) {
  const s = getSocket();
  if (s.connected && conversationId) {
    s.emit('typing_stop', { conversationId });
  }
}

export function onUserTyping(callback) {
  const s = getSocket();
  s.on('user_typing', callback);
  return () => {
    s.off('user_typing', callback);
  };
}

export function onUserStopTyping(callback) {
  const s = getSocket();
  s.on('user_stop_typing', callback);
  return () => {
    s.off('user_stop_typing', callback);
  };
}

export function emitDeleteMessage(data) {
  const s = getSocket();
  if (!s.connected) return Promise.resolve({ ok: false, error: 'You are offline' });

  return new Promise((resolve) => {
    s.timeout(10000).emit('delete_message', data, (error, response) => {
      if (error) {
        resolve({ ok: false, error: 'Message deletion timed out' });
        return;
      }
      resolve(response || { ok: false, error: 'Service did not respond' });
    });
  });
}

export function onMessageDeleted(callback) {
  const s = getSocket();
  s.on('message_deleted', callback);
  return () => {
    s.off('message_deleted', callback);
  };
}

export function onPresenceChange(callback) {
  const s = getSocket();
  s.on('presence_change', callback);
  return () => {
    s.off('presence_change', callback);
  };
}

export function requestPresenceSync() {
  const s = getSocket();
  if (s.connected) s.emit('presence_sync');
}

function emitCallEvent(eventName, payload) {
  const s = getSocket();
  if (!s.connected) {
    return Promise.resolve({ ok: false, error: 'Calling service is disconnected' });
  }

  return new Promise((resolve) => {
    s.timeout(10000).emit(eventName, payload, (error, response) => {
      if (error) {
        resolve({ ok: false, error: 'Calling service timed out' });
        return;
      }
      resolve(response || { ok: false, error: 'Calling service did not respond' });
    });
  });
}

export function inviteCall(conversationId, type) {
  return emitCallEvent('call_invite', { conversationId, type });
}

export function acceptCall(callId) {
  return emitCallEvent('call_accept', { callId });
}

export function declineCall(callId) {
  return emitCallEvent('call_decline', { callId });
}

export function endCall(callId) {
  return emitCallEvent('call_end', { callId });
}

function subscribeToSocketEvent(eventName, callback) {
  const s = getSocket();
  s.on(eventName, callback);
  return () => s.off(eventName, callback);
}

export function onIncomingCall(callback) {
  return subscribeToSocketEvent('incoming_call', callback);
}

export function onCallAccepted(callback) {
  return subscribeToSocketEvent('call_accepted', callback);
}

export function onCallDeclined(callback) {
  return subscribeToSocketEvent('call_declined', callback);
}

export function onCallEnded(callback) {
  return subscribeToSocketEvent('call_ended', callback);
}
