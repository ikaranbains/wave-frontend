export function getMessageDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function groupMessagesByDate(messages) {
  return messages.reduce((groups, message) => {
    const key = getMessageDateKey(message.createdAt);
    const currentGroup = groups.at(-1);

    if (currentGroup?.key === key) {
      currentGroup.messages.push(message);
    } else {
      groups.push({ key, messages: [message] });
    }

    return groups;
  }, []);
}

export function formatMessageDateLabel(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Earlier';

  const todayKey = getMessageDateKey(now);
  if (getMessageDateKey(date) === todayKey) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (getMessageDateKey(date) === getMessageDateKey(yesterday)) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}
