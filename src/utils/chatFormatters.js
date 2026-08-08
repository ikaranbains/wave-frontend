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
    time: new Date(message.createdAt || Date.now()).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    isSentByMe: getEntityId(message.senderId) === currentUserId,
    status: message.status || 'sent',
    attachment: message.attachment?.url ? message.attachment : undefined,
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
