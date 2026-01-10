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

// ============================================================================
// SHARING HOOKS
// ============================================================================

export interface SharedUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  permission: 'VIEW' | 'COMMENT' | 'EDIT';
}

export interface ShareLink {
  id: string;
  token: string;
  permission: 'VIEW' | 'COMMENT' | 'EDIT';
  expiresAt?: string;
  downloadCount: number;
  maxDownloads?: number;
}

export function useDocumentShares(documentId: string) {
  return useQuery({
    queryKey: ['documents', documentId, 'shares'],
    queryFn: async () => {
      const response = await documentsApi.getShares(documentId);
      return response.data as { users: SharedUser[]; link: ShareLink | null };
    },
    enabled: !!documentId,
  });
}

export function useShareDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      email,
      permission,
    }: {
      documentId: string;
      email: string;
      permission: 'VIEW' | 'COMMENT' | 'EDIT';
    }) => {
      const response = await documentsApi.share(documentId, { email, permission });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['documents', variables.documentId, 'shares'],
      });
    },
  });
}

export function useRemoveShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      userId,
    }: {
      documentId: string;
      userId: string;
    }) => {
      await documentsApi.removeShare(documentId, userId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['documents', variables.documentId, 'shares'],
      });
    },
  });
}

export function useUpdateSharePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      userId,
      permission,
    }: {
      documentId: string;
      userId: string;
      permission: 'VIEW' | 'COMMENT' | 'EDIT';
    }) => {
      const response = await documentsApi.updateSharePermission(
        documentId,
        userId,
        permission
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['documents', variables.documentId, 'shares'],
      });
    },
  });
}

export function useCreateShareLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      permission,
    }: {
      documentId: string;
      permission: 'VIEW' | 'COMMENT' | 'EDIT';
    }) => {
      const response = await documentsApi.createShareLink(documentId, permission);
      return response.data as ShareLink;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['documents', variables.documentId, 'shares'],
      });
    },
  });
}

export function useDeleteShareLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      await documentsApi.deleteShareLink(documentId);
    },
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({
        queryKey: ['documents', documentId, 'shares'],
      });
    },
  });
}

// ============================================================================
// VERSION HISTORY HOOKS
// ============================================================================

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  sizeBytes: number;
  checksum?: string;
  changeNote?: string;
  createdAt: string;
  createdBy?: {
    id: string;
    name?: string;
    email: string;
    avatarUrl?: string;
  };
}

export function useDocumentVersions(documentId: string) {
  return useQuery({
    queryKey: ['documents', documentId, 'versions'],
    queryFn: async () => {
      const response = await documentsApi.getVersions(documentId);
      return response.data as DocumentVersion[];
    },
    enabled: !!documentId,
  });
}

export function useDownloadVersion() {
  return useMutation({
    mutationFn: async ({
      documentId,
      versionId,
    }: {
      documentId: string;
      versionId: string;
    }) => {
      const response = await documentsApi.getVersionDownloadUrl(documentId, versionId);
      return response.data as { url: string };
    },
  });
}

export function useRestoreVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      versionId,
    }: {
      documentId: string;
      versionId: string;
    }) => {
      const response = await documentsApi.restoreVersion(documentId, versionId);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.documentId] });
      queryClient.invalidateQueries({
        queryKey: ['documents', variables.documentId, 'versions'],
      });
    },
  });
}

// Type exports for consumers
export type { DocumentListItem, DocumentDetail };
