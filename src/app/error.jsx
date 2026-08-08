'use client';

import { useEffect } from 'react';

export default function Error({ error, unstable_retry }) {
  useEffect(() => {
    console.error('Wave route error:', error);
  }, [error]);

  return (
    <main className="flex h-screen w-screen items-center justify-center bg-surface p-6">
      <div className="max-w-md rounded-3xl border border-outline-variant bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl font-bold text-red-600">
          !
        </div>
        <h1 className="mt-4 text-lg font-semibold text-on-surface">Wave hit a snag</h1>
        <p className="mt-2 text-xs leading-relaxed text-outline">
          Your session is safe. Try reloading this view, or return in a moment if the
          service is temporarily unavailable.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
