'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DocumentSearchParams } from '@dms/shared';
import {
  documentsApi,
  type DocumentListItem,
  type DocumentDetail,
} from '@/lib/api';

export function useDocuments(params?: DocumentSearchParams) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: async () => {
      const response = await documentsApi.list(params);
      return response;
    },
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: async () => {
      const response = await documentsApi.get(id);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      mimeType: string;
      sizeBytes: number;
      folderId?: string;
    }) => {
      const response = await documentsApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; folderId?: string | null; metadata?: Record<string, unknown> };
    }) => {
      const response = await documentsApi.update(id, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents', variables.id] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await documentsApi.delete(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDocumentDownloadUrl(id: string) {
  return useQuery({
    queryKey: ['documents', id, 'download'],
    queryFn: async () => {
      const response = await documentsApi.getDownloadUrl(id);
      return response.data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes (before presigned URL expires)
  });
}

export function useProcessDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      operations,
    }: {
      id: string;
      operations: string[];
    }) => {
      const response = await documentsApi.process(id, operations);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.id] });
    },
  });
}

export function useMoveDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, folderId }: { id: string; folderId: string | null }) => {
      const response = await documentsApi.move(id, folderId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export function useCopyDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      folderId,
      newName,
    }: {
      id: string;
      folderId: string | null;
      newName?: string;
    }) => {
      const response = await documentsApi.copy(id, folderId, newName);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

// Type exports for consumers
export type { DocumentListItem, DocumentDetail };
