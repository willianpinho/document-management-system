'use client';

import { useQuery } from '@tanstack/react-query';
import { storageApi } from '@/lib/api';
import { useAuth } from './useAuth';

export interface StorageStats {
  usedBytes: number;
  quotaBytes: number;
  usagePercent: number;
}

export function useStorageStats() {
  const { currentOrganization } = useAuth();

  return useQuery({
    queryKey: ['storage', 'stats', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) {
        return null;
      }
      const response = await storageApi.getStats(currentOrganization.id);
      return response.data as StorageStats;
    },
    enabled: !!currentOrganization?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
  });
}
