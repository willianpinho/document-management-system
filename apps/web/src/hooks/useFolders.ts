'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PaginationParams, SortParams } from '@dms/shared';
import {
  foldersApi,
  type FolderListItem,
  type FolderDetail,
  type FolderTreeItem,
} from '@/lib/api';

export function useFolders(
  params?: PaginationParams & SortParams & { parentId?: string }
) {
  return useQuery({
    queryKey: ['folders', params],
    queryFn: async () => {
      const response = await foldersApi.list(params);
      return response;
    },
  });
}

export function useFolder(id: string) {
  return useQuery({
    queryKey: ['folders', id],
    queryFn: async () => {
      const response = await foldersApi.get(id);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useFolderTree() {
  return useQuery({
    queryKey: ['folders', 'tree'],
    queryFn: async () => {
      const response = await foldersApi.getTree();
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; parentId?: string }) => {
      const response = await foldersApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; parentId?: string | null };
    }) => {
      const response = await foldersApi.update(id, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['folders', variables.id] });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await foldersApi.delete(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useMoveFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, parentId }: { id: string; parentId: string | null }) => {
      const response = await foldersApi.move(id, parentId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

// Type exports for consumers
export type { FolderListItem, FolderDetail, FolderTreeItem };
