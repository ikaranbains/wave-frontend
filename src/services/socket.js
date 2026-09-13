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
      // The server suppresses web push only for a visible client, so it needs this
      // on every connect — a reconnect after the app was backgrounded starts fresh.
      reportVisibility();
      if (!joinedConversationId) return;
      socket.emit('join_conversation', joinedConversationId);
      if (document.visibilityState === 'visible') {
        socket.emit('messages_read', { conversationId: joinedConversationId });
      }
    });

    // Registered once for the lifetime of the socket, so no caller has to wire it up.
    document.addEventListener('visibilitychange', reportVisibility);
  }
  return socket;
}

/**
 * Tell the server whether the app is on screen. A backgrounded PWA keeps its socket
 * open, so without this the server reads it as "user is looking" and sends no push.
 */
function reportVisibility() {
  if (!socket?.connected) return;
  socket.emit('app_visibility', { isVisible: document.visibilityState === 'visible' });
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
  }
}

// HTTP authentication and the realtime connection have separate lifecycles.
// Consumers that depend on live events (calls, typing, presence) must use the
// actual Socket.IO state rather than assuming a successful API request means
// the socket has already connected.
export function onSocketConnectionChange(callback) {
  const s = getSocket();
  const handleConnect = () => callback(true);
  const handleDisconnect = () => callback(false);
  const handleConnectError = () => callback(false);

  s.on('connect', handleConnect);
  s.on('disconnect', handleDisconnect);
  s.on('connect_error', handleConnectError);
  callback(s.connected);

  return () => {
    s.off('connect', handleConnect);
    s.off('disconnect', handleDisconnect);
    s.off('connect_error', handleConnectError);
  };
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

// Ask for an invite that began while this PWA was suspended or loading. The
// request is sent after the UI listener has mounted, avoiding a lost event on
// a fast reconnect.
export function syncPendingCall() {
  const s = getSocket();
  const sync = () => s.emit('call_sync');
  s.on('connect', sync);
  if (s.connected) sync();
  return () => s.off('connect', sync);
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

export function emitWebRTCSignal(payload) {
  const s = getSocket();
  if (s.connected) {
    s.emit('webrtc_signal', payload);
  }
}

export function onWebRTCSignal(callback) {
  return subscribeToSocketEvent('webrtc_signal', callback);
}
