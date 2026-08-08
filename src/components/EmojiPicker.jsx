'use client';

import { useEffect, useRef, useState } from 'react';

export function EmojiPicker({ onSelect }) {
  const containerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let picker;
    let cancelled = false;

    Promise.all([import('@emoji-mart/data'), import('emoji-mart')])
      .then(([dataModule, emojiMart]) => {
        if (cancelled || !containerRef.current) return;

        picker = new emojiMart.Picker({
          data: dataModule.default,
          onEmojiSelect: (emoji) => onSelectRef.current(emoji.native),
          autoFocus: true,
          dynamicWidth: true,
          emojiButtonRadius: '8px',
          emojiButtonSize: 34,
          emojiSize: 22,
          maxFrequentRows: 2,
          navPosition: 'bottom',
          previewPosition: 'none',
          set: 'native',
          skinTonePosition: 'search',
          theme: 'light',
        });
        picker.style.width = '100%';
        picker.style.height = '100%';

        // Emoji Mart lays the picker out as a flex column but never constrains
        // its root to the host height, and the scroller inherits the default
        // `min-height: auto` — so the list grows to its full content height and
        // the `overflow-y: auto` on it has nothing left to scroll. Pin the root
        // to the host and let the scroller shrink.
        if (picker.shadowRoot) {
          const fix = document.createElement('style');
          fix.textContent = `
            #root { height: 100%; min-height: 0; }
            #root > .scroll { min-height: 0; overscroll-behavior: contain; }
          `;
          picker.shadowRoot.appendChild(fix);
        }

        containerRef.current.appendChild(picker);
        setIsLoading(false);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Unable to load Emoji Mart:', error);
          setLoadError('Emoji picker could not be loaded.');
        }
      });

    return () => {
      cancelled = true;
      picker?.remove();
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-label="Choose an emoji"
      className="fixed bottom-[72px] left-3 right-3 z-50 mx-auto max-w-[352px] overflow-hidden rounded-2xl border border-outline-variant/60 bg-white shadow-2xl sm:absolute sm:bottom-12 sm:left-auto sm:right-0 sm:w-[352px] sm:max-w-none"
    >
      {loadError ? (
        <p role="alert" className="px-5 py-8 text-center text-xs text-red-600">
          {loadError}
        </p>
      ) : (
        <div className="relative h-[360px] sm:h-[420px] max-h-[55vh]">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-outline animate-pulse">
              Loading emojis…
            </div>
          )}
          <div ref={containerRef} className="h-full [&>em-emoji-picker]:block [&>em-emoji-picker]:h-full [&>em-emoji-picker]:w-full" />
        </div>
      )}
    </div>
  );
}
