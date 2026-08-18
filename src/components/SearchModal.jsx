'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { Search, X, MessageSquare, User } from 'lucide-react';
import { getCloudinaryThumbnail, getInitials, isRealAvatar } from '../utils/avatarUtils';

export const SearchModal = ({
  isOpen,
  onClose,
  conversations = [],
  contacts = [],
  onSelectConversation,
}) => {
  const [query, setQuery] = useState('');

  const matchedContacts = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(normalizedQuery) ||
        contact.email.toLowerCase().includes(normalizedQuery)
    );
  }, [contacts, query]);

  const matchedConversations = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return conversations.filter(
      (conversation) =>
        conversation.contact?.name.toLowerCase().includes(normalizedQuery) ||
        conversation.lastMessage.toLowerCase().includes(normalizedQuery)
    );
  }, [conversations, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex select-none items-start justify-center bg-black/50 p-3 pt-[calc(1rem+env(safe-area-inset-top))] sm:p-4 sm:pt-20">
      <div className="flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-2xl sm:max-h-[70dvh]">
        {/* Search Header */}
        <div className="p-4 border-b border-surface-container flex items-center gap-3">
          <Search className="w-5 h-5 text-primary" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all messages, contacts, and files..."
            className="flex-1 bg-transparent text-sm text-on-surface focus:outline-none placeholder-outline"
          />
          <button
            onClick={onClose}
            className="p-1 text-outline hover:text-on-surface rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="scroll-touch flex-1 space-y-4 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {query.trim() === '' ? (
            <div className="text-center py-8 text-xs text-outline">
              Type a name, phrase, or topic to search Wave.
            </div>
          ) : (
            <>
              {/* Contacts Results */}
              {matchedContacts.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold text-outline uppercase tracking-wider mb-2">
                    Contacts ({matchedContacts.length})
                  </h4>
                  <div className="space-y-1">
                    {matchedContacts.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          const conv = conversations.find((cv) => cv.contact?.id === c.id);
                          if (conv) onSelectConversation(conv.id);
                          onClose();
                        }}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-container-low cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          {isRealAvatar(c.avatar) ? (
                            <Image
                              src={getCloudinaryThumbnail(c.avatar, 64)}
                              alt={c.name}
                              width={32}
                              height={32}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container text-xs font-bold text-primary select-none">
                              {getInitials(c.name)}
                            </span>
                          )}
                          <div>
                            <p className="text-xs font-semibold text-on-surface">{c.name}</p>
                            <p className="text-[10px] text-outline">{c.email}</p>
                          </div>
                        </div>
                        <User className="w-4 h-4 text-outline" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversations Results */}
              {matchedConversations.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold text-outline uppercase tracking-wider mb-2">
                    Messages ({matchedConversations.length})
                  </h4>
                  <div className="space-y-1">
                    {matchedConversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => {
                          onSelectConversation(conv.id);
                          onClose();
                        }}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-container-low cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <MessageSquare className="w-4 h-4 text-primary" />
                          <div>
                            <p className="text-xs font-semibold text-on-surface">{conv.contact?.name}</p>
                            <p className="text-[11px] text-on-surface-variant truncate max-w-sm">{conv.lastMessage}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-outline">{conv.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matchedContacts.length === 0 && matchedConversations.length === 0 && (
                <div className="text-center py-8 text-xs text-outline">
                  No results found for &quot;{query}&quot;.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
