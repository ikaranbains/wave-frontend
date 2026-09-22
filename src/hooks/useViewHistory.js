'use client';

import { useState, useSyncExternalStore } from 'react';
import { createViewHistory } from '../utils/viewHistory.mjs';

export function useViewHistory() {
  const [history] = useState(() => createViewHistory(typeof window === 'undefined' ? null : window));
  const view = useSyncExternalStore(history.subscribe, history.getSnapshot, history.getServerSnapshot);
  return { view, navigate: history.navigate, back: history.back };
}
