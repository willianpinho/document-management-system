'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  authApi,
  organizationsApi,
  setAuthTokens,
  clearAuthTokens,
  setCurrentOrganizationId,
  getCurrentOrganizationId,
} from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
}

interface AuthState {
  user: User | null;
  currentOrganization: Organization | null;
  organizations: Organization[];
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setCurrentOrganization: (org: Organization | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      currentOrganization: null,
      organizations: [],
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setOrganizations: (organizations) => set({ organizations }),
      setCurrentOrganization: (org) => {
        if (org) {
          setCurrentOrganizationId(org.id);
        }
        set({ currentOrganization: org });
      },
      logout: () => {
        clearAuthTokens();
        set({ user: null, currentOrganization: null, organizations: [], isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        currentOrganization: state.currentOrganization,
        organizations: state.organizations,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    user,
    currentOrganization,
    organizations,
    isAuthenticated,
    setUser,
    setOrganizations,
    setCurrentOrganization,
    logout: storeLogout,
  } = useAuthStore();

  // Fetch user info
  const { isLoading: isLoadingUser, refetch: refetchUser } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await authApi.me();
      setUser(response.data);
      return response.data;
    },
    enabled: typeof window !== 'undefined' && !!localStorage.getItem('accessToken'),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch organizations
  const { isLoading: isLoadingOrgs, refetch: refetchOrgs } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await organizationsApi.list();
      const orgs = response.data;
      setOrganizations(orgs);

      // Auto-select first organization if none selected
      if (orgs.length > 0 && !getCurrentOrganizationId()) {
        setCurrentOrganization(orgs[0]);
      } else if (getCurrentOrganizationId()) {
        // Restore previously selected organization
        const savedOrg = orgs.find((o) => o.id === getCurrentOrganizationId());
        if (savedOrg) {
          setCurrentOrganization(savedOrg);
        } else if (orgs.length > 0) {
          setCurrentOrganization(orgs[0]);
        }
      }

      return orgs;
    },
    enabled: typeof window !== 'undefined' && !!localStorage.getItem('accessToken'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await authApi.login(email, password);
      return response.data;
    },
    onSuccess: async (data) => {
      setAuthTokens(data.accessToken, data.refreshToken);
      await refetchUser();
      await refetchOrgs();
      router.push('/documents');
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({
      name,
      email,
      password,
    }: {
      name: string;
      email: string;
      password: string;
    }) => {
      const response = await authApi.register(name, email, password);
      return response.data;
    },
    onSuccess: async (data) => {
      setAuthTokens(data.accessToken, data.refreshToken);
      await refetchUser();
      await refetchOrgs();
      router.push('/documents');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout();
      } catch {
        // Ignore logout errors
      }
    },
    onSettled: () => {
      storeLogout();
      queryClient.clear();
      router.push('/login');
    },
  });

  return {
    user,
    currentOrganization,
    organizations,
    isAuthenticated,
    isLoading: isLoadingUser || isLoadingOrgs,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync,
    registerError: registerMutation.error,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    setCurrentOrganization,
    refetchOrganizations: refetchOrgs,
  };
}
