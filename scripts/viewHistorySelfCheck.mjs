import assert from 'assert';
import { readFileSync } from 'fs';

const source = readFileSync(new URL('../src/app/page.jsx', import.meta.url), 'utf8');
const start = source.indexOf('const HOME_VIEW');
const end = source.indexOf('\nfunction saveView', start);
assert.ok(start !== -1 && end !== -1, 'view history helpers not found in page.jsx');

const { HOME_VIEW, getView, isSameView, shouldBridgeThroughHome, needsHomeBackTarget } = new Function(
  `${source.slice(start, end)}; return { HOME_VIEW, getView, isSameView, shouldBridgeThroughHome, needsHomeBackTarget };`
)();

const settings = getView('settings', null, null);
const profile = getView('settings', null, 'profile');

assert.equal(isSameView(settings, profile), false);
assert.equal(shouldBridgeThroughHome(settings, profile), false);
assert.equal(shouldBridgeThroughHome(profile, settings), false);
assert.equal(shouldBridgeThroughHome(getView('contacts'), profile), true);
assert.deepEqual(getView('messages', 'c1', 'profile'), {
  tab: 'messages',
  conversationId: 'c1',
  settingsSection: null,
});
assert.equal(isSameView(HOME_VIEW, getView('messages', null)), true);
assert.equal(needsHomeBackTarget(getView('messages', 'c1'), 1), true);
assert.equal(needsHomeBackTarget(getView('messages', 'c1'), 2), false);
assert.equal(needsHomeBackTarget(HOME_VIEW, 1), false);

console.log('✅ view history self-check passed');
