'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { foldersApi } from '@/lib/api';

export type SharePermission = 'VIEW' | 'EDIT' | 'ADMIN';

export interface FolderShareUser {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  permission: SharePermission;
  canShare: boolean;
  sharedAt: string;
}

export interface FolderShareLink {
  id: string;
  token: string;
  permission: SharePermission;
  expiresAt?: string | null;
  hasPassword: boolean;
  maxUses?: number | null;
  useCount: number;
  createdAt: string;
}

export interface FolderShares {
  users: FolderShareUser[];
  link: FolderShareLink | null;
}

export interface InheritedShare {
  folderId: string;
  folderName: string;
  users: FolderShareUser[];
}

export interface UseFolderShareOptions {
  folderId: string;
  enabled?: boolean;
  onShareSuccess?: () => void;
  onShareError?: (error: Error) => void;
}

export function useFolderShare({
  folderId,
  enabled = true,
  onShareSuccess,
  onShareError,
}: UseFolderShareOptions) {
  const queryClient = useQueryClient();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Query to get current shares
  const {
    data: shares,
    isLoading: isLoadingShares,
    error: sharesError,
    refetch: refetchShares,
  } = useQuery({
    queryKey: ['folder-shares', folderId],
    queryFn: async () => {
      const response = await foldersApi.getShares(folderId);
      return response.data as FolderShares;
    },
    enabled: enabled && !!folderId,
  });

  // Query to get inherited shares
  const {
    data: inheritedShares,
    isLoading: isLoadingInherited,
  } = useQuery({
    queryKey: ['folder-inherited-shares', folderId],
    queryFn: async () => {
      const response = await foldersApi.getInheritedShares(folderId);
      return response.data as InheritedShare[];
    },
    enabled: enabled && !!folderId,
  });

  // Mutation to share with user
  const shareWithUserMutation = useMutation({
    mutationFn: async ({
      email,
      permission,
      canShare = false,
    }: {
      email: string;
      permission: SharePermission;
      canShare?: boolean;
    }) => {
      const response = await foldersApi.shareWithUser(folderId, {
        email,
        permission,
        canShare,
      });
      return response.data as FolderShareUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-shares', folderId] });
      onShareSuccess?.();
    },
    onError: (error) => {
      onShareError?.(error as Error);
    },
  });

  // Mutation to update share
  const updateShareMutation = useMutation({
    mutationFn: async ({
      userId,
      permission,
      canShare,
    }: {
      userId: string;
      permission?: SharePermission;
      canShare?: boolean;
    }) => {
      const response = await foldersApi.updateShare(folderId, userId, {
        permission,
        canShare,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-shares', folderId] });
    },
  });

  // Mutation to remove share
  const removeShareMutation = useMutation({
    mutationFn: async (userId: string) => {
      await foldersApi.removeShare(folderId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-shares', folderId] });
    },
  });

  // Mutation to create share link
  const createShareLinkMutation = useMutation({
    mutationFn: async ({
      permission,
      expiresAt,
      password,
      maxUses,
    }: {
      permission: SharePermission;
      expiresAt?: string;
      password?: string;
      maxUses?: number;
    }) => {
      const response = await foldersApi.createShareLink(folderId, {
        permission,
        expiresAt,
        password,
        maxUses,
      });
      return response.data as FolderShareLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-shares', folderId] });
    },
  });

  // Mutation to delete share link
  const deleteShareLinkMutation = useMutation({
    mutationFn: async () => {
      await foldersApi.deleteShareLink(folderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-shares', folderId] });
    },
  });

  // Helper to generate share URL
  const getShareUrl = useCallback((token: string) => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/shared/folder/${token}`;
  }, []);

  // Helper to copy share link
  const copyShareLink = useCallback(async () => {
    if (!shares?.link) return;

    const url = getShareUrl(shares.link.token);
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  }, [shares?.link, getShareUrl]);

  // Computed values
  const hasShares = (shares?.users.length ?? 0) > 0 || shares?.link !== null;
  const hasInheritedShares = (inheritedShares?.length ?? 0) > 0;
  const isProcessing =
    shareWithUserMutation.isPending ||
    updateShareMutation.isPending ||
    removeShareMutation.isPending ||
    createShareLinkMutation.isPending ||
    deleteShareLinkMutation.isPending;

  return {
    // State
    shares,
    inheritedShares,
    shareDialogOpen,
    linkCopied,

    // Loading states
    isLoadingShares,
    isLoadingInherited,
    isProcessing,

    // Errors
    sharesError,

    // Actions
    openShareDialog: () => setShareDialogOpen(true),
    closeShareDialog: () => setShareDialogOpen(false),
    shareWithUser: shareWithUserMutation.mutateAsync,
    updateShare: updateShareMutation.mutateAsync,
    removeShare: removeShareMutation.mutateAsync,
    createShareLink: createShareLinkMutation.mutateAsync,
    deleteShareLink: deleteShareLinkMutation.mutateAsync,
    refetchShares,
    copyShareLink,
    getShareUrl,

    // Computed
    hasShares,
    hasInheritedShares,

    // Mutation states for UI feedback
    isSharing: shareWithUserMutation.isPending,
    isUpdating: updateShareMutation.isPending,
    isRemoving: removeShareMutation.isPending,
    isCreatingLink: createShareLinkMutation.isPending,
    isDeletingLink: deleteShareLinkMutation.isPending,
  };
}

export type UseFolderShareReturn = ReturnType<typeof useFolderShare>;
