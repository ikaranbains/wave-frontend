'use client';

import React, { memo, useMemo, useState } from 'react';
import Image from 'next/image';
import { MessageSquare, Search } from 'lucide-react';
import { getCloudinaryThumbnail, getInitials, isRealAvatar } from '../utils/avatarUtils';

export const ChatListPane = memo(function ChatListPane({
  conversations = [],
  activeConversationId,
  onSelectConversation,
  isLoading = false,
  typingMap = {},
  hideOnMobile = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = useMemo(
    () => {
      const query = searchQuery.toLowerCase();
      return conversations.filter(
        (conv) =>
          conv.contact?.name?.toLowerCase().includes(query) ||
          conv.lastMessage?.toLowerCase().includes(query)
      );
    },
    [conversations, searchQuery]
  );

  return (
    <section
      className={`${hideOnMobile ? 'hidden' : 'flex'} ambient md:flex md:ml-[100px] w-full md:w-[280px] h-full md:border-r border-outline-variant/40 flex-col flex-shrink-0 select-none`}
    >
      {/* Header & Search Bar */}
      <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:p-6 sm:pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <h1 className="text-xl font-semibold text-on-surface mb-4">Messages</h1>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-surface-bright border border-outline-variant rounded-lg py-2 pl-9 pr-3 text-xs text-on-surface placeholder-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
      </div>

      {/* Conversations Scroll Container */}
      <div className="scroll-touch flex-1 space-y-1 overflow-y-auto px-2 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-4">
        {isLoading && conversations.length === 0 ? (
          <div aria-label="Loading conversations" className="space-y-2 px-2 pt-2">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="flex animate-pulse gap-3 rounded-xl bg-white/60 p-3">
                <div className="h-12 w-12 flex-shrink-0 rounded-full bg-surface-container-highest" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-2/3 rounded bg-surface-container-highest" />
                  <div className="h-2.5 w-full rounded bg-surface-container-high" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="mx-2 mt-3 rounded-2xl border border-dashed border-outline-variant bg-white/70 px-5 py-8 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-secondary-container text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-semibold text-on-surface">No chats yet</h2>
            <p className="mt-1 text-xs leading-relaxed text-outline">
              Open Contacts and choose a user to start a conversation.
            </p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="mx-2 mt-3 rounded-xl bg-white/70 p-5 text-center text-xs text-outline">
            No chats match “{searchQuery}”.
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
                className={`relative p-3 rounded-xl flex gap-3 cursor-pointer transition-all ${
                  isActive
                    ? 'bg-white border border-outline-variant/50 shadow-xs'
                    : 'hover:bg-surface-container-highest'
                }`}
              >
                {/* Active Indicator Strip */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                )}

                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {isRealAvatar(conv.contact?.avatar) ? (
                    <Image
                      src={getCloudinaryThumbnail(conv.contact?.avatar, 96)}
                      alt={conv.contact?.name}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-primary font-bold text-sm select-none">
                      {getInitials(conv.contact?.name)}
                    </div>
                  )}
                  {conv.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-semibold text-xs text-on-surface truncate">
                      {conv.contact?.name}
                    </span>
                    <span className="text-[11px] text-outline">{conv.time}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    {isTyping ? (
                      <p className="text-xs font-semibold text-emerald-600 italic flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        typing...
                      </p>
                    ) : (
                      <p
                        className={`text-xs truncate ${
                          isActive
                            ? 'text-primary font-medium'
                            : 'text-on-surface-variant'
                        }`}
                      >
                        {conv.lastMessage}
                      </p>
                    )}
                    {conv.unreadCount > 0 && (
                      <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 flex-shrink-0">
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
