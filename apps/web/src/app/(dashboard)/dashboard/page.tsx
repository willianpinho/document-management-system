'use client';

import Link from 'next/link';
import {
  FileText,
  Folder,
  Upload,
  HardDrive,
  ArrowRight,
  Wand2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Progress,
} from '@dms/ui';
import { useDocuments } from '@/hooks/useDocuments';
import { useFolders } from '@/hooks/useFolders';
import { useStorageStats } from '@/hooks/useStorage';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { formatBytes, formatRelativeTime, getStoragePercentage } from '@/lib/utils';

export default function DashboardPage() {
  const { data: documentsData, isLoading: isLoadingDocuments } = useDocuments({
    limit: 6,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const { data: foldersData, isLoading: isLoadingFolders } = useFolders({
    limit: 4,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  const { data: storageStats, isLoading: isLoadingStorage } = useStorageStats();

  const documents = documentsData?.data || [];
  const folders = foldersData?.data || [];

  // Calculate storage percentage from real data
  const usedBytes = storageStats?.usedBytes ?? 0;
  const quotaBytes = storageStats?.quotaBytes ?? 10 * 1024 * 1024 * 1024; // Default 10GB
  const storagePercentage = getStoragePercentage(usedBytes, quotaBytes);

  // Count documents processed (with status COMPLETED)
  const processedCount = documents.filter(doc => doc.status === 'COMPLETED').length;

  return (
    <div className="p-6">
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Welcome back!</h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your document management system
        </p>
      </div>

      {/* Quick stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {documentsData?.meta?.pagination?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all folders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Folders</CardTitle>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {foldersData?.data?.length || folders.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Organized structure
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">AI Processed</CardTitle>
            <Wand2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {processedCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Documents analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStorage ? (
              <div className="h-16 animate-pulse bg-muted rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{storagePercentage}%</div>
                <Progress value={storagePercentage} className="mt-2 h-1.5" />
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatBytes(usedBytes)} of {formatBytes(quotaBytes)}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/documents">
              <Upload className="mr-2 h-4 w-4" />
              Upload Documents
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/folders">
              <Folder className="mr-2 h-4 w-4" />
              Create Folder
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/search">
              <Wand2 className="mr-2 h-4 w-4" />
              AI Search
            </Link>
          </Button>
        </div>
      </div>

      {/* Recent documents */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Documents</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/documents">
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {isLoadingDocuments ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-12 w-12 rounded-lg bg-muted" />
                  <div className="mt-4 h-4 w-3/4 rounded bg-muted" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : documents.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.slice(0, 6).map((doc) => (
              <DocumentCard key={doc.id} document={doc} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No documents yet</h3>
              <p className="text-muted-foreground">
                Upload your first document to get started
              </p>
              <Button className="mt-4" asChild>
                <Link href="/documents">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent folders */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Folders</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/folders">
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {isLoadingFolders ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-12 w-12 rounded-lg bg-muted" />
                  <div className="mt-4 h-4 w-3/4 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : folders.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {folders.slice(0, 4).map((folder) => (
              <Card key={folder.id} className="transition-all hover:shadow-md">
                <Link href={`/folders/${folder.id}`}>
                  <CardContent className="p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-blue-500">
                      <Folder className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 truncate text-sm font-medium">
                      {folder.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {folder.documentCount} items - {formatRelativeTime(folder.updatedAt)}
                    </p>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Folder className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No folders yet</h3>
              <p className="text-muted-foreground">
                Create folders to organize your documents
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
