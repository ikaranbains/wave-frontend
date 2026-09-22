'use client';

import React, { memo } from 'react';
import { MessageSquare, Phone, Users, Search } from 'lucide-react';
import { Avatar } from './Avatar';
import { WaveMark } from './WaveMark';

export const Sidebar = memo(function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenSearch,
  hideOnMobile = false,
}) {
  const navClass = (isActive) =>
    `relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150 active:scale-95 ${
      isActive
        ? 'bg-primary/12 text-primary'
        : 'text-outline hover:bg-surface-container hover:text-on-surface'
    }`;

  return (
    <header
      className={`${hideOnMobile ? 'hidden' : 'flex'} card select-none md:flex
        mobile-safe-tabs safe-x fixed bottom-0 left-0 z-50 h-16 w-full flex-row items-center rounded-none border-x-0 border-b-0 px-2 md:justify-between md:px-3
        md:static md:z-auto md:h-14 md:rounded-2xl md:border`}
    >
      {/* Brand */}
      <button
        type="button"
        onClick={() => setActiveTab('messages')}
        title="Wave"
        aria-label="Wave home"
        className="hidden items-center gap-2.5 pl-1 pr-2 transition-transform active:scale-95 md:flex"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary-container text-primary">
          <WaveMark className="h-[18px] w-[18px]" />
        </span>
        <span className="font-display text-[15px] font-semibold tracking-tight text-on-surface">
          Wave
        </span>
      </button>

      {/* Search — the reference's centre pill, opening the existing search modal */}
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search"
        className="mx-auto hidden h-9 w-full max-w-sm items-center gap-2.5 rounded-full bg-surface-container px-4 text-left text-[13px] text-outline transition-colors hover:bg-surface-container-high md:flex"
      >
        <Search className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
        Search
      </button>

      {/* Primary navigation */}
      <nav className="grid flex-1 grid-cols-4 place-items-center md:flex md:flex-none md:items-center md:gap-0.5">
        <button
          onClick={() => setActiveTab('messages')}
          title="Messages"
          aria-label="Messages"
          className={navClass(activeTab === 'messages')}
        >
          <MessageSquare className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </button>
        <button
          onClick={() => setActiveTab('calls')}
          title="Calls"
          aria-label="Calls"
          className={navClass(activeTab === 'calls')}
        >
          <Phone className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </button>
        <button
          onClick={() => setActiveTab('contacts')}
          title="Contacts"
          aria-label="Contacts"
          className={navClass(activeTab === 'contacts')}
        >
          <Users className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </button>

        {/* Profile — also the only way into settings, so a gear would duplicate it. */}
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          title="Open profile and settings"
          aria-label={`Open profile and settings for ${currentUser?.name || 'current user'}`}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 md:ml-1 ${
            activeTab === 'settings' ? 'ring-2 ring-primary/50' : ''
          }`}
        >
          <Avatar
            src={currentUser?.avatar}
            name={currentUser?.name}
            size={32}
            className="ring-1 ring-outline-variant"
          />
        </button>
      </nav>
    </header>
  );
});
