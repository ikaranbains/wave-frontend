'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMeApi, logoutApi } from '../services/api';
import {
  clearCachedUser,
  clearConversationSnapshot,
  getCachedUser,
  setCachedUser,
} from '../services/offlineCache';
import { connectSocket, disconnectSocket, reconnectSocket } from '../services/socket';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(() => getCachedUser());
  const [isAuthLoading, setIsAuthLoading] = useState(() => !getCachedUser());
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const currentUserRef = useRef(currentUser);

  const clearSession = useCallback(() => {
    const userId = currentUserRef.current?._id || currentUserRef.current?.id;
    disconnectSocket();
    clearCachedUser();
    clearConversationSnapshot(userId);
    currentUserRef.current = null;
    setCurrentUser(null);
    setIsBackendConnected(false);
  }, []);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    let active = true;
    // Remove tokens left by older builds; current sessions live only in an HttpOnly cookie.
    window.localStorage.removeItem('pulsechat_token');

    const verifySession = () => {
      getMeApi()
        .then(({ user }) => {
          if (!active || !user) return;
          currentUserRef.current = user;
          setCachedUser(user);
          setCurrentUser(user);
          setIsBackendConnected(true);
          connectSocket();
        })
        .catch((error) => {
          if (!active) return;
          if (error.response?.status === 401 || !currentUserRef.current) clearSession();
          else setIsBackendConnected(false);
        })
        .finally(() => {
          if (active) setIsAuthLoading(false);
        });
    };

    if (currentUserRef.current) connectSocket();
    verifySession();
    const reconnectOnFocus = () => {
      if (document.visibilityState === 'visible' && currentUserRef.current) reconnectSocket();
    };
    window.addEventListener('online', verifySession);
    document.addEventListener('visibilitychange', reconnectOnFocus);

    return () => {
      active = false;
      window.removeEventListener('online', verifySession);
      document.removeEventListener('visibilitychange', reconnectOnFocus);
    };
  }, [clearSession]);

  useEffect(() => {
    const handleUnauthorized = () => clearSession();
    window.addEventListener('pingme:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('pingme:unauthorized', handleUnauthorized);
  }, [clearSession]);

  const handleLoginSuccess = useCallback((user) => {
    currentUserRef.current = user;
    setCachedUser(user);
    setCurrentUser(user);
    setIsBackendConnected(true);
    connectSocket();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Clear local application state even if the backend is temporarily unreachable.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const updateCurrentUser = useCallback((user) => {
    currentUserRef.current = user;
    setCachedUser(user);
    setCurrentUser(user);
  }, []);

  return {
    currentUser,
    isAuthLoading,
    isBackendConnected,
    handleLoginSuccess,
    handleLogout,
    updateCurrentUser,
  };
}
