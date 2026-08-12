'use client';

import Image from 'next/image';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CallInterface, IncomingCall } from '../components/CallInterface';
import { ChatArea } from '../components/ChatArea';
import { ChatListPane } from '../components/ChatListPane';
import { ContactsView } from '../components/ContactsView';
import { HelpModal } from '../components/HelpModal';
import { LoginScreen } from '../components/LoginScreen';
import { SearchModal } from '../components/SearchModal';
import { SettingsView } from '../components/SettingsView';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useCalls } from '../hooks/useCalls';
import { useConversations } from '../hooks/useConversations';
import { useTheme } from '../hooks/useTheme';

export default function Home() {
  const [activeTab, setActiveTab] = useState('messages');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const auth = useAuth();
  const theme = useTheme();
  const chat = useConversations(auth);
  const calls = useCalls({
    currentUser: auth.currentUser,
    isBackendConnected: auth.isBackendConnected,
    activeConversation: chat.activeConversation,
  });
  const {
    setActiveConversationId,
    startChatFromContact,
    selectConversation,
  } = chat;
  const { activeCall, endActiveCall } = calls;
  const { handleLogout: logout } = auth;
  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const openHelp = useCallback(() => setIsHelpOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  const closeHelp = useCallback(() => setIsHelpOpen(false), []);
  const closeConversation = useCallback(
    () => setActiveConversationId(null),
    [setActiveConversationId]
  );
  const handleContactStart = useCallback(
    async (contact) => {
      if (await startChatFromContact(contact)) setActiveTab('messages');
    },
    [startChatFromContact]
  );
  const handleSearchSelection = useCallback(
    (id) => {
      setActiveTab('messages');
      selectConversation(id);
    },
    [selectConversation]
  );
  const handleLogout = useCallback(async () => {
    if (activeCall) endActiveCall();
    await logout();
  }, [activeCall, endActiveCall, logout]);

  // Deep links: manifest shortcuts (?tab=) and notification clicks (?conversation=).
  const hasHandledLaunchUrl = useRef(false);
  useEffect(() => {
    if (hasHandledLaunchUrl.current || !auth.currentUser) return;
    hasHandledLaunchUrl.current = true;

    const applyLaunchUrl = async () => {
      await Promise.resolve();
      const params = new URLSearchParams(window.location.search);
      const requestedTab = params.get('tab');
      const requestedConversation = params.get('conversation');

      if (['messages', 'contacts', 'settings'].includes(requestedTab)) {
        setActiveTab(requestedTab);
      }
      if (requestedConversation) {
        setActiveTab('messages');
        selectConversation(requestedConversation);
      }
      if (requestedTab || requestedConversation) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    applyLaunchUrl();
  }, [auth.currentUser, selectConversation]);

  // The service worker forwards notification clicks while the app is already open.
  useEffect(() => {
    const handleOpenConversation = (event) => {
      const conversationId = event.detail?.conversationId;
      if (!conversationId) return;
      setActiveTab('messages');
      selectConversation(conversationId);
    };

    window.addEventListener('pingme:open-conversation', handleOpenConversation);
    return () =>
      window.removeEventListener('pingme:open-conversation', handleOpenConversation);
  }, [selectConversation]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (auth.isAuthLoading) {
    return (
      <div className="ambient flex h-dvh w-screen items-center justify-center">
        <div className="flex animate-pulse items-center gap-2.5 text-sm font-semibold text-primary">
          <Image
            src="/wave-mark.png"
            alt=""
            width={40}
            height={40}
            priority
            className="h-10 w-10 rounded-2xl bg-white object-contain shadow-lg shadow-primary/15"
          />
          <span>Loading Wave…</span>
        </div>
      </div>
    );
  }

  if (!auth.currentUser) {
    return <LoginScreen onLoginSuccess={auth.handleLoginSuccess} />;
  }

  return (
    <div className="ambient flex h-full w-full overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSearch={openSearch}
        onOpenHelp={openHelp}
        currentUser={auth.currentUser}
        hideOnMobile={activeTab === 'messages' && !!chat.activeConversationId}
      />

      {activeTab === 'messages' && (
        <>
          <ChatListPane
            conversations={chat.conversations}
            activeConversationId={chat.activeConversationId}
            onSelectConversation={chat.selectConversation}
            isLoading={chat.isInitialDataLoading}
            typingMap={chat.typingMap}
            hideOnMobile={!!chat.activeConversationId}
          />
          <ChatArea
            key={chat.activeConversation?.id || 'no-active-conversation'}
            conversation={chat.activeConversation}
            messages={chat.activeMessages}
            isLoading={chat.isMessagesLoading}
            isContactTyping={chat.isContactTyping}
            onSendMessage={chat.sendMessage}
            onRetryMessage={chat.retryMessage}
            onDeleteMessage={chat.deleteMessage}
            onStartCall={calls.startCall}
            onBack={closeConversation}
            onTypingStart={chat.sendTypingStart}
            onTypingStop={chat.sendTypingStop}
          />
        </>
      )}

      {activeTab === 'contacts' && (
        <ContactsView
          contacts={chat.contacts}
          isLoading={chat.isContactsLoading || chat.isInitialDataLoading}
          onLoadUsers={chat.loadContacts}
          onStartChat={handleContactStart}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsView
          currentUser={auth.currentUser}
          theme={theme.theme}
          onThemeChange={theme.setTheme}
          onUserUpdated={auth.updateCurrentUser}
          onLogout={handleLogout}
        />
      )}

      <SearchModal
        isOpen={isSearchOpen}
        onClose={closeSearch}
        conversations={chat.conversations}
        contacts={chat.contacts}
        onSelectConversation={handleSearchSelection}
      />
      <HelpModal isOpen={isHelpOpen} onClose={closeHelp} />

      <IncomingCall
        call={calls.incomingCall}
        onAccept={calls.acceptIncomingCall}
        onDecline={calls.declineIncomingCall}
      />
      {calls.activeCall && (
        <CallInterface call={calls.activeCall} onEnd={calls.endActiveCall} />
      )}
      {calls.callNotice && (
        <button
          type="button"
          onClick={() => calls.setCallNotice('')}
          className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-medium text-white shadow-xl"
        >
          {calls.callNotice}
        </button>
      )}
    </div>
  );
}
