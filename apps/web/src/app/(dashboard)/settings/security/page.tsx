'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Shield,
  Key,
  Smartphone,
  Monitor,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Switch,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@dms/ui';
import { authApi, ApiError, type Session } from '@/lib/api';

export default function SecuritySettingsPage() {
  const queryClient = useQueryClient();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Fetch active sessions
  const { data: sessions, isLoading: isLoadingSessions } = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: async () => {
      const response = await authApi.getSessions();
      return response.data;
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const response = await authApi.changePassword(currentPassword, newPassword);
      return response.data;
    },
    onSuccess: () => {
      setPasswordError(null);
      setPasswordSuccess(true);
      formRef.current?.reset();
      // Refresh sessions after password change (they might be revoked)
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      setTimeout(() => setPasswordSuccess(false), 5000);
    },
    onError: (error: ApiError) => {
      setPasswordSuccess(false);
      setPasswordError(error.message || 'Failed to change password');
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await authApi.revokeSession(sessionId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    },
    onError: (error: ApiError) => {
      console.error('Failed to revoke session:', error.message);
    },
  });

  const revokeAllSessionsMutation = useMutation({
    mutationFn: async () => {
      const response = await authApi.revokeAllSessions();
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    },
    onError: (error: ApiError) => {
      console.error('Failed to revoke all sessions:', error.message);
    },
  });

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const formatSessionDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <Link
          href="/settings"
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to settings
        </Link>
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="text-muted-foreground">
          Manage your password and security preferences
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your password regularly to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form ref={formRef} onSubmit={handleChangePassword} className="space-y-4">
              {passwordError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <XCircle className="h-4 w-4" />
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/20 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Password changed successfully! You may need to log in again on other devices.
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="currentPassword" className="text-sm font-medium">
                  Current password
                </label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  placeholder="Enter current password"
                  required
                  disabled={changePasswordMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="newPassword" className="text-sm font-medium">
                  New password
                </label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  required
                  minLength={8}
                  disabled={changePasswordMutation.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters with a mix of letters, numbers, and symbols
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm new password
                </label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  required
                  minLength={8}
                  disabled={changePasswordMutation.isPending}
                />
              </div>

              <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? 'Updating...' : 'Update password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Add an extra layer of security to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {twoFactorEnabled
                    ? 'Your account is protected with 2FA'
                    : 'Enable 2FA for enhanced security'}
                </p>
              </div>
              <Switch
                checked={twoFactorEnabled}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setShow2FADialog(true);
                  } else {
                    setTwoFactorEnabled(false);
                  }
                }}
              />
            </div>
            {!twoFactorEnabled && (
              <div className="mt-4 rounded-lg bg-amber-50 p-4 dark:bg-amber-950/20">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Recommended
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Two-factor authentication significantly improves your account security.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>
              Manage devices that are currently logged into your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSessions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sessions && sessions.length > 0 ? (
              <>
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          <Monitor className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{session.device}</p>
                            {session.current && (
                              <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Active {formatSessionDate(session.createdAt)}
                          </p>
                        </div>
                      </div>
                      {!session.current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeSessionMutation.mutate(session.id)}
                          disabled={revokeSessionMutation.isPending}
                        >
                          {revokeSessionMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <LogOut className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {sessions.filter((s) => !s.current).length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={() => revokeAllSessionsMutation.mutate()}
                      disabled={revokeAllSessionsMutation.isPending}
                    >
                      {revokeAllSessionsMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing out...
                        </>
                      ) : (
                        'Sign out of all other sessions'
                      )}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-8 text-center">
                <Monitor className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No other active sessions
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 2FA Setup Dialog */}
      <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Enable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Set up 2FA to add an extra layer of security to your account
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Coming Soon</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Two-factor authentication is currently in development and will be available soon.
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                We will support authenticator apps like Google Authenticator, Authy, and 1Password.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShow2FADialog(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
