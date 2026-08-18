export const MESSAGE_PAGE_SIZE = 50;

/**
 * Cursor for the next older page, taken from the oldest message in this page. Reads
 * the raw server document's `_id` as well as a formatted message's `id`, so it works
 * on either shape.
 */
export function getOlderCursor(rawMessages) {
  const oldest = rawMessages?.[0];
  if (!oldest) return null;
  return { before: oldest.createdAt, beforeId: oldest._id || oldest.id };
}

/**
 * Prepend an older page, dropping anything already rendered. Without the dedupe a
 * socket message that landed mid-fetch would appear twice, and React would warn on
 * the duplicate key.
 */
export function prependOlderMessages(existing = [], older = []) {
  const known = new Set(existing.map((message) => message.id));
  return [...older.filter((message) => !known.has(message.id)), ...existing];
}
