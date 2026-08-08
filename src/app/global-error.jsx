'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, unstable_retry }) {
  useEffect(() => {
    console.error('Wave global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8f9fa' }}>
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            color: '#191c1d',
          }}
        >
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <title>Something went wrong | Wave</title>
            <h1>Wave couldn&apos;t load</h1>
            <p>Try again to recover the app. Your account data has not been changed.</p>
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{
                border: 0,
                borderRadius: 12,
                background: '#0058be',
                color: 'white',
                padding: '10px 20px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
