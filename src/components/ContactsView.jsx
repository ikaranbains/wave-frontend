'use client';

import React, { memo, useEffect, useState } from 'react';
import Image from 'next/image';
import { Search, Mail, MessageSquare, Users, LoaderCircle } from 'lucide-react';
import { getInitials, isRealAvatar } from '../utils/avatarUtils';

export const ContactsView = memo(function ContactsView({
  contacts = [],
  isLoading = false,
  onLoadUsers,
  onStartChat,
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onLoadUsers(search.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search, onLoadUsers]);

  const filteredContacts = contacts.filter((c) => {
    const matchesFilter = filter === 'all' || c.status === filter;
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="ambient scroll-touch h-full flex-1 select-none overflow-y-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:p-6 sm:pt-[calc(1.5rem+env(safe-area-inset-top))] md:ml-[100px] md:p-8 md:pb-8">
      {/* Header section */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:mb-8 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.02em] text-on-surface">
            People
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Everyone you can reach on Wave. Tap someone to start talking.
          </p>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="glass-chrome glass-sheen relative mb-6 flex flex-col items-center justify-between gap-3 rounded-3xl p-2.5 sm:flex-row">
        <div className="relative w-full sm:max-w-md sm:flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-2xl border border-white/60 bg-white/60 py-2.5 pl-10 pr-10 text-sm text-on-surface placeholder:text-outline/70 transition-all focus:border-primary/50 focus:bg-white/90 focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
          {isLoading && (
            <LoaderCircle className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
          )}
        </div>

        <div className="flex w-full items-center gap-1 rounded-2xl border border-white/50 bg-white/40 p-1 sm:w-auto">
          {['all', 'online', 'offline'].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`flex-1 rounded-xl px-4 py-1.5 text-xs font-semibold capitalize transition-all sm:flex-none ${
                filter === t
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'text-on-surface-variant hover:bg-white/70 hover:text-on-surface'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Contact Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
        {isLoading && contacts.length === 0 ? (
          <div className="glass col-span-full flex items-center justify-center gap-2 rounded-3xl px-6 py-14 text-sm text-on-surface-variant">
            <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            <span>Finding people…</span>
          </div>
        ) : contacts.length === 0 ? (
          <div className="glass glass-sheen relative col-span-full rounded-3xl px-6 py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-7 w-7" />
            </div>
            <h2 className="font-display text-lg font-bold text-on-surface">
              Nobody here yet
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              People who join Wave will show up here.
            </p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="glass col-span-full rounded-3xl px-6 py-12 text-center">
            <h2 className="font-display text-base font-bold text-on-surface">
              No one matches that
            </h2>
            <p className="mt-1.5 text-sm text-on-surface-variant">
              Try a different name, or switch the filter back to All.
            </p>
          </div>
        ) : filteredContacts.map((contact) => (
          <div
            key={contact.id}
            className="glass glass-sheen group relative flex flex-col justify-between rounded-3xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-xl hover:shadow-primary/10"
          >
            <div className="relative">
              <div className="mb-4 flex items-start justify-between">
                <div className="relative">
                  {isRealAvatar(contact.avatar) ? (
                    <Image
                      src={contact.avatar}
                      alt={contact.name}
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-full border-2 border-white/80 object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-14 w-14 select-none items-center justify-center rounded-full border-2 border-white/80 bg-gradient-to-br from-primary to-primary-container text-base font-bold text-white shadow-sm">
                      {getInitials(contact.name)}
                    </div>
                  )}
                  <span
                    className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm ${
                      contact.status === 'online'
                        ? 'bg-emerald-500'
                        : contact.status === 'away'
                        ? 'bg-amber-500'
                        : 'bg-slate-300'
                    }`}
                  />
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize backdrop-blur ${
                    contact.status === 'online'
                      ? 'bg-emerald-500/15 text-emerald-700'
                      : 'bg-slate-500/12 text-slate-600'
                  }`}
                >
                  {contact.status}
                </span>
              </div>

              <h3 className="font-display text-base font-bold tracking-tight text-on-surface">
                {contact.name}
              </h3>

              <div className="mb-5 mt-1.5 flex items-center gap-2 text-xs text-on-surface-variant">
                <Mail className="h-3.5 w-3.5 shrink-0 text-outline" />
                <span className="truncate">{contact.email}</span>
              </div>
            </div>

            <button
              onClick={() => onStartChat(contact)}
              className="relative flex w-full items-center justify-center gap-2 rounded-2xl border border-white/50 bg-white/50 py-2.5 text-xs font-semibold text-primary transition-all hover:bg-primary hover:text-white hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Send a message</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});
