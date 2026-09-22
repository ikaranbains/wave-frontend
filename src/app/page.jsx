'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatArea } from '../components/ChatArea';
import { ChatListPane } from '../components/ChatListPane';
import { LoginScreen } from '../components/LoginScreen';
import { Sidebar } from '../components/Sidebar';
import { WaveLoader } from '../components/WaveMark';
import { getCallHistoryApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useCalls } from '../hooks/useCalls';
import { useConversations } from '../hooks/useConversations';
import { useTheme } from '../hooks/useTheme';
import { useViewHistory } from '../hooks/useViewHistory';
import { requestPushOnLaunch } from '../services/pushClient';

const CallInterface = dynamic(
  () => import('../components/CallInterface').then((module) => module.CallInterface),
  { ssr: false }
);
const IncomingCall = dynamic(
  () => import('../components/CallInterface').then((module) => module.IncomingCall),
  { ssr: false }
);
const SearchModal = dynamic(
  () => import('../components/SearchModal').then((module) => module.SearchModal),
  { ssr: false }
);
const ContactsView = dynamic(() =>
  import('../components/ContactsView').then((module) => module.ContactsView)
);
const CallsView = dynamic(() =>
  import('../components/CallsView').then((module) => module.CallsView)
);
const SettingsView = dynamic(() =>
  import('../components/SettingsView').then((module) => module.SettingsView)
);

export default function Home() {
  const { view, navigate, back } = useViewHistory();
  const { tab: activeTab, settingsSection: activeSettingsSection, search: isSearchOpen } = view;
  const openConversation = useCallback((id) => {
    navigate(
      { tab: 'messages', conversationId: id, search: false },
      { replace: Boolean(window.history.state?.waveView?.search) }
    );
  }, [navigate]);
  const auth = useAuth();
  const theme = useTheme();
  const chat = useConversations({
    ...auth,
    activeConversationId: view.conversationId,
    onSelectConversation: openConversation,
  });
  const calls = useCalls({
    currentUser: auth.currentUser,
    isBackendConnected: auth.isBackendConnected,
    activeConversation: chat.activeConversation,
  });
  const {
    startChatFromContact,
    activeConversationId,
    loadOlderMessages: loadOlderMessagePage,
  } = chat;
  const { activeCall, endActiveCall, setIsCallMinimized } = calls;
  const { handleLogout: logout } = auth;
  const openSearch = useCallback(() => navigate({ search: true }), [navigate]);
  const closeSearch = useCallback(() => {
    if (window.history.state?.waveView?.search) back();
  }, [back]);
  const selectTab = useCallback((tab) => {
    navigate({ tab, conversationId: null, settingsSection: null, search: false });
  }, [navigate]);
  const loadOlderMessages = useCallback(
    () => loadOlderMessagePage(activeConversationId),
    [loadOlderMessagePage, activeConversationId]
  );
  const minimizeCall = useCallback(() => setIsCallMinimized(true), [setIsCallMinimized]);
  const handleLogout = useCallback(async () => {
    if (activeCall) endActiveCall();
    await logout();
  }, [activeCall, endActiveCall, logout]);

  // null means "not loaded yet" so the list needs no separate loading flag.
  const [callHistory, setCallHistory] = useState(null);

  useEffect(() => {
    if (activeTab !== 'calls' || !auth.currentUser) return undefined;

    let active = true;
    getCallHistoryApi()
      .then((data) => {
        if (active) setCallHistory(data.calls || []);
      })
      .catch((err) => {
        console.error('Failed to load call history:', err);
        if (active) setCallHistory([]);
      });

    return () => {
      active = false;
    };
  }, [activeTab, auth.currentUser]);

  const prevActiveCallRef = useRef(calls.activeCall);
  useEffect(() => {
    if (prevActiveCallRef.current && !calls.activeCall && auth.currentUser) {
      let active = true;
      getCallHistoryApi()
        .then((data) => {
          if (active) setCallHistory(data.calls || []);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
    prevActiveCallRef.current = calls.activeCall;
  }, [calls.activeCall, auth.currentUser]);

  // Ask for notification permission on launch, then register the FCM token. Also
  // re-sends an existing token, which rotates. Best-effort: errors surface in
  // Settings, never here.
  useEffect(() => {
    if (!auth.currentUser) return undefined;
    return requestPushOnLaunch();
  }, [auth.currentUser]);

  // The service worker forwards notification clicks while the app is already open.
  useEffect(() => {
    const handleOpenConversation = (event) => {
      const conversationId = event.detail?.conversationId;
      if (!conversationId) return;
      openConversation(conversationId);
    };

    window.addEventListener('pingme:open-conversation', handleOpenConversation);
    return () =>
      window.removeEventListener('pingme:open-conversation', handleOpenConversation);
  }, [openConversation]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSearch]);

  if (auth.isAuthLoading) {
    return (
      <div className="ambient flex h-dvh w-screen items-center justify-center">
        <WaveLoader className="h-16 w-36 text-primary" />
      </div>
    );
  }

  if (!auth.currentUser) {
    return <LoginScreen onLoginSuccess={auth.handleLoginSuccess} />;
  }

  return (
    <div
      className={`ambient flex h-full w-full flex-col overflow-hidden transition-[padding] duration-200 md:gap-3 md:p-3 ${
        calls.activeCall && calls.isCallMinimized
          ? 'pt-[calc(3.25rem+env(safe-area-inset-top))]'
          : ''
      }`}
    >
      <Sidebar
        activeTab={activeTab}
        setActiveTab={selectTab}
        currentUser={auth.currentUser}
        onOpenSearch={openSearch}
        hideOnMobile={activeTab === 'messages' && !!chat.activeConversationId}
      />

      <div className="flex min-h-0 w-full flex-1 md:gap-3">
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
            isLoadingOlderMessages={chat.isLoadingOlderMessages}
            hasMoreMessages={chat.hasMoreMessages}
            onLoadOlderMessages={loadOlderMessages}
            isContactTyping={chat.isContactTyping}
            onSendMessage={chat.sendMessage}
            onRetryMessage={chat.retryMessage}
            onDeleteMessage={chat.deleteMessage}
            onStartCall={calls.startCall}
            onBack={back}
            onTypingStart={chat.sendTypingStart}
            onTypingStop={chat.sendTypingStop}
          />
        </>
      )}

      {activeTab === 'calls' && (
        <CallsView
          calls={callHistory || []}
          isLoading={callHistory === null}
          onStartCall={calls.startCall}
          onSelectConversation={openConversation}
        />
      )}

      {activeTab === 'contacts' && (
        <ContactsView
          contacts={chat.contacts}
          isLoading={chat.isContactsLoading || chat.isInitialDataLoading}
          onLoadUsers={chat.loadContacts}
          onStartChat={startChatFromContact}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsView
          currentUser={auth.currentUser}
          activeSection={activeSettingsSection}
          onSectionChange={(settingsSection) => navigate({ settingsSection })}
          onSectionBack={back}
          theme={theme.theme}
          onThemeChange={theme.setTheme}
          onUserUpdated={auth.updateCurrentUser}
          onLogout={handleLogout}
        />
      )}
      </div>

      {isSearchOpen && (
        <SearchModal
          isOpen
          onClose={closeSearch}
          conversations={chat.conversations}
          contacts={chat.contacts}
          onSelectConversation={openConversation}
        />
      )}
      {calls.incomingCall && (
        <IncomingCall
          call={calls.incomingCall}
          onAccept={calls.acceptIncomingCall}
          onDecline={calls.declineIncomingCall}
        />
      )}
      {calls.activeCall && (
        <CallInterface
          call={calls.activeCall}
          isMinimized={calls.isCallMinimized}
          onMinimize={minimizeCall}
          onMaximize={() => calls.setIsCallMinimized(false)}
          onEnd={calls.endActiveCall}
        />
      )}
      {calls.callNotice && (
        <button
          type="button"
          onClick={() => calls.setCallNotice('')}
          className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-full bg-stone-900 px-5 py-2.5 text-xs font-medium text-white shadow-xl"
        >
          {calls.callNotice}
        </button>
      )}
    </div>
  );
}
