import assert from 'node:assert/strict';
import {
  formatMessageDateLabel,
  getMessageDateKey,
  groupMessagesByDate,
} from '../src/utils/messageDateGroups.mjs';

const now = new Date(2026, 7, 18, 12);
assert.equal(formatMessageDateLabel(new Date(2026, 7, 18, 1), now), 'Today');
assert.equal(formatMessageDateLabel(new Date(2026, 7, 17, 23), now), 'Yesterday');
assert.equal(getMessageDateKey(new Date(2026, 7, 18, 1)), '2026-7-18');
assert.equal(formatMessageDateLabel('invalid', now), 'Earlier');

const groups = groupMessagesByDate([
  { id: 'older', createdAt: new Date(2026, 7, 17, 23) },
  { id: 'earlier-today', createdAt: new Date(2026, 7, 18, 1) },
  { id: 'later-today', createdAt: new Date(2026, 7, 18, 11) },
]);
assert.equal(groups.length, 2);
assert.deepEqual(groups.map((group) => group.messages.map((message) => message.id)), [
  ['older'],
  ['earlier-today', 'later-today'],
]);

console.log('Message date grouping self-check passed.');
