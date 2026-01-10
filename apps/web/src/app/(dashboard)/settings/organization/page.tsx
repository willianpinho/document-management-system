'use client';

import { useState } from 'react';
import {
  Building2,
  Users,
  CreditCard,
  Key,
  Plus,
  MoreVertical,
  Shield,
  Mail,
  Copy,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Receipt,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Badge,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dms/ui';
import { useAuth } from '@/hooks/useAuth';
import {
  useOrganizationMembers,
  useOrganizationDetails,
  useInviteMember,
  useRemoveMember,
  useUpdateMemberRole,
  useUpdateOrganization,
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  type ApiKeyCreated,
} from '@/hooks/useOrganization';
import { useStorageStats } from '@/hooks/useStorage';
import { formatBytes, getInitials, copyToClipboard } from '@/lib/utils';
import { ApiError } from '@/lib/api';

export default function OrganizationSettingsPage() {
  const { user, currentOrganization } = useAuth();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('VIEWER');
  const [newKeyName, setNewKeyName] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [orgName, setOrgName] = useState(currentOrganization?.name || '');
  const [createdApiKey, setCreatedApiKey] = useState<ApiKeyCreated | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [showInvoicesDialog, setShowInvoicesDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  // Fetch real data
  const { data: orgDetails, isLoading: isLoadingOrg } = useOrganizationDetails();
  const { data: members, isLoading: isLoadingMembers } = useOrganizationMembers();
  const { data: storageStats, isLoading: isLoadingStorage } = useStorageStats();
  const { data: apiKeys, isLoading: isLoadingApiKeys } = useApiKeys();

  // Mutations
  const inviteMember = useInviteMember();
  const removeMember = useRemoveMember();
  const updateMemberRole = useUpdateMemberRole();
  const updateOrganization = useUpdateOrganization();
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();

  const storagePercentage = storageStats?.usagePercent ?? 0;
  const memberCount = members?.length ?? 0;
  const memberLimit = 10; // From plan

  const handleInvite = async () => {
    setInviteError(null);
    setInviteSuccess(false);

    if (!inviteEmail.trim()) {
      setInviteError('Email is required');
      return;
    }

    try {
      await inviteMember.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
      setInviteSuccess(true);
      setInviteEmail('');
      setInviteRole('VIEWER');
      setTimeout(() => {
        setIsInviteOpen(false);
        setInviteSuccess(false);
      }, 1500);
    } catch (error) {
      const apiError = error as ApiError;
      setInviteError(apiError.message || 'Failed to send invitation');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMember.mutateAsync(memberId);
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      await updateMemberRole.mutateAsync({ memberId, role: newRole });
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleSaveOrgDetails = async () => {
    if (!orgName.trim()) return;
    try {
      await updateOrganization.mutateAsync({ name: orgName.trim() });
    } catch (error) {
      console.error('Failed to update organization:', error);
    }
  };

  const handleCreateApiKey = async () => {
    setApiKeyError(null);

    if (!newKeyName.trim()) {
      setApiKeyError('Key name is required');
      return;
    }

    try {
      const result = await createApiKey.mutateAsync({ name: newKeyName.trim() });
      setCreatedApiKey(result);
      setNewKeyName('');
      // Keep dialog open to show the newly created key
    } catch (error) {
      const apiError = error as ApiError;
      setApiKeyError(apiError.message || 'Failed to create API key');
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    try {
      await revokeApiKey.mutateAsync(keyId);
    } catch (error) {
      console.error('Failed to revoke API key:', error);
    }
  };

  const formatApiKeyDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization, team members, and billing
        </p>
      </div>

      <div className="space-y-6">
        {/* Organization info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="orgName" className="text-sm font-medium">
                  Organization name
                </label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Organization name"
                  disabled={updateOrganization.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="orgSlug" className="text-sm font-medium">
                  Organization URL
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">dms.app/</span>
                  <Input
                    id="orgSlug"
                    value={currentOrganization?.slug || ''}
                    disabled
                    placeholder="organization-slug"
                    className="flex-1 bg-muted"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Organization URL cannot be changed
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Button
                onClick={handleSaveOrgDetails}
                disabled={updateOrganization.isPending || !orgName.trim()}
              >
                {updateOrganization.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Plan and usage */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Plan & Usage
                </CardTitle>
                <CardDescription>
                  Your current plan and resource usage
                </CardDescription>
              </div>
              <Badge>Business</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Storage usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Storage</span>
                  {isLoadingStorage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-muted-foreground">
                      {formatBytes(storageStats?.usedBytes ?? 0)} /{' '}
                      {formatBytes(storageStats?.quotaBytes ?? 0)}
                    </span>
                  )}
                </div>
                <Progress value={storagePercentage} className="h-2" />
              </div>

              {/* Member usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Team members</span>
                  {isLoadingMembers ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-muted-foreground">
                      {memberCount} / {memberLimit}
                    </span>
                  )}
                </div>
                <Progress
                  value={(memberCount / memberLimit) * 100}
                  className="h-2"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => setShowInvoicesDialog(true)}>
                <Receipt className="mr-2 h-4 w-4" />
                View invoices
              </Button>
              <Button onClick={() => setShowUpgradeDialog(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade plan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Team members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Members
                </CardTitle>
                <CardDescription>
                  Manage who has access to this organization
                </CardDescription>
              </div>
              <Button onClick={() => setIsInviteOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Invite member
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : members && members.length > 0 ? (
              <div className="divide-y">
                {members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.user.avatarUrl || ''} alt={member.user.name || ''} />
                        <AvatarFallback>
                          {member.user.name ? getInitials(member.user.name) : (member.user.email?.[0] || 'U').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {member.user.name || member.user.email}
                          {member.user.email === user?.email && (
                            <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{member.user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          member.role === 'OWNER'
                            ? 'default'
                            : member.role === 'ADMIN'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {member.role.toLowerCase()}
                      </Badge>

                      {member.role !== 'OWNER' && member.user.email !== user?.email && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleUpdateRole(member.userId, 'ADMIN')}>
                              <Shield className="mr-2 h-4 w-4" />
                              Make Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateRole(member.userId, 'EDITOR')}>
                              <Shield className="mr-2 h-4 w-4" />
                              Make Editor
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateRole(member.userId, 'VIEWER')}>
                              <Shield className="mr-2 h-4 w-4" />
                              Make Viewer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleRemoveMember(member.userId)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No members yet. Invite someone to get started.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API Keys
                </CardTitle>
                <CardDescription>
                  Manage API keys for programmatic access
                </CardDescription>
              </div>
              <Button onClick={() => setIsCreateKeyOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create key
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingApiKeys ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys && apiKeys.length > 0 ? (
              <div className="divide-y">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{key.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <code className="rounded bg-muted px-1">{key.keyPrefix}...</code>
                        <span>-</span>
                        <span>
                          {key.lastUsedAt
                            ? `Last used: ${formatApiKeyDate(key.lastUsedAt)}`
                            : 'Never used'}
                        </span>
                        {key.expiresAt && (
                          <>
                            <span>-</span>
                            <span>Expires: {formatApiKeyDate(key.expiresAt)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(key.keyPrefix)}
                        title="Copy key prefix"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRevokeApiKey(key.id)}
                        disabled={revokeApiKey.isPending}
                        title="Revoke key"
                      >
                        {revokeApiKey.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Key className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No API keys yet. Create one to get started.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invite member dialog */}
      <Dialog open={isInviteOpen} onOpenChange={(open) => {
        if (!open) {
          setInviteError(null);
          setInviteSuccess(false);
          setInviteEmail('');
          setInviteRole('VIEWER');
        }
        setIsInviteOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your organization
            </DialogDescription>
          </DialogHeader>

          {inviteError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {inviteError}
            </div>
          )}

          {inviteSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/20 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Member invited successfully!
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="inviteEmail" className="text-sm font-medium">
                Email address
              </label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                disabled={inviteMember.isPending}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="inviteRole" className="text-sm font-medium">
                Role
              </label>
              <Select value={inviteRole} onValueChange={setInviteRole} disabled={inviteMember.isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">Viewer - Read only</SelectItem>
                  <SelectItem value="EDITOR">Editor - Read and write</SelectItem>
                  <SelectItem value="ADMIN">Admin - Full access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)} disabled={inviteMember.isPending}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviteMember.isPending}>
              {inviteMember.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create API key dialog */}
      <Dialog open={isCreateKeyOpen} onOpenChange={(open) => {
        if (!open) {
          setCreatedApiKey(null);
          setApiKeyError(null);
          setNewKeyName('');
        }
        setIsCreateKeyOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createdApiKey ? 'API Key Created' : 'Create API key'}
            </DialogTitle>
            <DialogDescription>
              {createdApiKey
                ? 'Make sure to copy your API key now. You won\'t be able to see it again!'
                : 'Create a new API key for programmatic access'}
            </DialogDescription>
          </DialogHeader>

          {apiKeyError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {apiKeyError}
            </div>
          )}

          {createdApiKey ? (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-950/20">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Copy your API key
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      This is the only time you'll see this key. Store it securely.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Your API Key</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-muted p-3 text-sm font-mono break-all">
                    {createdApiKey.key}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(createdApiKey.key)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p><strong>Name:</strong> {createdApiKey.name}</p>
                <p><strong>Prefix:</strong> {createdApiKey.keyPrefix}...</p>
              </div>
            </div>
          ) : (
            <div className="py-4">
              <label htmlFor="keyName" className="mb-2 block text-sm font-medium">
                Key name
              </label>
              <Input
                id="keyName"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Production Upload Agent"
                disabled={createApiKey.isPending}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Give your key a descriptive name to remember its purpose
              </p>
            </div>
          )}

          <DialogFooter>
            {createdApiKey ? (
              <Button onClick={() => setIsCreateKeyOpen(false)}>
                Done
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateKeyOpen(false)}
                  disabled={createApiKey.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateApiKey}
                  disabled={!newKeyName.trim() || createApiKey.isPending}
                >
                  {createApiKey.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create key'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoices Dialog */}
      <Dialog open={showInvoicesDialog} onOpenChange={setShowInvoicesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Invoices
            </DialogTitle>
            <DialogDescription>
              View and download your billing invoices
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center">
            <Receipt className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              No invoices yet. Invoices will appear here after your first billing cycle.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              You are currently on the Business plan.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInvoicesDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Plan Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Upgrade Your Plan
            </DialogTitle>
            <DialogDescription>
              Unlock more features and storage
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Current Plan</p>
                  <p className="text-sm text-muted-foreground">Business</p>
                </div>
                <Badge>Active</Badge>
              </div>
            </div>

            <div className="rounded-lg border border-primary/50 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enterprise</p>
                  <p className="text-sm text-muted-foreground">Unlimited storage & users</p>
                </div>
                <Badge variant="outline" className="border-primary text-primary">
                  Recommended
                </Badge>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Unlimited storage
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Unlimited team members
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Priority support
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Advanced AI features
                </li>
              </ul>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Contact our sales team to discuss enterprise pricing.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              window.open('mailto:sales@dms.app?subject=Enterprise Plan Inquiry', '_blank');
              setShowUpgradeDialog(false);
            }}>
              Contact Sales
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
