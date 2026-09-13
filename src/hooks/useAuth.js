"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMeApi, logoutApi } from "../services/api";
import {
  connectSocket,
  disconnectSocket,
  onSocketConnectionChange,
} from "../services/socket";
import {
  clearCachedUser,
  clearConversationSnapshot,
  getCachedUser,
  setCachedUser,
} from "../services/offlineCache";

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const currentUserRef = useRef(null);

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
    // Restore cached user asynchronously to allow hydration to complete smoothly
    queueMicrotask(() => {
      if (!active) return;
      const cached = getCachedUser();
      if (cached) {
        setCurrentUser(cached);
        currentUserRef.current = cached;
        setIsAuthLoading(false);
      }
    });

    // Remove tokens left by older builds; current sessions live only in an HttpOnly cookie.
    window.localStorage.removeItem("pulsechat_token");

    getMeApi()
      .then(({ user }) => {
        if (!active || !user) return;
        setCurrentUser(user);
        currentUserRef.current = user;
        setCachedUser(user);
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
    if (!currentUser) return undefined;

    const unsubscribe = onSocketConnectionChange(setIsBackendConnected);
    connectSocket();
    return () => {
      unsubscribe?.();
      setIsBackendConnected(false);
    };
  }, [currentUser]);

  useEffect(() => {
    const handleUnauthorized = () => clearSession();
    window.addEventListener("pingme:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("pingme:unauthorized", handleUnauthorized);
  }, [clearSession]);

  const handleLoginSuccess = useCallback((user) => {
    currentUserRef.current = user;
    setCachedUser(user);
    setCurrentUser(user);
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
