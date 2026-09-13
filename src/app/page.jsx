'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatArea } from '../components/ChatArea';
import { ChatListPane } from '../components/ChatListPane';
import { LoginScreen } from '../components/LoginScreen';
import { Sidebar } from '../components/Sidebar';
import { getCallHistoryApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useCalls } from '../hooks/useCalls';
import { useConversations } from '../hooks/useConversations';
import { useTheme } from '../hooks/useTheme';
import { requestPushOnLaunch } from '../services/pushClient';

const HOME_VIEW = { tab: 'messages', conversationId: null, settingsSection: null };
const VALID_TABS = new Set(['messages', 'contacts', 'calls', 'settings']);

function getView(tab, conversationId, settingsSection) {
  return {
    tab,
    conversationId: tab === 'messages' ? conversationId : null,
    settingsSection: tab === 'settings' ? settingsSection : null,
  };
}

function isSameView(left, right) {
  return (
    left?.tab === right.tab &&
    left?.conversationId === right.conversationId &&
    (left?.settingsSection || null) === (right.settingsSection || null)
  );
}

function shouldBridgeThroughHome(savedView, view) {
  const staysWithinSettings = savedView?.tab === 'settings' && view.tab === 'settings';
  return (
    !staysWithinSettings &&
    !isSameView(view, HOME_VIEW) &&
    !isSameView(savedView, HOME_VIEW)
  );
}

function needsHomeBackTarget(view, historyLength) {
  return historyLength <= 1 && !isSameView(view, HOME_VIEW);
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
  const [activeTab, setActiveTab] = useState('messages');
  const [activeSettingsSection, setActiveSettingsSection] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  const selectTab = useCallback((tab) => {
    setActiveTab(tab);
    if (tab !== 'settings') setActiveSettingsSection(null);
  }, []);
  const closeSettingsSection = useCallback(() => {
    if (window.history.state?.waveView?.settingsSection) {
      window.history.back();
    } else {
      setActiveSettingsSection(null);
    }
  }, []);
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
      if (await startChatFromContact(contact)) selectTab('messages');
    },
    [selectTab, startChatFromContact]
  );
  const handleSearchSelection = useCallback(
    (id) => {
      selectTab('messages');
      selectConversation(id);
    },
    [selectConversation, selectTab]
  );
  const handleLogout = useCallback(async () => {
    if (activeCall) endActiveCall();
    await logout();
  }, [activeCall, endActiveCall, logout]);

  const [callHistory, setCallHistory] = useState([]);
  const [isCallHistoryLoading, setIsCallHistoryLoading] = useState(false);

  const loadCallHistory = useCallback(async () => {
    if (!auth.currentUser) return;
    setIsCallHistoryLoading(true);
    try {
      const data = await getCallHistoryApi();
      setCallHistory(data.calls || []);
    } catch (err) {
      console.error('Failed to load call history:', err);
    } finally {
      setIsCallHistoryLoading(false);
    }
  }, [auth.currentUser]);

  useEffect(() => {
    if (activeTab !== 'calls' || !auth.currentUser) return undefined;

    let active = true;
    getCallHistoryApi()
      .then((data) => {
        if (active) setCallHistory(data.calls || []);
      })
      .catch((err) => {
        console.error('Failed to load call history:', err);
      })
      .finally(() => {
        if (active) setIsCallHistoryLoading(false);
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

      if (['messages', 'calls', 'contacts', 'settings'].includes(requestedTab)) {
        setActiveTab(requestedTab);
      }
      if (requestedConversation) {
        selectTab('messages');
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
  }, [auth.currentUser, selectConversation, selectTab]);

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
      selectTab('messages');
      selectConversation(conversationId);
    };

    window.addEventListener('pingme:open-conversation', handleOpenConversation);
    return () =>
      window.removeEventListener('pingme:open-conversation', handleOpenConversation);
  }, [selectConversation, selectTab]);

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
    <div
      className={`ambient flex h-full w-full overflow-hidden transition-[padding] duration-200 ${
        calls.activeCall && calls.isCallMinimized
          ? 'pt-[calc(3.25rem+env(safe-area-inset-top))]'
          : ''
      }`}
    >
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
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

      {activeTab === 'calls' && (
        <CallsView
          calls={callHistory}
          isLoading={isCallHistoryLoading}
          onRefreshCalls={loadCallHistory}
          onStartCall={calls.startCall}
          onSelectConversation={(id) => {
            setActiveTab('messages');
            chat.selectConversation(id);
          }}
        />
      )}

      {activeTab === 'contacts' && (
        <ContactsView
          contacts={chat.contacts}
          isLoading={chat.isContactsLoading || chat.isInitialDataLoading}
          onLoadUsers={chat.loadContacts}
          onStartChat={handleContactStart}
        />
      )}

      {activeTab === 'calls' && (
        <CallsView
          conversations={chat.conversations}
          currentUser={auth.currentUser}
          onStartCall={calls.startCall}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsView
          currentUser={auth.currentUser}
          activeSection={activeSettingsSection}
          onSectionChange={setActiveSettingsSection}
          onSectionBack={closeSettingsSection}
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
          onMinimize={() => calls.setIsCallMinimized(true)}
          onMaximize={() => calls.setIsCallMinimized(false)}
          onEnd={calls.endActiveCall}
        />
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
