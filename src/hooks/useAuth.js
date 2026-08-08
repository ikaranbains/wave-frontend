'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMeApi, logoutApi } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  const clearSession = useCallback(() => {
    disconnectSocket();
    setCurrentUser(null);
    setIsBackendConnected(false);
  }, []);

  useEffect(() => {
    let active = true;
    // Remove tokens left by older builds; current sessions live only in an HttpOnly cookie.
    window.localStorage.removeItem('pulsechat_token');

    getMeApi()
      .then(({ user }) => {
        if (!active || !user) return;
        setCurrentUser(user);
        setIsBackendConnected(true);
        connectSocket();
      })
      .catch(() => {
        if (active) clearSession();
      })
      .finally(() => {
        if (active) setIsAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, [clearSession]);

  useEffect(() => {
    const handleUnauthorized = () => clearSession();
    window.addEventListener('pingme:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('pingme:unauthorized', handleUnauthorized);
  }, [clearSession]);

  const handleLoginSuccess = useCallback((user) => {
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
