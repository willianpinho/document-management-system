'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  Folder,
  Search,
  Settings,
  Home,
  HardDrive,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button, Progress } from '@dms/ui';
import { FolderTree } from '@/components/folders/FolderTree';
import { CreateFolderDialog } from '@/components/folders/CreateFolderDialog';
import { useFolderTree, useCreateFolder } from '@/hooks/useFolders';
import { cn, formatBytes, getStoragePercentage } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Search', href: '/search', icon: Search },
];

const bottomNavigation = [
  { name: 'Settings', href: '/settings', icon: Settings },
];

// Mock storage data - in real app, fetch from API
const storageStats = {
  usedBytes: 2.5 * 1024 * 1024 * 1024, // 2.5 GB
  limitBytes: 10 * 1024 * 1024 * 1024, // 10 GB
};

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [parentFolderId, setParentFolderId] = useState<string | undefined>();

  const { data: folderTree, isLoading: isLoadingFolders } = useFolderTree();
  const createFolder = useCreateFolder();

  const storagePercentage = getStoragePercentage(
    storageStats.usedBytes,
    storageStats.limitBytes
  );

  const handleCreateFolder = (parentId?: string) => {
    setParentFolderId(parentId);
    setIsCreateFolderOpen(true);
  };

  const handleCreateFolderSubmit = async (name: string) => {
    try {
      await createFolder.mutateAsync({ name, parentId: parentFolderId });
      setIsCreateFolderOpen(false);
      setParentFolderId(undefined);
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  // Get current folder ID from pathname if on folder page
  const currentFolderId = pathname.startsWith('/folders/')
    ? pathname.split('/')[2]
    : undefined;

  return (
    <>
      <aside
        className={cn(
          'flex h-full flex-col border-r bg-card transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo and collapse button */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!isCollapsed && (
            <Link href="/" className="flex items-center gap-2 font-bold">
              <FileText className="h-6 w-6 text-primary" />
              <span>DMS</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Main navigation */}
        <nav className="space-y-1 p-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  isCollapsed && 'justify-center px-2'
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Folders section */}
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto border-t">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Folders
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleCreateFolder()}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <FolderTree
              folders={folderTree || []}
              selectedFolderId={currentFolderId}
              onCreateFolder={handleCreateFolder}
              isLoading={isLoadingFolders}
            />
          </div>
        )}

        {/* Storage usage */}
        {!isCollapsed && (
          <div className="border-t p-4">
            <div className="flex items-center gap-2 text-sm">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Storage</span>
            </div>
            <Progress value={storagePercentage} className="mt-2 h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">
              {formatBytes(storageStats.usedBytes)} of{' '}
              {formatBytes(storageStats.limitBytes)} used
            </p>
          </div>
        )}

        {/* Bottom navigation */}
        <nav className="border-t p-2">
          {bottomNavigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  isCollapsed && 'justify-center px-2'
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Create folder dialog */}
      <CreateFolderDialog
        isOpen={isCreateFolderOpen}
        onClose={() => {
          setIsCreateFolderOpen(false);
          setParentFolderId(undefined);
        }}
        onCreate={handleCreateFolderSubmit}
        isCreating={createFolder.isPending}
      />
    </>
  );
}
