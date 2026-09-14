'use client';

import React, { memo, useMemo, useState } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import { Avatar } from './Avatar';

export const ChatListPane = memo(function ChatListPane({
  conversations = [],
  activeConversationId,
  onSelectConversation,
  isLoading = false,
  typingMap = {},
  hideOnMobile = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  const filteredConversations = useMemo(
    () => {
      const query = searchQuery.toLowerCase();
      return conversations.filter(
        (conv) =>
          (filter === 'all' || conv.unreadCount > 0) &&
          (conv.contact?.name?.toLowerCase().includes(query) ||
            conv.lastMessage?.toLowerCase().includes(query))
      );
    },
    [conversations, searchQuery, filter]
  );

  const unreadCount = useMemo(
    () => conversations.filter((conv) => conv.unreadCount > 0).length,
    [conversations]
  );

  return (
    <section
      className={`${hideOnMobile ? 'hidden' : 'flex'} card md:flex w-full md:w-[320px] h-full flex-col flex-shrink-0 select-none overflow-hidden rounded-none border-0 md:rounded-2xl md:border`}
    >
      {/* Header & Search Bar */}
      <div className="px-4 pb-1 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-5 md:pt-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-xl font-semibold tracking-tight text-on-surface">
            Messages
          </h1>
          <button
            type="button"
            onClick={() => setIsSearchOpen((open) => !open)}
            aria-label="Search chats"
            aria-expanded={isSearchOpen}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              isSearchOpen
                ? 'bg-primary/12 text-primary'
                : 'text-outline hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <Search className="h-[17px] w-[17px]" strokeWidth={2} />
          </button>
        </div>

        {isSearchOpen && (
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats"
            className="mt-3 w-full rounded-full bg-surface-container px-4 py-2 text-[13px] text-on-surface placeholder-outline transition-colors focus:bg-surface-container-high focus:outline-none"
          />
        )}

        {/* Filters — orange underline marks the active one, as in the reference */}
        <div className="no-scrollbar mt-3 flex items-center gap-4 overflow-x-auto border-b border-outline-variant">
          {[
            { key: 'all', label: 'All messages' },
            { key: 'unread', label: 'Unread', count: unreadCount },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`relative flex flex-shrink-0 items-center gap-1.5 pb-2.5 text-[13px] transition-colors ${
                filter === tab.key
                  ? 'font-semibold text-primary'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="rounded-full bg-primary/12 px-1.5 text-[10px] font-semibold tabular-nums text-primary">
                  {tab.count}
                </span>
              )}
              {filter === tab.key && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations Scroll Container */}
      <div className="scroll-touch flex-1 space-y-0.5 overflow-y-auto px-2 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-4">
        {isLoading && conversations.length === 0 ? (
          <div aria-label="Loading conversations" className="space-y-2 px-2 pt-2">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="flex animate-pulse gap-3 rounded-xl p-2.5">
                <div className="h-11 w-11 flex-shrink-0 rounded-full bg-surface-container-high" />
                <div className="flex-1 space-y-2 py-1.5">
                  <div className="h-2.5 w-1/2 rounded-full bg-surface-container-high" />
                  <div className="h-2 w-4/5 rounded-full bg-surface-container-low" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="animate-in fade-in duration-500 px-6 pt-14 text-center">
            <div className="relative mx-auto mb-5 flex h-12 w-12 items-center justify-center">
              <span className="glow-breathe absolute inset-0 rounded-full bg-primary/20 blur-xl" />
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-high text-primary ring-1 ring-outline-variant">
                <MessageSquare className="h-5 w-5" />
              </span>
            </div>
            <h2 className="text-[13px] font-semibold text-on-surface">No chats yet</h2>
            <p className="mx-auto mt-1.5 max-w-[14rem] text-xs leading-relaxed text-outline">
              Pick someone from Contacts to start a conversation.
            </p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="animate-in fade-in duration-300 px-6 pt-12 text-center text-xs text-outline">
            {searchQuery ? `No chats match “${searchQuery}”.` : 'Nothing unread.'}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isTyping = Boolean(typingMap[conv.id]);
            return (
              <div
                key={conv.id}
                data-conversation-id={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`group relative flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors duration-150 ${
                  isActive
                    ? 'bg-secondary-container'
                    : 'hover:bg-surface-container'
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <Avatar
                    src={conv.contact?.avatar}
                    name={conv.contact?.name}
                    size={40}
                  />
                  {conv.isOnline && (
                    <div className="absolute bottom-0 right-0 h-[11px] w-[11px] rounded-full border-2 border-surface-container-lowest bg-emerald-500" />
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-baseline justify-between gap-2">
                    <span
                      className={`truncate text-[13px] ${
                        conv.unreadCount > 0
                          ? 'font-semibold text-on-surface'
                          : 'font-medium text-on-surface'
                      }`}
                    >
                      {conv.contact?.name}
                    </span>
                    <span className="flex-shrink-0 text-[11px] tabular-nums text-outline">
                      {conv.time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {isTyping ? (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                        typing…
                      </p>
                    ) : (
                      <p
                        className={`truncate text-xs ${
                          conv.unreadCount > 0
                            ? 'font-medium text-on-surface-variant'
                            : 'text-outline'
                        }`}
                      >
                        {conv.lastMessage}
                      </p>
                    )}
                    {conv.unreadCount > 0 && (
                      <span className="flex h-[18px] min-w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums text-on-primary">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
});
