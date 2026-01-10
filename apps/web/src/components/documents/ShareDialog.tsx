'use client';

import { useState, useCallback } from 'react';
import {
  Link2,
  Copy,
  Check,
  Users,
  Globe,
  Lock,
  X,
  Mail,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Badge,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Switch,
} from '@dms/ui';
import { cn } from '@/lib/utils';

export type SharePermission = 'VIEW' | 'COMMENT' | 'EDIT';

export interface SharedUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  permission: SharePermission;
}

export interface ShareLink {
  id: string;
  token: string;
  permission: SharePermission;
  expiresAt?: string;
  downloadCount: number;
  maxDownloads?: number;
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  sharedUsers?: SharedUser[];
  shareLink?: ShareLink | null;
  onShareWithUser: (email: string, permission: SharePermission) => Promise<void>;
  onRemoveUser: (userId: string) => Promise<void>;
  onUpdatePermission: (userId: string, permission: SharePermission) => Promise<void>;
  onCreateLink: (permission: SharePermission) => Promise<void>;
  onDeleteLink: () => Promise<void>;
  isLoading?: boolean;
}

const permissionLabels: Record<SharePermission, { label: string; description: string }> = {
  VIEW: { label: 'Can view', description: 'Can view and download' },
  COMMENT: { label: 'Can comment', description: 'Can view, download, and comment' },
  EDIT: { label: 'Can edit', description: 'Can view, download, and edit' },
};

export function ShareDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
  sharedUsers = [],
  shareLink,
  onShareWithUser,
  onRemoveUser,
  onUpdatePermission,
  onCreateLink,
  onDeleteLink,
  isLoading,
}: ShareDialogProps) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<SharePermission>('VIEW');
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkEnabled, setLinkEnabled] = useState(!!shareLink);
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  const handleShare = useCallback(async () => {
    if (!email.trim()) return;

    setIsSharing(true);
    try {
      await onShareWithUser(email.trim(), permission);
      setEmail('');
    } finally {
      setIsSharing(false);
    }
  }, [email, permission, onShareWithUser]);

  const handleCopyLink = useCallback(async () => {
    if (!shareLink) return;

    const url = `${window.location.origin}/share/${shareLink.token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareLink]);

  const handleToggleLink = useCallback(async (enabled: boolean) => {
    setLinkEnabled(enabled);
    if (enabled && !shareLink) {
      setIsCreatingLink(true);
      try {
        await onCreateLink('VIEW');
      } finally {
        setIsCreatingLink(false);
      }
    } else if (!enabled && shareLink) {
      await onDeleteLink();
    }
  }, [shareLink, onCreateLink, onDeleteLink]);

  const shareUrl = shareLink
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${shareLink.token}`
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Share &quot;{documentName}&quot;
          </DialogTitle>
          <DialogDescription>
            Share this document with other users or create a public link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Share with users */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Share with people</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleShare();
                  }}
                />
              </div>
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as SharePermission)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                {Object.entries(permissionLabels).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleShare}
                disabled={!email.trim() || isSharing}
                size="sm"
              >
                {isSharing ? 'Sharing...' : 'Share'}
              </Button>
            </div>
          </div>

          {/* Shared users list */}
          {sharedUsers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">People with access</Label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                {sharedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatarUrl} alt={user.name || user.email} />
                        <AvatarFallback>
                          {(user.name?.[0] || user.email?.[0] || '?').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {user.name || user.email}
                        </p>
                        {user.name && (
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={user.permission}
                        onChange={(e) =>
                          onUpdatePermission(user.id, e.target.value as SharePermission)
                        }
                        className="rounded border bg-background px-2 py-1 text-xs"
                      >
                        {Object.entries(permissionLabels).map(([key, { label }]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveUser(user.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link sharing */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Share via link</Label>
              </div>
              <Switch
                checked={linkEnabled}
                onCheckedChange={handleToggleLink}
                disabled={isCreatingLink || isLoading}
              />
            </div>

            {linkEnabled && shareLink && (
              <div className="space-y-3 rounded-md bg-muted p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="bg-background text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3 w-3" />
                    <span>Anyone with the link can view</span>
                  </div>
                  {shareLink.downloadCount > 0 && (
                    <span>{shareLink.downloadCount} downloads</span>
                  )}
                </div>
              </div>
            )}

            {isCreatingLink && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                Creating share link...
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
