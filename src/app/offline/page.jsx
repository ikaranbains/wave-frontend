import Link from 'next/link';
import { CloudOff } from 'lucide-react';

export const metadata = {
  title: 'Offline',
  description: 'Wave is offline. Queued messages send as soon as you reconnect.',
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-surface px-6 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-outline-variant/60 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-container text-primary">
          <CloudOff className="h-7 w-7" />
        </div>
        <h1 className="text-base font-semibold text-on-surface">You&apos;re offline</h1>
        <p className="mt-2 text-xs leading-relaxed text-outline">
          Wave needs a connection to load new chats. Anything you typed while offline is
          queued and sends automatically once you&apos;re back.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white"
        >
          Try again
        </Link>
      </div>
    </main>
  );
}
