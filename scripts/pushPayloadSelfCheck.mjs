/**
 * Self-check for normalizePushPayload in public/sw.js — the one place a backend
 * payload shape change silently turns every notification into "Wave / You have a
 * new message". Extracted from the worker source so there is no second copy to
 * drift. Run with: node scripts/pushPayloadSelfCheck.mjs
 */
import assert from 'assert';
import { readFileSync } from 'fs';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const start = source.indexOf('function normalizePushPayload');
assert.ok(start !== -1, 'normalizePushPayload not found in public/sw.js');
const end = source.indexOf('\nself.addEventListener(\'push\'', start);
assert.ok(end !== -1, 'could not find the end of normalizePushPayload');

const { normalizePushPayload, formatMessageCount, getNotificationDisplay } = new Function(
  `${source.slice(start, end)}; return { normalizePushPayload, formatMessageCount, getNotificationDisplay };`
)();

assert.strictEqual(formatMessageCount(1), '1 new message');
assert.strictEqual(formatMessageCount(2), '2 new messages');

// What the backend actually sends for a message, as FCM delivers it to the worker.
const message = normalizePushPayload({
  notification: { title: 'Asha', body: 'Sent a photo', icon: '/wave-192.png', tag: 'conversation-c1' },
  data: { conversationId: 'c1', messageId: 'm1', url: '/' },
  fcmMessageId: 'abc',
  from: '833615006163',
});
assert.strictEqual(message.title, 'Wave');
assert.strictEqual(message.body, '1 new message');
assert.strictEqual('badge' in message, false);
assert.strictEqual('icon' in message, false);
assert.strictEqual(message.tag, 'conversation-c1');
assert.strictEqual(message.conversationId, 'c1');
assert.strictEqual(message.kind, 'message');
assert.strictEqual(message.requireInteraction, false);
assert.deepStrictEqual(getNotificationDisplay(message, 2), {
  title: '2 new messages',
  body: undefined,
});

// A ringing call must keep the notification up and carry the callId through.
const call = normalizePushPayload({
  notification: { title: 'Asha', body: 'Incoming video call', tag: 'call-x1', requireInteraction: true },
  data: { kind: 'call', callId: 'x1', conversationId: 'c1', type: 'video', url: '/' },
});
assert.strictEqual(call.kind, 'call');
assert.strictEqual(call.callId, 'x1');
assert.strictEqual(call.body, 'Incoming video call');
assert.strictEqual(call.requireInteraction, true, 'a ringing call must require interaction');
assert.deepStrictEqual(getNotificationDisplay(call), {
  title: 'Asha',
  body: 'Incoming video call',
});

// FCM stringifies data values; a stringified boolean must still count as true.
assert.strictEqual(
  normalizePushPayload({ notification: { requireInteraction: 'true' } }).requireInteraction,
  true
);

// fcmOptions.link is the click target when data.url is absent.
assert.strictEqual(
  normalizePushPayload({ fcmOptions: { link: 'https://wave.app/?c=1' } }).url,
  'https://wave.app/?c=1'
);

// Message content stays private even for a bare legacy payload.
const bare = normalizePushPayload({ title: 'Wave', body: 'raw text' });
assert.strictEqual(bare.title, 'Wave');
assert.strictEqual(bare.body, '1 new message');
assert.strictEqual(bare.url, '/');

const empty = normalizePushPayload({});
assert.strictEqual(empty.title, 'Wave');
assert.strictEqual(empty.body, '1 new message');
assert.strictEqual(empty.tag, 'pingme-message');

console.log('✅ sw.js push payload self-check passed');
