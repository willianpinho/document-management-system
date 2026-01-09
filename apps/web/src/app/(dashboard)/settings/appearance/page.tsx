'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Palette, Sun, Moon, Monitor, Check } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@dms/ui';

type Theme = 'light' | 'dark' | 'system';

const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="h-5 w-5" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-5 w-5" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-5 w-5" /> },
];

const accentColors = [
  { name: 'Blue', value: 'blue', class: 'bg-blue-500' },
  { name: 'Purple', value: 'purple', class: 'bg-purple-500' },
  { name: 'Green', value: 'green', class: 'bg-green-500' },
  { name: 'Orange', value: 'orange', class: 'bg-orange-500' },
  { name: 'Pink', value: 'pink', class: 'bg-pink-500' },
  { name: 'Teal', value: 'teal', class: 'bg-teal-500' },
];

export default function AppearanceSettingsPage() {
  const [theme, setTheme] = useState<Theme>('system');
  const [accentColor, setAccentColor] = useState('blue');
  const [compactMode, setCompactMode] = useState(false);

  useEffect(() => {
    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }

    const savedAccent = localStorage.getItem('accentColor');
    if (savedAccent) {
      setAccentColor(savedAccent);
    }

    const savedCompact = localStorage.getItem('compactMode');
    if (savedCompact) {
      setCompactMode(savedCompact === 'true');
    }
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(newTheme);
    }
  };

  const handleAccentChange = (color: string) => {
    setAccentColor(color);
    localStorage.setItem('accentColor', color);
    // TODO: Apply accent color to CSS variables
  };

  const handleCompactModeChange = () => {
    const newValue = !compactMode;
    setCompactMode(newValue);
    localStorage.setItem('compactMode', String(newValue));
    // TODO: Apply compact mode styles
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
        <h1 className="text-2xl font-bold">Appearance</h1>
        <p className="text-muted-foreground">
          Customize how DMS looks and feels
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Theme Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Theme
            </CardTitle>
            <CardDescription>
              Select your preferred color theme
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {themes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleThemeChange(t.value)}
                  className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                    theme === t.value
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/20'
                  }`}
                >
                  {theme === t.value && (
                    <div className="absolute right-2 top-2">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                      theme === t.value ? 'bg-primary/10' : 'bg-muted'
                    }`}
                  >
                    {t.icon}
                  </div>
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Accent Color */}
        <Card>
          <CardHeader>
            <CardTitle>Accent Color</CardTitle>
            <CardDescription>
              Choose an accent color for buttons and highlights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {accentColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handleAccentChange(color.value)}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full ${color.class} transition-transform hover:scale-110`}
                  title={color.name}
                >
                  {accentColor === color.value && (
                    <Check className="h-5 w-5 text-white" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Display Options */}
        <Card>
          <CardHeader>
            <CardTitle>Display Options</CardTitle>
            <CardDescription>
              Adjust how content is displayed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Compact Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Reduce spacing and padding for a denser layout
                  </p>
                </div>
                <Button
                  variant={compactMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleCompactModeChange}
                >
                  {compactMode ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              See how your changes will look
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary" />
                <div>
                  <p className="font-medium">Sample Document</p>
                  <p className="text-sm text-muted-foreground">
                    Last modified 2 hours ago
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm">Primary Action</Button>
                <Button size="sm" variant="outline">
                  Secondary
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Link href="/settings">
            <Button variant="outline">Back to Settings</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
