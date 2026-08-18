export function getEntityId(entity) {
  return String(entity?._id || entity?.id || entity || '');
}

export function formatConversation(conversation, currentUserId) {
  const otherUser = conversation.participants?.find(
    (participant) => getEntityId(participant) !== currentUserId
  );

  if (!otherUser) return null;

  return {
    id: getEntityId(conversation),
    contact: formatContact(otherUser),
    lastMessage: conversation.lastMessage || 'No messages yet',
    time: conversation.updatedAt
      ? new Date(conversation.updatedAt).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
        })
      : '',
    unreadCount: Number(conversation.unreadCounts?.[currentUserId] || 0),
    isOnline: otherUser.status === 'online',
  };
}

export function formatMessage(message, currentUserId) {
  const createdAt = message.createdAt || new Date().toISOString();
  const replyTo =
    message.replyTo &&
    (message.replyTo.id || message.replyTo.senderName || message.replyTo.text || message.replyTo.attachmentUrl)
      ? {
          id: String(message.replyTo.id || ''),
          senderName: String(message.replyTo.senderName || 'Replied message'),
          text: String(message.replyTo.text || ''),
          attachmentType: message.replyTo.attachmentType,
          attachmentName: message.replyTo.attachmentName,
          attachmentUrl: message.replyTo.attachmentUrl,
        }
      : undefined;

  return {
    id: getEntityId(message),
    clientId: message.clientId,
    conversationId: getEntityId(message.conversationId),
    senderId: getEntityId(message.senderId),
    text: message.text,
    createdAt,
    time: new Date(createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    isSentByMe: getEntityId(message.senderId) === currentUserId,
    status: message.status || 'sent',
    attachment: message.attachment?.url ? message.attachment : undefined,
    callEvent: message.callEvent?.outcome ? message.callEvent : undefined,
    replyTo,
    isDeleted: Boolean(message.isDeleted),
  };
}

export function formatContact(user) {
  return {
    id: getEntityId(user),
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    phone: user.phone,
    status: user.status || 'offline',
    lastSeen: user.lastSeen,
  };
}

export function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Offline';

  const date = new Date(lastSeen);
  if (isNaN(date.getTime())) return 'Offline';

  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeString = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (startOfTarget.getTime() === startOfToday.getTime()) {
    return `Last seen today at ${timeString}`;
  }

  if (startOfTarget.getTime() === startOfYesterday.getTime()) {
    return `Last seen yesterday at ${timeString}`;
  }

  if (date.getFullYear() === now.getFullYear()) {
    const monthDay = date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
    return `Last seen ${monthDay} at ${timeString}`;
  }

  const fullDate = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `Last seen ${fullDate} at ${timeString}`;
}

function formatCallDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (value) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/**
 * Wording for a call entry in the thread. Phrased from the reader's side: the
 * person who was called sees "Missed", the caller sees "No answer".
 */
export function describeCallEvent(callEvent, isOutgoing) {
  const kind = callEvent?.type === 'video' ? 'Video call' : 'Voice call';

  switch (callEvent?.outcome) {
    case 'completed':
      return {
        label: isOutgoing ? `Outgoing ${kind.toLowerCase()}` : `Incoming ${kind.toLowerCase()}`,
        detail: formatCallDuration(callEvent.durationSeconds),
        missed: false,
      };
    case 'missed':
      return {
        label: isOutgoing ? `${kind} · no answer` : `Missed ${kind.toLowerCase()}`,
        detail: '',
        missed: true,
      };
    case 'declined':
      return {
        label: isOutgoing ? `${kind} declined` : `You declined a ${kind.toLowerCase()}`,
        detail: '',
        missed: true,
      };
    default:
      return {
        label: isOutgoing ? `You cancelled a ${kind.toLowerCase()}` : `Missed ${kind.toLowerCase()}`,
        detail: '',
        missed: true,
      };
  }
}
