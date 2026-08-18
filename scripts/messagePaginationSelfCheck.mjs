/**
 * Self-check for the pure pagination helpers in utils/messagePagination.
 *
 * Both fail silently: a cursor built from the wrong id field makes "load older" refetch
 * the same page forever, and a missing dedupe renders a message twice with a duplicate
 * React key. Run with: node scripts/messagePaginationSelfCheck.mjs
 */
import assert from 'assert';
import { getOlderCursor, prependOlderMessages } from '../src/utils/messagePagination.js';

// The server returns lean documents, so the cursor id comes from `_id`, not `id`.
const page = [
  { _id: 'm10', createdAt: '2026-01-01T00:00:10.000Z' },
  { _id: 'm11', createdAt: '2026-01-01T00:00:11.000Z' },
];
assert.deepStrictEqual(getOlderCursor(page), {
  before: '2026-01-01T00:00:10.000Z',
  beforeId: 'm10',
}, 'cursor must come from the OLDEST message in the page');

// A formatted message exposes `id` instead; both shapes must work.
assert.deepStrictEqual(
  getOlderCursor([{ id: 'm5', createdAt: '2026-01-01T00:00:05.000Z' }]),
  { before: '2026-01-01T00:00:05.000Z', beforeId: 'm5' }
);

// An empty page yields no cursor, which is what stops the loop.
assert.strictEqual(getOlderCursor([]), null);
assert.strictEqual(getOlderCursor(undefined), null);

// Older messages go in front, in order.
assert.deepStrictEqual(
  prependOlderMessages([{ id: 'c' }], [{ id: 'a' }, { id: 'b' }]).map((m) => m.id),
  ['a', 'b', 'c']
);

// A message already rendered must not be duplicated by the prepend.
assert.deepStrictEqual(
  prependOlderMessages([{ id: 'b' }, { id: 'c' }], [{ id: 'a' }, { id: 'b' }]).map((m) => m.id),
  ['a', 'b', 'c']
);

assert.deepStrictEqual(prependOlderMessages(undefined, [{ id: 'a' }]).map((m) => m.id), ['a']);
assert.deepStrictEqual(prependOlderMessages([{ id: 'a' }], undefined).map((m) => m.id), ['a']);

console.log('✅ frontend pagination self-check passed');
