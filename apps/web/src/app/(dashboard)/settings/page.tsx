'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Lock,
  Bell,
  Shield,
  Palette,
  Building2,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Trash2,
  Loader2,
  Camera,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@dms/ui';
import { useAuth } from '@/hooks/useAuth';
import { usersApi, ApiError } from '@/lib/api';
import { getInitials } from '@/lib/utils';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Sync local state when user data loads
  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user?.name]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name?: string; avatarUrl?: string }) => {
      const response = await usersApi.updateProfile(data);
      return response.data;
    },
    onSuccess: () => {
      setUpdateError(null);
      setUpdateSuccess(true);
      // Invalidate auth query to refresh user data
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      setTimeout(() => setUpdateSuccess(false), 5000);
    },
    onError: (error: ApiError) => {
      setUpdateSuccess(false);
      setUpdateError(error.message || 'Failed to update profile');
    },
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError(null);
    setUpdateSuccess(false);

    if (!name.trim()) {
      setUpdateError('Name is required');
      return;
    }

    updateProfileMutation.mutate({ name: name.trim() });
  };

  const handleChangeAvatar = async () => {
    if (!avatarUrl.trim()) return;

    updateProfileMutation.mutate({ avatarUrl: avatarUrl.trim() });
    setShowAvatarDialog(false);
    setAvatarUrl('');
  };

  const handleExportData = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      // Request data export from API
      const response = await usersApi.exportData();

      // Create a blob from the response and download it
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dms-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setShowExportDialog(false);
    } catch (error) {
      const apiError = error as ApiError;
      setExportError(apiError.message || 'Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await usersApi.deleteAccount();
      // Logout and redirect to home
      await logout();
    } catch (error) {
      const apiError = error as ApiError;
      setDeleteError(apiError.message || 'Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  const settingsSections = [
    {
      title: 'Notifications',
      description: 'Configure how you receive notifications',
      icon: Bell,
      href: '/settings/notifications',
    },
    {
      title: 'Security',
      description: 'Manage your password and security settings',
      icon: Shield,
      href: '/settings/security',
    },
    {
      title: 'Appearance',
      description: 'Customize the look and feel',
      icon: Palette,
      href: '/settings/appearance',
    },
    {
      title: 'Organization',
      description: 'Manage organization settings and members',
      icon: Building2,
      href: '/settings/organization',
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile section */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                {updateError && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <XCircle className="h-4 w-4" />
                    {updateError}
                  </div>
                )}

                {updateSuccess && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/20 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Profile updated successfully!
                  </div>
                )}

                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user?.name || 'User'} />}
                      <AvatarFallback className="text-lg">
                        {user?.name ? getInitials(user.name) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAvatarUrl(user?.avatarUrl || '');
                        setShowAvatarDialog(true);
                      }}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Change avatar
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enter a URL to your profile picture.
                    </p>
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Full name
                  </label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    disabled={updateProfileMutation.isPending}
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Contact support to change your email address
                  </p>
                </div>

                <Button type="submit" disabled={updateProfileMutation.isPending}>
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save changes'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Password section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Password & Security
              </CardTitle>
              <CardDescription>
                Change your password, manage sessions, or enable two-factor authentication
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Manage your password and security settings from the dedicated security page.
              </p>
              <Button asChild>
                <Link href="/settings/security">
                  Go to Security Settings
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick settings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {settingsSections.map((section) => (
                  <Link
                    key={section.href}
                    href={section.href}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <section.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{section.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger zone</CardTitle>
              <CardDescription>
                Irreversible actions for your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowExportDialog(true)}
              >
                <Download className="mr-2 h-4 w-4" />
                Export my data
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete my account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Change Avatar Dialog */}
      <Dialog open={showAvatarDialog} onOpenChange={(open) => {
        if (!open) {
          setAvatarUrl('');
        }
        setShowAvatarDialog(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Avatar</DialogTitle>
            <DialogDescription>
              Enter a URL to your profile picture. Use services like Gravatar, GitHub, or any public image URL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <Avatar className="h-24 w-24">
                {(avatarUrl || user?.avatarUrl) && <AvatarImage src={avatarUrl || user?.avatarUrl || ''} alt="Preview" />}
                <AvatarFallback className="text-xl">
                  {user?.name ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="space-y-2">
              <label htmlFor="avatarUrl" className="text-sm font-medium">
                Image URL
              </label>
              <Input
                id="avatarUrl"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/your-avatar.jpg"
              />
              <p className="text-xs text-muted-foreground">
                Tip: Use your Gravatar URL or GitHub avatar (https://github.com/username.png)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAvatarDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangeAvatar} disabled={!avatarUrl.trim() || updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? 'Saving...' : 'Save Avatar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Data Dialog */}
      <Dialog open={showExportDialog} onOpenChange={(open) => {
        if (!open) {
          setExportError(null);
        }
        setShowExportDialog(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Your Data</DialogTitle>
            <DialogDescription>
              Download a copy of all your data, including documents, folders, and account information.
            </DialogDescription>
          </DialogHeader>
          {exportError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              {exportError}
            </div>
          )}
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Your data export will include:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Profile information</li>
              <li>Document metadata</li>
              <li>Folder structure</li>
              <li>Activity history</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleExportData} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Export
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmText('');
          setDeleteError(null);
        }
        setShowDeleteDialog(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              {deleteError}
            </div>
          )}
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-destructive/10 p-4">
              <p className="text-sm font-medium text-destructive">
                Warning: You will lose access to:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-destructive/80">
                <li>All uploaded documents</li>
                <li>All folders and organization</li>
                <li>Processing history and AI analysis</li>
                <li>Account settings and preferences</li>
              </ul>
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmDelete" className="text-sm font-medium">
                Type <span className="font-bold">DELETE</span> to confirm
              </label>
              <Input
                id="confirmDelete"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="border-destructive/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE' || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete My Account'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
