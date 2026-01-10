'use client';

import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dms/ui';
import { Bell, LogOut, Settings, User, Building2, HelpCircle } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { useAuth } from '@/hooks/useAuth';
import { getInitials } from '@/lib/utils';

// Map paths to page titles
const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/documents': 'Documents',
  '/folders': 'Folders',
  '/search': 'Search',
  '/settings': 'Settings',
  '/settings/organization': 'Organization Settings',
};

function getPageTitle(pathname: string): string {
  // Exact match
  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }

  // Check for document detail page
  if (pathname.startsWith('/documents/')) {
    return 'Document Details';
  }

  // Check for folder detail page
  if (pathname.startsWith('/folders/')) {
    return 'Folder Contents';
  }

  // Check for settings subpages
  if (pathname.startsWith('/settings/')) {
    return 'Settings';
  }

  return 'Dashboard';
}

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isLoggingOut } = useAuth();

  const pageTitle = getPageTitle(pathname);

  const handleLogout = async () => {
    // Clear local tokens first
    logout();
    // Sign out from NextAuth session
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      {/* Page title */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">{pageTitle}</h1>
      </div>

      {/* Search bar */}
      <div className="hidden w-full max-w-md px-4 md:block">
        <SearchBar />
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {/* Notification badge */}
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="py-4 text-center text-sm text-muted-foreground">
              No new notifications
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Help */}
        <Button variant="ghost" size="icon">
          <HelpCircle className="h-5 w-5" />
          <span className="sr-only">Help</span>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full"
              aria-label="User menu"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={user?.avatarUrl || ''} alt={user?.name || 'User'} />
                <AvatarFallback>
                  {user?.name ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email || 'user@example.com'}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings/organization')}>
              <Building2 className="mr-2 h-4 w-4" />
              Organization
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {isLoggingOut ? 'Logging out...' : 'Log out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
