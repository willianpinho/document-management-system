'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Mail, Smartphone } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
} from '@dms/ui';

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  email: boolean;
  push: boolean;
}

export default function NotificationsSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: 'document_shared',
      title: 'Document shared',
      description: 'When someone shares a document with you',
      email: true,
      push: true,
    },
    {
      id: 'comment_added',
      title: 'New comments',
      description: 'When someone comments on your documents',
      email: true,
      push: false,
    },
    {
      id: 'processing_complete',
      title: 'Processing complete',
      description: 'When document processing is finished',
      email: false,
      push: true,
    },
    {
      id: 'storage_warning',
      title: 'Storage warnings',
      description: 'When storage usage exceeds 80%',
      email: true,
      push: true,
    },
    {
      id: 'security_alerts',
      title: 'Security alerts',
      description: 'Important security notifications',
      email: true,
      push: true,
    },
    {
      id: 'weekly_digest',
      title: 'Weekly digest',
      description: 'Summary of activity in your organization',
      email: true,
      push: false,
    },
  ]);

  const toggleSetting = (id: string, type: 'email' | 'push') => {
    setSettings((prev) =>
      prev.map((setting) =>
        setting.id === id
          ? { ...setting, [type]: !setting[type] }
          : setting
      )
    );
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement save API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Show success toast
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    } finally {
      setIsLoading(false);
    }
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
        <h1 className="text-2xl font-bold">Notification Settings</h1>
        <p className="text-muted-foreground">
          Choose how and when you want to be notified
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Configure your notification channels for different events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex items-center gap-8 border-b pb-4">
              <div className="flex-1" />
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Mail className="h-4 w-4" />
                Email
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Smartphone className="h-4 w-4" />
                Push
              </div>
            </div>

            <div className="space-y-6">
              {settings.map((setting) => (
                <div key={setting.id} className="flex items-center gap-8">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{setting.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {setting.description}
                    </p>
                  </div>
                  <Switch
                    checked={setting.email}
                    onCheckedChange={() => toggleSetting(setting.id, 'email')}
                  />
                  <Switch
                    checked={setting.push}
                    onCheckedChange={() => toggleSetting(setting.id, 'push')}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Link href="/settings">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
