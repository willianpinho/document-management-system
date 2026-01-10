'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Mail, Smartphone, CheckCircle2, Loader2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
} from '@dms/ui';
import { useUserPreferences, useUpdatePreferences } from '@/hooks/usePreferences';

export default function NotificationsSettingsPage() {
  const { data: preferences, isLoading: isLoadingPrefs } = useUserPreferences();
  const updatePreferences = useUpdatePreferences();
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local state for form
  const [emailOnShare, setEmailOnShare] = useState(true);
  const [emailOnComments, setEmailOnComments] = useState(true);
  const [emailOnProcessingComplete, setEmailOnProcessingComplete] = useState(true);
  const [emailOnUpload, setEmailOnUpload] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(false);

  // Sync with backend preferences
  useEffect(() => {
    if (preferences?.notifications) {
      setEmailOnShare(preferences.notifications.emailOnShare ?? true);
      setEmailOnComments(preferences.notifications.emailOnComments ?? true);
      setEmailOnProcessingComplete(preferences.notifications.emailOnProcessingComplete ?? true);
      setEmailOnUpload(preferences.notifications.emailOnUpload ?? true);
      setWeeklyDigest(preferences.notifications.weeklyDigest ?? false);
      setMarketingEmails(preferences.notifications.marketingEmails ?? false);
    }
  }, [preferences]);

  const handleSave = async () => {
    setSaveSuccess(false);
    try {
      await updatePreferences.mutateAsync({
        notifications: {
          emailOnShare,
          emailOnComments,
          emailOnProcessingComplete,
          emailOnUpload,
          weeklyDigest,
          marketingEmails,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  };

  const notificationSettings = [
    {
      id: 'emailOnUpload',
      title: 'Document uploaded',
      description: 'When a document is uploaded to your organization',
      value: emailOnUpload,
      onChange: setEmailOnUpload,
    },
    {
      id: 'emailOnShare',
      title: 'Document shared',
      description: 'When someone shares a document with you',
      value: emailOnShare,
      onChange: setEmailOnShare,
    },
    {
      id: 'emailOnComments',
      title: 'New comments',
      description: 'When someone comments on your documents',
      value: emailOnComments,
      onChange: setEmailOnComments,
    },
    {
      id: 'emailOnProcessingComplete',
      title: 'Processing complete',
      description: 'When document processing is finished',
      value: emailOnProcessingComplete,
      onChange: setEmailOnProcessingComplete,
    },
    {
      id: 'weeklyDigest',
      title: 'Weekly digest',
      description: 'Summary of activity in your organization',
      value: weeklyDigest,
      onChange: setWeeklyDigest,
    },
    {
      id: 'marketingEmails',
      title: 'Product updates',
      description: 'News and updates about new features',
      value: marketingEmails,
      onChange: setMarketingEmails,
    },
  ];

  if (isLoadingPrefs) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/20 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Notification preferences saved successfully!
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Configure which email notifications you want to receive
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex items-center gap-8 border-b pb-4">
              <div className="flex-1" />
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Mail className="h-4 w-4" />
                Email
              </div>
            </div>

            <div className="space-y-6">
              {notificationSettings.map((setting) => (
                <div key={setting.id} className="flex items-center justify-between gap-8">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{setting.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {setting.description}
                    </p>
                  </div>
                  <Switch
                    checked={setting.value}
                    onCheckedChange={setting.onChange}
                    disabled={updatePreferences.isPending}
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
          <Button onClick={handleSave} disabled={updatePreferences.isPending}>
            {updatePreferences.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
