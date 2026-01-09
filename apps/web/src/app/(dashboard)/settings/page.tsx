'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  User,
  Mail,
  Lock,
  Bell,
  Shield,
  Palette,
  Building2,
  ChevronRight,
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
} from '@dms/ui';
import { useAuth } from '@/hooks/useAuth';
import { getInitials } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // TODO: Implement profile update API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Show success toast
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsLoading(false);
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
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={user?.avatarUrl || ''} alt={user?.name || 'User'} />
                    <AvatarFallback className="text-lg">
                      {user?.name ? getInitials(user.name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Button type="button" variant="outline" size="sm">
                      Change avatar
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      JPG, PNG or GIF. Max 2MB.
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

                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save changes'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Password section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Password
              </CardTitle>
              <CardDescription>
                Change your password or enable two-factor authentication
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="currentPassword" className="text-sm font-medium">
                    Current password
                  </label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="Enter current password"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="newPassword" className="text-sm font-medium">
                    New password
                  </label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm new password
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                  />
                </div>

                <Button>Update password</Button>
              </div>
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
              <Button variant="outline" className="w-full">
                Export my data
              </Button>
              <Button variant="destructive" className="w-full">
                Delete my account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
