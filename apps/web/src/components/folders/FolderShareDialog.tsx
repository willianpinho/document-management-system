'use client';

import { useState, useCallback } from 'react';
import {
  Copy,
  Check,
  Users,
  Globe,
  Lock,
  X,
  Mail,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Shield,
  Calendar,
  Key,
  Hash,
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
  Avatar,
  AvatarFallback,
  AvatarImage,
  Switch,
  Checkbox,
} from '@dms/ui';
import { cn } from '@/lib/utils';
import type {
  FolderShareUser,
  FolderShareLink,
  InheritedShare,
  SharePermission,
} from '@/hooks/useFolderShare';

interface FolderShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  folderName: string;
  shares?: { users: FolderShareUser[]; link: FolderShareLink | null };
  inheritedShares?: InheritedShare[];
  onShareWithUser: (data: {
    email: string;
    permission: SharePermission;
    canShare?: boolean;
  }) => Promise<FolderShareUser>;
  onRemoveUser: (userId: string) => Promise<void>;
  onUpdateShare: (data: {
    userId: string;
    permission?: SharePermission;
    canShare?: boolean;
  }) => Promise<unknown>;
  onCreateLink: (data: {
    permission: SharePermission;
    expiresAt?: string;
    password?: string;
    maxUses?: number;
  }) => Promise<FolderShareLink>;
  onDeleteLink: () => Promise<void>;
  onCopyLink: () => void;
  getShareUrl: (token: string) => string;
  isLoading?: boolean;
  isSharing?: boolean;
  isCreatingLink?: boolean;
  linkCopied?: boolean;
}

const permissionLabels: Record<SharePermission, { label: string; description: string }> = {
  VIEW: { label: 'Can view', description: 'View folder contents' },
  EDIT: { label: 'Can edit', description: 'View, add, edit, and delete contents' },
  ADMIN: { label: 'Admin', description: 'Full control including sharing' },
};

export function FolderShareDialog({
  open,
  onOpenChange,
  folderId,
  folderName,
  shares,
  inheritedShares,
  onShareWithUser,
  onRemoveUser,
  onUpdateShare,
  onCreateLink,
  onDeleteLink,
  onCopyLink,
  getShareUrl,
  isLoading,
  isSharing,
  isCreatingLink,
  linkCopied,
}: FolderShareDialogProps) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<SharePermission>('VIEW');
  const [canShare, setCanShare] = useState(false);
  const [linkEnabled, setLinkEnabled] = useState(!!shares?.link);
  const [linkPermission, setLinkPermission] = useState<SharePermission>('VIEW');
  const [linkExpiry, setLinkExpiry] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkMaxUses, setLinkMaxUses] = useState('');
  const [showAdvancedLink, setShowAdvancedLink] = useState(false);
  const [expandedInherited, setExpandedInherited] = useState<string[]>([]);

  const handleShare = useCallback(async () => {
    if (!email.trim()) return;

    try {
      await onShareWithUser({
        email: email.trim(),
        permission,
        canShare,
      });
      setEmail('');
      setPermission('VIEW');
      setCanShare(false);
    } catch {
      // Error handled by parent
    }
  }, [email, permission, canShare, onShareWithUser]);

  const handleToggleLink = useCallback(async (enabled: boolean) => {
    setLinkEnabled(enabled);
    if (enabled && !shares?.link) {
      try {
        await onCreateLink({
          permission: linkPermission,
          expiresAt: linkExpiry || undefined,
          password: linkPassword || undefined,
          maxUses: linkMaxUses ? parseInt(linkMaxUses, 10) : undefined,
        });
      } catch {
        setLinkEnabled(false);
      }
    } else if (!enabled && shares?.link) {
      await onDeleteLink();
    }
  }, [shares?.link, linkPermission, linkExpiry, linkPassword, linkMaxUses, onCreateLink, onDeleteLink]);

  const toggleInheritedExpand = (folderId: string) => {
    setExpandedInherited((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  const shareUrl = shares?.link
    ? getShareUrl(shares.link.token)
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Share &quot;{folderName}&quot;
          </DialogTitle>
          <DialogDescription>
            Share this folder with other users or create a public link.
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
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="canShare"
                  checked={canShare}
                  onCheckedChange={(checked) => setCanShare(checked as boolean)}
                />
                <Label htmlFor="canShare" className="text-sm text-muted-foreground">
                  Allow user to share with others
                </Label>
              </div>
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
          {shares && shares.users.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">People with access</Label>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
                {shares.users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatarUrl || undefined} alt={user.name || user.email} />
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
                      {user.canShare && (
                        <Shield className="h-3 w-3 text-blue-500" aria-label="Can share" />
                      )}
                      <select
                        value={user.permission}
                        onChange={(e) =>
                          onUpdateShare({
                            userId: user.id,
                            permission: e.target.value as SharePermission,
                          })
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

          {/* Inherited shares */}
          {inheritedShares && inheritedShares.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <Label className="text-sm font-medium text-muted-foreground">
                Inherited access from parent folders
              </Label>
              <div className="space-y-1 rounded-md border p-2">
                {inheritedShares.map((inherited) => (
                  <div key={inherited.folderId}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded p-2 text-sm hover:bg-muted"
                      onClick={() => toggleInheritedExpand(inherited.folderId)}
                    >
                      {expandedInherited.includes(inherited.folderId) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{inherited.folderName}</span>
                      <span className="text-xs text-muted-foreground">
                        ({inherited.users.length} user{inherited.users.length !== 1 ? 's' : ''})
                      </span>
                    </button>
                    {expandedInherited.includes(inherited.folderId) && (
                      <div className="ml-6 space-y-1 border-l pl-4">
                        {inherited.users.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center gap-2 py-1 text-sm text-muted-foreground"
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={user.avatarUrl || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {(user.name?.[0] || user.email?.[0] || '?').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{user.name || user.email}</span>
                            <span className="text-xs">({permissionLabels[user.permission]?.label || user.permission})</span>
                          </div>
                        ))}
                      </div>
                    )}
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

            {linkEnabled && !shares?.link && !isCreatingLink && (
              <div className="space-y-3 rounded-md bg-muted p-3">
                <div className="grid gap-3">
                  <div>
                    <Label className="text-xs">Permission</Label>
                    <select
                      value={linkPermission}
                      onChange={(e) => setLinkPermission(e.target.value as SharePermission)}
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      {Object.entries(permissionLabels).map(([key, { label }]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAdvancedLink(!showAdvancedLink)}
                  >
                    {showAdvancedLink ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Advanced options
                  </button>

                  {showAdvancedLink && (
                    <div className="space-y-3 border-t pt-3">
                      <div>
                        <Label className="flex items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3" /> Expiration date
                        </Label>
                        <Input
                          type="datetime-local"
                          value={linkExpiry}
                          onChange={(e) => setLinkExpiry(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="flex items-center gap-1 text-xs">
                          <Key className="h-3 w-3" /> Password protection
                        </Label>
                        <Input
                          type="password"
                          placeholder="Optional password"
                          value={linkPassword}
                          onChange={(e) => setLinkPassword(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="flex items-center gap-1 text-xs">
                          <Hash className="h-3 w-3" /> Max uses
                        </Label>
                        <Input
                          type="number"
                          placeholder="Unlimited"
                          min={1}
                          value={linkMaxUses}
                          onChange={(e) => setLinkMaxUses(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => handleToggleLink(true)}
                    className="w-full"
                    disabled={isCreatingLink}
                  >
                    Create Link
                  </Button>
                </div>
              </div>
            )}

            {linkEnabled && shares?.link && (
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
                    onClick={onCopyLink}
                  >
                    {linkCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    <span>{permissionLabels[shares.link.permission].label}</span>
                  </div>
                  {shares.link.hasPassword && (
                    <div className="flex items-center gap-1">
                      <Key className="h-3 w-3" />
                      <span>Password protected</span>
                    </div>
                  )}
                  {shares.link.expiresAt && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Expires {new Date(shares.link.expiresAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {shares.link.maxUses && (
                    <div className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      <span>{shares.link.useCount}/{shares.link.maxUses} uses</span>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={onDeleteLink}
                >
                  Remove link
                </Button>
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
