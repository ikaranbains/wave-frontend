export const HOME_VIEW = Object.freeze({
  tab: 'messages', conversationId: null, settingsSection: null, search: false,
});

function normalize(view) {
  const tab = ['messages', 'calls', 'contacts', 'settings'].includes(view.tab)
    ? view.tab : 'messages';
  return {
    tab,
    conversationId: tab === 'messages' ? view.conversationId || null : null,
    settingsSection: tab === 'settings' &&
      ['profile', 'notifications', 'privacy', 'appearance'].includes(view.settingsSection)
      ? view.settingsSection : null,
    search: Boolean(view.search),
  };
}

const sameView = (left, right) => JSON.stringify(left) === JSON.stringify(right);

// A single history owner for the screens rendered inside the Next.js home route.
export function createViewHistory(browser) {
  let view = HOME_VIEW;
  let initialized = false;
  const listeners = new Set();
  const publish = (next) => {
    if (sameView(view, next)) return;
    view = next;
    listeners.forEach((listener) => listener());
  };
  const readUrl = () => {
    const params = new URL(browser.location.href).searchParams;
    return normalize({
      tab: params.has('conversation') ? 'messages' : params.get('tab'),
      conversationId: params.get('conversation'),
      settingsSection: params.get('section'),
      search: params.get('search') === '1',
    });
  };
  const write = (next, replace, depth) => {
    const url = new URL(browser.location.href);
    ['tab', 'conversation', 'section', 'search'].forEach((key) => url.searchParams.delete(key));
    if (next.tab !== 'messages') url.searchParams.set('tab', next.tab);
    if (next.conversationId) url.searchParams.set('conversation', next.conversationId);
    if (next.settingsSection) url.searchParams.set('section', next.settingsSection);
    if (next.search) url.searchParams.set('search', '1');
    // Preserve Next's router state. A new screen is never a fullscreen-call entry.
    const state = { ...browser.history.state, waveView: next, waveDepth: depth };
    delete state.waveCallFullscreen;
    browser.history[replace ? 'replaceState' : 'pushState'](state, '', url);
  };
  const initialize = () => {
    if (initialized || !browser) return;
    initialized = true;
    const next = readUrl();
    const state = browser.history.state;
    if (!state?.waveView || !Number.isInteger(state.waveDepth)) {
      // Cold launches (including notifications and PWA shortcuts) need a real
      // home entry BEFORE their destination, even when history.length is 1.
      write(HOME_VIEW, true, 0);
      let depth = 0;
      if (next.settingsSection) {
        write(normalize({ tab: 'settings' }), false, ++depth);
      }
      if (next.search && !sameView(normalize({ ...next, search: false }), HOME_VIEW)) {
        write(normalize({ ...next, search: false }), false, ++depth);
      }
      if (!sameView(next, HOME_VIEW)) write(next, false, ++depth);
    }
    publish(next);
  };
  const onPopState = () => publish(readUrl());

  return {
    getSnapshot: () => view,
    getServerSnapshot: () => HOME_VIEW,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) browser.addEventListener('popstate', onPopState);
      initialize();
      // Also catch traversals while unsubscribed (e.g. Strict Mode remount).
      publish(readUrl());
      return () => {
        listeners.delete(listener);
        if (!listeners.size) browser.removeEventListener('popstate', onPopState);
      };
    },
    navigate(patch, { replace = false } = {}) {
      initialize();
      const next = normalize({ ...view, ...patch });
      if (sameView(view, next)) return;
      const depth = browser.history.state?.waveDepth || 0;
      write(next, replace, replace ? depth : depth + 1);
      publish(next);
    },
    back() {
      initialize();
      if (browser.history.state?.waveDepth > 0) browser.history.back();
      else if (!sameView(view, HOME_VIEW)) {
        write(HOME_VIEW, true, 0);
        publish(HOME_VIEW);
      }
    },
  };
}
