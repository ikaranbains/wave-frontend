'use client';

import { memo } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  LoaderCircle,
  Phone,
  PhoneCall,
  Video,
} from 'lucide-react';
import { describeCallEvent } from '../utils/chatFormatters';
import { Avatar } from './Avatar';

export const CallsView = memo(function CallsView({
  calls = [],
  isLoading = false,
  onStartCall,
  onSelectConversation,
}) {
  return (
    <main className="card scroll-touch h-full flex-1 select-none overflow-y-auto rounded-none border-0 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:p-6 sm:pt-[calc(1.5rem+env(safe-area-inset-top))] md:rounded-2xl md:border md:p-8 md:pb-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-on-surface">
              Calls
            </h1>
            <p className="mt-1 text-xs text-outline">Audio and video calls from all chats</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <PhoneCall className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </span>
        </div>

        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center text-outline">
            <LoaderCircle className="h-6 w-6 animate-spin" aria-label="Loading calls" />
          </div>
        ) : calls.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-outline">
              <Phone className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </span>
            <p className="text-[13px] font-semibold text-on-surface">No calls yet</p>
            <p className="mt-1 text-xs text-outline">Your audio and video calls will appear here.</p>
          </div>
        ) : (
          <div className="card overflow-hidden rounded-2xl">
            {calls.map((call) => {
              const contact = call.peer;
              const isOutgoing = call.direction === 'outgoing';
              const { label, detail, missed } = describeCallEvent(call, isOutgoing);
              const DirectionIcon = isOutgoing ? ArrowUpRight : ArrowDownLeft;
              const TypeIcon = call.type === 'video' ? Video : Phone;

              return (
                <div
                  key={call.id}
                  className="flex items-center gap-3 border-b border-outline-variant px-4 py-3.5 last:border-b-0 sm:px-5"
                >
                  <button
                    type="button"
                    onClick={() =>
                      call.conversationId && onSelectConversation?.(call.conversationId)
                    }
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Avatar src={contact?.avatar} name={contact?.name} size={48} />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-on-surface">
                        {contact?.name || 'Unknown contact'}
                      </p>
                      <div
                        className={`mt-1 flex items-center gap-1 text-xs ${
                          missed ? 'text-red-600' : 'text-outline'
                        }`}
                      >
                        <DirectionIcon className="h-4 w-4 flex-shrink-0" strokeWidth={1.9} />
                        <span className="truncate">{label}</span>
                        {detail && <span className="flex-shrink-0">· {detail}</span>}
                      </div>
                      <p className="mt-0.5 text-[11px] text-outline">
                        {new Date(call.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!call.conversationId}
                    onClick={() =>
                      onStartCall?.(call.type, { id: call.conversationId, contact })
                    }
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-outline transition-colors duration-150 hover:bg-surface-container hover:text-on-surface active:scale-95 disabled:opacity-40"
                    title={`Start ${call.type} call with ${contact?.name || 'contact'}`}
                    aria-label={`Start ${call.type} call with ${contact?.name || 'contact'}`}
                  >
                    <TypeIcon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
});
