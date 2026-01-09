'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { setAuthTokens, clearAuthTokens } from '@/lib/api';
import { useAuthStore } from './useAuth';

/**
 * Hook that syncs NextAuth session tokens to localStorage for API client compatibility.
 * This bridges the gap between NextAuth's session management and the API client's
 * localStorage-based token storage.
 */
export function useAuthSync() {
  const { data: session, status } = useSession();
  const { setUser, logout: storeLogout } = useAuthStore();

  useEffect(() => {
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
    } else if (status === 'unauthenticated') {
      clearAuthTokens();
      storeLogout();
    }
  }, [session, status, setUser, storeLogout]);

  return { session, status };
}
