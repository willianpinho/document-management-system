'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, type UserPreferences } from '@/lib/api';

export function useUserPreferences() {
  return useQuery({
    queryKey: ['user', 'preferences'],
    queryFn: async () => {
      const response = await usersApi.getPreferences();
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: UserPreferences) => {
      const response = await usersApi.updatePreferences(preferences);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user', 'preferences'], data);
    },
  });
}

export type { UserPreferences };
