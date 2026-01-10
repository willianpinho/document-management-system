'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi, type OrganizationMember, type ApiKey, type ApiKeyCreated } from '@/lib/api';
import { useAuth } from './useAuth';

export function useOrganizationMembers() {
  const { currentOrganization } = useAuth();

  return useQuery({
    queryKey: ['organization', currentOrganization?.id, 'members'],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const response = await organizationsApi.getMembers(currentOrganization.id);
      return response.data;
    },
    enabled: !!currentOrganization?.id,
  });
}

export function useOrganizationDetails() {
  const { currentOrganization } = useAuth();

  return useQuery({
    queryKey: ['organization', currentOrganization?.id, 'details'],
    queryFn: async () => {
      if (!currentOrganization?.id) return null;
      const response = await organizationsApi.get(currentOrganization.id);
      return response.data;
    },
    enabled: !!currentOrganization?.id,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();

  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role?: string }) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');
      const response = await organizationsApi.inviteMember(
        currentOrganization.id,
        email,
        role
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['organization', currentOrganization?.id, 'members'],
      });
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();

  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');
      const response = await organizationsApi.updateMemberRole(
        currentOrganization.id,
        memberId,
        role
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['organization', currentOrganization?.id, 'members'],
      });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();

  return useMutation({
    mutationFn: async (memberId: string) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');
      await organizationsApi.removeMember(currentOrganization.id, memberId);
      return memberId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['organization', currentOrganization?.id, 'members'],
      });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();

  return useMutation({
    mutationFn: async (data: { name?: string }) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');
      const response = await organizationsApi.update(currentOrganization.id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['organization', currentOrganization?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['organizations'],
      });
    },
  });
}

// =============================================================================
// API KEYS HOOKS
// =============================================================================

export function useApiKeys() {
  const { currentOrganization } = useAuth();

  return useQuery({
    queryKey: ['organization', currentOrganization?.id, 'api-keys'],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const response = await organizationsApi.getApiKeys(currentOrganization.id);
      return response.data;
    },
    enabled: !!currentOrganization?.id,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();

  return useMutation({
    mutationFn: async (data: { name: string; scopes?: string[]; expiresAt?: string }) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');
      const response = await organizationsApi.createApiKey(currentOrganization.id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['organization', currentOrganization?.id, 'api-keys'],
      });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();

  return useMutation({
    mutationFn: async (keyId: string) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');
      const response = await organizationsApi.revokeApiKey(currentOrganization.id, keyId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['organization', currentOrganization?.id, 'api-keys'],
      });
    },
  });
}

export type { OrganizationMember, ApiKey, ApiKeyCreated };
