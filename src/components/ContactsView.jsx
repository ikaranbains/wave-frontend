'use client';

import React, { memo, useEffect, useMemo, useState } from 'react';
import { Search, Mail, MessageSquare, Users, LoaderCircle } from 'lucide-react';
import { Avatar } from './Avatar';

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

  const filteredContacts = useMemo(() => {
    const query = search.toLowerCase();
    return contacts.filter((contact) => {
      const matchesFilter = filter === 'all' || contact.status === filter;
      const matchesSearch =
        contact.name.toLowerCase().includes(query) ||
        contact.email.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [contacts, filter, search]);

  return (
    <div className="card scroll-touch h-full flex-1 select-none overflow-y-auto rounded-none border-0 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:p-6 sm:pt-[calc(1.5rem+env(safe-area-inset-top))] md:rounded-2xl md:border md:p-8 md:pb-8">
      {/* Header section */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:mb-8 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-on-surface">
            People
          </h1>
          <p className="mt-1 text-[13px] text-outline">
            Everyone you can reach on Wave. Tap someone to start talking.
          </p>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="card mb-6 flex flex-col items-center justify-between gap-3 rounded-2xl p-2.5 sm:flex-row">
        <div className="relative w-full sm:max-w-md sm:flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline"
            strokeWidth={1.9}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-full bg-surface-container py-2.5 pl-10 pr-10 text-[13px] text-on-surface placeholder-outline transition-colors duration-150 focus:bg-surface-container-high focus:outline-none"
          />
          {isLoading && (
            <LoaderCircle className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
          )}
        </div>

        <div className="flex w-full items-center gap-1 rounded-full bg-surface-container p-1 sm:w-auto">
          {['all', 'online', 'offline'].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`flex-1 rounded-full px-4 py-1.5 text-[13px] font-semibold capitalize transition-colors duration-150 active:scale-95 sm:flex-none ${
                filter === t
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
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
          <div className="card col-span-full flex items-center justify-center gap-2 rounded-2xl px-6 py-14 text-[13px] text-on-surface-variant">
            <LoaderCircle className="h-[18px] w-[18px] animate-spin text-primary" />
            <span>Finding people…</span>
          </div>
        ) : contacts.length === 0 ? (
          <div className="card col-span-full rounded-2xl px-6 py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Users className="h-6 w-6" strokeWidth={1.9} />
            </div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-on-surface">
              Nobody here yet
            </h2>
            <p className="mt-2 text-[13px] text-outline">
              People who join Wave will show up here.
            </p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="card col-span-full rounded-2xl px-6 py-12 text-center">
            <h2 className="font-display text-lg font-semibold tracking-tight text-on-surface">
              No one matches that
            </h2>
            <p className="mt-1.5 text-[13px] text-outline">
              Try a different name, or switch the filter back to All.
            </p>
          </div>
        ) : filteredContacts.map((contact) => (
          <div
            key={contact.id}
            className="card group relative flex flex-col justify-between rounded-2xl p-5 transition-colors duration-150 hover:bg-surface-container-low"
          >
            <div className="relative">
              <div className="mb-4 flex items-start justify-between">
                <div className="relative">
                  <Avatar
                    src={contact.avatar}
                    name={contact.name}
                    size={56}
                    className="border border-outline-variant"
                  />
                  <span
                    className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface-container-lowest ${
                      contact.status === 'online'
                        ? 'bg-emerald-500'
                        : contact.status === 'away'
                        ? 'bg-amber-500'
                        : 'bg-outline'
                    }`}
                  />
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                    contact.status === 'online'
                      ? 'bg-emerald-500/15 text-emerald-700'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {contact.status}
                </span>
              </div>

              <h3 className="text-[13px] font-semibold text-on-surface">
                {contact.name}
              </h3>

              <div className="mb-5 mt-1.5 flex items-center gap-2 text-xs text-outline">
                <Mail className="h-4 w-4 shrink-0" strokeWidth={1.9} />
                <span className="truncate">{contact.email}</span>
              </div>
            </div>

            <button
              onClick={() => onStartChat(contact)}
              className="relative flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-[13px] font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-container active:scale-95"
            >
              <MessageSquare className="h-4 w-4" strokeWidth={1.9} />
              <span>Send a message</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});
