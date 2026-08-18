import assert from 'node:assert/strict';
import {
  formatMessageDateLabel,
  getMessageDateKey,
} from '../src/utils/messageDateGroups.mjs';

const now = new Date(2026, 7, 18, 12);
assert.equal(formatMessageDateLabel(new Date(2026, 7, 18, 1), now), 'Today');
assert.equal(formatMessageDateLabel(new Date(2026, 7, 17, 23), now), 'Yesterday');
assert.equal(getMessageDateKey(new Date(2026, 7, 18, 1)), '2026-7-18');
assert.equal(formatMessageDateLabel('invalid', now), 'Earlier');

console.log('Message date grouping self-check passed.');
