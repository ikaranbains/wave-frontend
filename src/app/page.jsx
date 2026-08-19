'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatArea } from '../components/ChatArea';
import { ChatListPane } from '../components/ChatListPane';
import { LoginScreen } from '../components/LoginScreen';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useCalls } from '../hooks/useCalls';
import { useConversations } from '../hooks/useConversations';
import { useTheme } from '../hooks/useTheme';
import { requestPushOnLaunch } from '../services/pushClient';

const HOME_VIEW = { tab: 'messages', conversationId: null };
const VALID_TABS = new Set(['messages', 'contacts', 'settings']);

function getView(tab, conversationId) {
  return {
    tab,
    conversationId: tab === 'messages' ? conversationId : null,
  };
}

function isSameView(left, right) {
  return left?.tab === right.tab && left?.conversationId === right.conversationId;
}

function saveView(view, replace = false) {
  const state = { ...window.history.state, waveView: view };
  window.history[replace ? 'replaceState' : 'pushState'](state, '', window.location.href);
}

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
const HelpModal = dynamic(
  () => import('../components/HelpModal').then((module) => module.HelpModal),
  { ssr: false }
);
const ContactsView = dynamic(() =>
  import('../components/ContactsView').then((module) => module.ContactsView)
);
const SettingsView = dynamic(() =>
  import('../components/SettingsView').then((module) => module.SettingsView)
);

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
    activeConversationId,
    loadOlderMessages: loadOlderMessagePage,
  } = chat;
  const { activeCall, endActiveCall } = calls;
  const { handleLogout: logout } = auth;
  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const openHelp = useCallback(() => setIsHelpOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  const closeHelp = useCallback(() => setIsHelpOpen(false), []);
  const closeConversation = useCallback(
    () => {
      if (window.history.state?.waveView?.conversationId) {
        window.history.back();
      } else {
        setActiveConversationId(null);
      }
    },
    [setActiveConversationId]
  );
  const loadOlderMessages = useCallback(
    () => loadOlderMessagePage(activeConversationId),
    [loadOlderMessagePage, activeConversationId]
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

  // Keep single-page views in browser history so Android Back navigates inside the PWA.
  const hasInitializedHistory = useRef(false);
  useEffect(() => {
    if (!auth.currentUser) {
      hasInitializedHistory.current = false;
      return;
    }

    const view = getView(activeTab, activeConversationId);
    if (!hasInitializedHistory.current) {
      hasInitializedHistory.current = true;
      saveView(HOME_VIEW, true);
      if (!isSameView(view, HOME_VIEW)) saveView(view);
      return;
    }

    const savedView = window.history.state?.waveView;
    if (isSameView(savedView, view)) return;

    // Chats and secondary tabs always go back to the Messages home view.
    if (!isSameView(view, HOME_VIEW) && !isSameView(savedView, HOME_VIEW)) {
      saveView(HOME_VIEW);
    }
    saveView(view);
  }, [auth.currentUser, activeConversationId, activeTab]);

  useEffect(() => {
    if (!auth.currentUser) return undefined;

    const restoreView = (event) => {
      const view = event.state?.waveView;
      if (!view || !VALID_TABS.has(view.tab)) return;

      setActiveTab(view.tab);
      if (view.tab === 'messages' && view.conversationId) {
        selectConversation(view.conversationId);
      } else {
        setActiveConversationId(null);
      }
    };

    window.addEventListener('popstate', restoreView);
    return () => window.removeEventListener('popstate', restoreView);
  }, [auth.currentUser, selectConversation, setActiveConversationId]);

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
        window.history.replaceState(
          { ...window.history.state },
          '',
          window.location.pathname
        );
      }
    };

    applyLaunchUrl();
  }, [auth.currentUser, selectConversation]);

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
            isLoadingOlderMessages={chat.isLoadingOlderMessages}
            hasMoreMessages={chat.hasMoreMessages}
            onLoadOlderMessages={loadOlderMessages}
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

      {isSearchOpen && (
        <SearchModal
          isOpen
          onClose={closeSearch}
          conversations={chat.conversations}
          contacts={chat.contacts}
          onSelectConversation={handleSearchSelection}
        />
      )}
      {isHelpOpen && <HelpModal isOpen onClose={closeHelp} />}

      {calls.incomingCall && (
        <IncomingCall
          call={calls.incomingCall}
          onAccept={calls.acceptIncomingCall}
          onDecline={calls.declineIncomingCall}
        />
      )}
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
