'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import { MessageSquare, Phone, Users, Settings } from 'lucide-react';
import { Avatar } from './Avatar';

export const Sidebar = memo(function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  hideOnMobile = false,
}) {
  const navClass = (isActive) =>
    `relative flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 active:scale-95 ${isActive
      ? 'glass-active text-primary'
      : 'text-on-surface-variant hover:bg-white/50 hover:text-on-surface'
    }`;

  return (
    <aside
      className={`${hideOnMobile ? 'hidden' : 'flex'} md:flex glass-chrome glass-sheen fixed z-50 select-none overflow-hidden
        mobile-safe-tabs safe-x bottom-0 left-0 w-full h-16 flex-row items-center justify-between rounded-none border-x-0 border-b-0 px-2
        md:inset-y-3 md:left-3 md:bottom-3 md:h-auto md:w-[76px] md:flex-col md:items-center md:justify-start md:rounded-[26px] md:border md:px-0 md:pb-5 md:pt-[calc(1.25rem+env(safe-area-inset-top))]`}
    >
      {/* App Logo / Brand Anchor */}
      <button
        type="button"
        className="relative hidden md:flex mb-7 h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-primary/15 ring-1 ring-white/60 transition-transform active:scale-95"
        onClick={() => setActiveTab('messages')}
        title="Wave"
        aria-label="Wave home"
      >
        <Image
          src="/wave-mark.png"
          alt=""
          width={44}
          height={44}
          className="h-full w-full object-contain"
        />
      </button>

      {/* Primary Navigation Links */}
      <nav className="flex w-3/4 flex-none flex-row items-center justify-around gap-1 md:w-auto md:flex-1 md:flex-col md:justify-start md:gap-3">
        {/* Messages */}
        <button
          onClick={() => setActiveTab('messages')}
          title="Messages"
          aria-label="Messages"
          className={navClass(activeTab === 'messages')}
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        {/* Calls */}
        <button
          onClick={() => setActiveTab('calls')}
          title="Calls"
          aria-label="Calls"
          className={navClass(activeTab === 'calls')}
        >
          <Phone className="w-5 h-5" />
        </button>

        {/* Contacts */}
        <button
          onClick={() => setActiveTab('contacts')}
          title="Contacts"
          aria-label="Contacts"
          className={navClass(activeTab === 'contacts')}
        >
          <Users className="w-5 h-5" />
        </button>
      </nav>

      {/* Bottom Utility Controls & Profile */}
      <div className="flex flex-row md:flex-col gap-1 md:gap-3 items-center md:mt-auto">

        <button
          onClick={() => setActiveTab('settings')}
          title="Settings"
          aria-label="Settings"
          className={`hidden md:flex ${navClass(activeTab === 'settings')}`}
        >
          <Settings className="w-5 h-5" />
        </button>

        <div className="md:mt-2 relative">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            title="Open profile and settings"
            aria-label={`Open profile and settings for ${currentUser?.name || 'current user'}`}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-all hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-primary/30 ${activeTab === 'settings' ? 'ring-2 ring-primary/40 md:ring-0' : ''
              }`}
          >
            <Avatar
              src={currentUser?.avatar}
              name={currentUser?.name}
              size={40}
              className="border-2 border-white/70 shadow-sm"
            />
          </button>
        </div>
      </div>
    </aside>
  );
});
