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
} from '@dms/ui';
import { useAuth } from '@/hooks/useAuth';
import { formatBytes, getInitials, copyToClipboard } from '@/lib/utils';

// Mock data - in real app, fetch from API
const mockOrganization = {
  id: 'org-1',
  name: 'Acme Corp',
  slug: 'acme-corp',
  plan: 'Business',
  memberCount: 5,
  memberLimit: 10,
  storageUsed: 5.2 * 1024 * 1024 * 1024,
  storageLimit: 50 * 1024 * 1024 * 1024,
};

const mockMembers = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@acme.com',
    avatarUrl: '',
    role: 'owner',
    joinedAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@acme.com',
    avatarUrl: '',
    role: 'admin',
    joinedAt: '2024-02-20',
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@acme.com',
    avatarUrl: '',
    role: 'editor',
    joinedAt: '2024-03-10',
  },
];

const mockApiKeys = [
  {
    id: '1',
    name: 'Upload Agent - Production',
    prefix: 'dms_live_xxxx',
    lastUsed: '2024-12-20',
    createdAt: '2024-06-15',
  },
  {
    id: '2',
    name: 'Integration - Dev',
    prefix: 'dms_test_xxxx',
    lastUsed: null,
    createdAt: '2024-11-01',
  },
];

export default function OrganizationSettingsPage() {
  const { user } = useAuth();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [newKeyName, setNewKeyName] = useState('');

  const storagePercentage = Math.round(
    (mockOrganization.storageUsed / mockOrganization.storageLimit) * 100
  );

  const handleInvite = () => {
    // TODO: Send invitation
    setIsInviteOpen(false);
    setInviteEmail('');
  };

  const handleCreateApiKey = () => {
    // TODO: Create API key
    setIsCreateKeyOpen(false);
    setNewKeyName('');
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
                  defaultValue={mockOrganization.name}
                  placeholder="Organization name"
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
                    defaultValue={mockOrganization.slug}
                    placeholder="organization-slug"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Button>Save changes</Button>
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
              <Badge>{mockOrganization.plan}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Storage usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Storage</span>
                  <span className="text-muted-foreground">
                    {formatBytes(mockOrganization.storageUsed)} /{' '}
                    {formatBytes(mockOrganization.storageLimit)}
                  </span>
                </div>
                <Progress value={storagePercentage} className="h-2" />
              </div>

              {/* Member usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Team members</span>
                  <span className="text-muted-foreground">
                    {mockOrganization.memberCount} / {mockOrganization.memberLimit}
                  </span>
                </div>
                <Progress
                  value={(mockOrganization.memberCount / mockOrganization.memberLimit) * 100}
                  className="h-2"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline">View invoices</Button>
              <Button>Upgrade plan</Button>
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
            <div className="divide-y">
              {mockMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.avatarUrl} alt={member.name} />
                      <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {member.name}
                        {member.email === user?.email && (
                          <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        member.role === 'owner'
                          ? 'default'
                          : member.role === 'admin'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {member.role}
                    </Badge>

                    {member.role !== 'owner' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Shield className="mr-2 h-4 w-4" />
                            Change role
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
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
            {mockApiKeys.length === 0 ? (
              <div className="py-8 text-center">
                <Key className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No API keys yet. Create one to get started.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {mockApiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{key.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <code className="rounded bg-muted px-1">{key.prefix}</code>
                        <span>-</span>
                        <span>
                          {key.lastUsed
                            ? `Last used: ${key.lastUsed}`
                            : 'Never used'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(key.prefix)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invite member dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your organization
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label htmlFor="inviteEmail" className="mb-2 block text-sm font-medium">
              Email address
            </label>
            <Input
              id="inviteEmail"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail}>
              <Mail className="mr-2 h-4 w-4" />
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create API key dialog */}
      <Dialog open={isCreateKeyOpen} onOpenChange={setIsCreateKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Create a new API key for programmatic access
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label htmlFor="keyName" className="mb-2 block text-sm font-medium">
              Key name
            </label>
            <Input
              id="keyName"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., Production Upload Agent"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Give your key a descriptive name to remember its purpose
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateKeyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateApiKey} disabled={!newKeyName}>
              Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
