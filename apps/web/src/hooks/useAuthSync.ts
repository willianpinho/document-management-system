'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import { setAuthTokens, clearAuthTokens } from '@/lib/api';
import { useAuthStore } from './useAuth';

/**
 * Hook that syncs NextAuth session tokens to localStorage for API client compatibility.
 * This bridges the gap between NextAuth's session management and the API client's
 * localStorage-based token storage.
 */
export function useAuthSync() {
  const { data: session, status } = useSession();
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  // Track if we've already synced to avoid duplicate calls
  const lastSyncedStatus = useRef<string | null>(null);
  const lastSyncedToken = useRef<string | null>(null);

  useEffect(() => {
    // Avoid re-running if status and token haven't changed
    const currentToken = session?.accessToken || null;
    if (lastSyncedStatus.current === status && lastSyncedToken.current === currentToken) {
      return;
    }

    if (status === 'authenticated' && session?.accessToken) {
      // Sync NextAuth tokens to localStorage for API client
      const refreshToken = (session as { refreshToken?: string }).refreshToken || '';
      setAuthTokens(session.accessToken, refreshToken);

      // Sync user info to Zustand store if available
      if (session.user) {
        setUser({
          id: (session.user as { id?: string }).id || '',
          email: session.user.email || '',
          name: session.user.name || null,
          avatarUrl: session.user.image || null,
        });
      }

      lastSyncedStatus.current = status;
      lastSyncedToken.current = session.accessToken;
    } else if (status === 'unauthenticated' && lastSyncedStatus.current !== 'unauthenticated') {
      // Only clear if we were previously authenticated or this is first run
      // This prevents clearing on auth pages where user is intentionally unauthenticated
      if (lastSyncedStatus.current === 'authenticated') {
        clearAuthTokens();
        logout();
      }
      lastSyncedStatus.current = status;
      lastSyncedToken.current = null;
    }
  }, [session, status, setUser, logout]);

  return { session, status };
}
