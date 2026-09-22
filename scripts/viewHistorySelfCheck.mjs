import assert from 'node:assert/strict';
import { createViewHistory, HOME_VIEW } from '../src/utils/viewHistory.mjs';

// Traversal is asynchronous, unlike pushState/replaceState.
function createBrowser(path = '/') {
  const browser = new EventTarget();
  let entries = [{ state: { __NA: true, tree: 'next-router' }, url: new URL(path, 'https://wave.test') }];
  let index = 0;
  Object.defineProperty(browser, 'location', { get: () => entries[index].url });
  const go = (delta) => queueMicrotask(() => {
    if (!entries[index + delta]) return;
    index += delta;
    const event = new Event('popstate');
    event.state = entries[index].state;
    browser.dispatchEvent(event);
  });
  browser.history = {
    get state() { return entries[index].state; },
    get length() { return entries.length; },
    pushState(state, _, url = browser.location) {
      entries = entries.slice(0, index + 1);
      entries.push({ state: structuredClone(state), url: new URL(url, browser.location) });
      index++;
    },
    replaceState(state, _, url = browser.location) {
      entries[index] = { state: structuredClone(state), url: new URL(url, browser.location) };
    },
    back: () => go(-1),
    forward: () => go(1),
  };
  return browser;
}

function mount(browser) {
  const history = createViewHistory(browser);
  const unsubscribe = history.subscribe(() => {});
  return { ...history, unsubscribe };
}

const browser = createBrowser();
let app = mount(browser);
assert.equal(browser.history.length, 1);
app.navigate({ conversationId: 'first-chat' });
assert.equal(browser.history.length, 2, 'first chat immediately has a Back target');
assert.equal(browser.history.state.__NA, true, 'preserve Next router state');
browser.history.back();
await Promise.resolve();
assert.deepEqual(app.getSnapshot(), HOME_VIEW);
assert.equal(browser.history.length, 2, 'popstate does not push another entry');
browser.history.forward();
await Promise.resolve();
assert.equal(app.getSnapshot().conversationId, 'first-chat');
app.back();
await Promise.resolve();
app.navigate({ conversationId: 'second-chat' });
app.back();
await Promise.resolve();
assert.deepEqual(app.getSnapshot(), HOME_VIEW, 'UI Back then another chat');

app.navigate({ tab: 'contacts' });
app.navigate({ tab: 'messages', conversationId: 'contact-chat' });
app.back();
await Promise.resolve();
assert.equal(app.getSnapshot().tab, 'contacts');
app.navigate({ tab: 'calls' });
app.navigate({ tab: 'settings' });
app.navigate({ settingsSection: 'appearance' });
const length = browser.history.length;
app.navigate({ settingsSection: 'appearance' });
assert.equal(browser.history.length, length, 'same screen does not duplicate entries');
app.back();
await Promise.resolve();
assert.equal(app.getSnapshot().settingsSection, null);
app.back();
await Promise.resolve();
assert.equal(app.getSnapshot().tab, 'calls');

app.navigate({ search: true });
app.back();
await Promise.resolve();
assert.equal(app.getSnapshot().search, false);
app.navigate({ search: true });
app.navigate({ tab: 'messages', conversationId: 'result', search: false }, { replace: true });
app.back();
await Promise.resolve();
assert.equal(app.getSnapshot().tab, 'calls', 'search result returns to originating screen');

app.navigate({ tab: 'settings', settingsSection: 'privacy' });
app.unsubscribe();
const beforeReload = browser.history.length;
app = mount(browser);
assert.equal(app.getSnapshot().settingsSection, 'privacy', 'reload restores actual view');
assert.equal(browser.history.length, beforeReload, 'reload does not add another home entry');
app.unsubscribe();
app = mount(browser);
assert.equal(browser.history.length, beforeReload, 'Strict Mode remount is idempotent');

for (const path of ['/?conversation=notification', '/?tab=contacts', '/?tab=settings&section=profile']) {
  const coldBrowser = createBrowser(path);
  const coldApp = mount(coldBrowser);
  assert.ok(coldBrowser.history.length > 1, 'cold deep links have a home underneath');
  if (path.includes('section=')) {
    coldApp.back();
    await Promise.resolve();
    assert.equal(coldApp.getSnapshot().tab, 'settings');
    assert.equal(coldApp.getSnapshot().settingsSection, null);
  }
  coldBrowser.history.back();
  await Promise.resolve();
  assert.deepEqual(coldApp.getSnapshot(), HOME_VIEW);
  coldApp.unsubscribe();
}

// Fullscreen calls retain the screen below them; first Back minimizes.
const beforeCall = app.getSnapshot();
browser.history.pushState({ ...browser.history.state, waveCallFullscreen: true }, '');
browser.history.back();
await Promise.resolve();
assert.deepEqual(app.getSnapshot(), beforeCall);
app.unsubscribe();
console.log('View history checks passed: first visit, Back/Forward, tabs, settings, search, reload, cold PWA links, calls.');
