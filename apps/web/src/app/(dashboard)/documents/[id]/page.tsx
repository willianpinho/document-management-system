'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Share2,
  Wand2,
  Clock,
  User,
  FileText,
  Tag,
  Eye,
  MessageCircle,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Progress,
} from '@dms/ui';
import { DocumentActions } from '@/components/documents/DocumentActions';
import { ShareDialog, type SharePermission } from '@/components/documents/ShareDialog';
import { VersionHistoryModal } from '@/components/documents/VersionHistoryModal';
import { PresenceAvatars } from '@/components/documents/PresenceAvatars';
import { FolderBreadcrumb, FolderPickerDialog } from '@/components/folders';
import { CommentsPanel } from '@/components/comments/CommentsPanel';
import { useAuth, usePresence } from '@/hooks';
import {
  useDocument,
  useUpdateDocument,
  useDeleteDocument,
  useDocumentDownloadUrl,
  useProcessDocument,
  useDocumentShares,
  useShareDocument,
  useRemoveShare,
  useUpdateSharePermission,
  useCreateShareLink,
  useDeleteShareLink,
  useDocumentVersions,
  useDownloadVersion,
  useRestoreVersion,
  useMoveDocument,
  useCopyDocument,
} from '@/hooks/useDocuments';
import { useDocumentProcessing } from '@/hooks/useDocumentProcessing';
import {
  formatBytes,
  formatDateTime,
  formatRelativeTime,
  downloadFile,
  getMimeTypeColor,
} from '@/lib/utils';

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  // Auth state
  const { user, currentOrganization } = useAuth();

  // Real-time presence tracking
  const { viewers, isConnected } = usePresence({
    documentId,
    enabled: !!documentId,
  });

  // Dialog states
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);

  // Document data hooks
  const { data: document, isLoading, error } = useDocument(documentId);
  const { data: downloadUrlData } = useDocumentDownloadUrl(documentId);
  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();
  const processDocument = useProcessDocument();

  // Sharing hooks
  const { data: sharesData } = useDocumentShares(documentId);
  const shareDocument = useShareDocument();
  const removeShare = useRemoveShare();
  const updateSharePermission = useUpdateSharePermission();
  const createShareLink = useCreateShareLink();
  const deleteShareLink = useDeleteShareLink();

  // Version hooks
  const { data: versions = [] } = useDocumentVersions(documentId);
  const downloadVersion = useDownloadVersion();
  const restoreVersion = useRestoreVersion();

  // Move/Copy hooks
  const moveDocument = useMoveDocument();
  const copyDocument = useCopyDocument();

  // Processing hook for tracking document processing status
  const {
    jobStatuses,
    hasActiveJobs,
    overallProgress,
    pendingJobs,
    processingJobs,
    completedJobs,
    failedActiveJobs,
  } = useDocumentProcessing({
    documentId,
    enabled: document?.processingStatus === 'processing',
  });

  const handleDownload = async () => {
    if (downloadUrlData?.url && document) {
      downloadFile(downloadUrlData.url, document.name);
    }
  };

  const handleDelete = async () => {
    await deleteDocument.mutateAsync(documentId);
    router.push('/documents');
  };

  const handleRename = async (newName: string) => {
    await updateDocument.mutateAsync({
      id: documentId,
      data: { name: newName },
    });
  };

  const handleMove = useCallback(() => {
    setIsMoveDialogOpen(true);
  }, []);

  const handleCopy = useCallback(() => {
    setIsCopyDialogOpen(true);
  }, []);

  const handleMoveToFolder = useCallback(
    async (folderId: string | null) => {
      await moveDocument.mutateAsync({ id: documentId, folderId });
    },
    [documentId, moveDocument]
  );

  const handleCopyToFolder = useCallback(
    async (folderId: string | null) => {
      await copyDocument.mutateAsync({ id: documentId, folderId });
    },
    [documentId, copyDocument]
  );

  const handleProcess = async (operations: string[]) => {
    await processDocument.mutateAsync({ id: documentId, operations });
  };

  const handleViewHistory = useCallback(() => {
    setIsVersionHistoryOpen(true);
  }, []);

  const handleShare = useCallback(() => {
    setIsShareDialogOpen(true);
  }, []);

  const handleOpenComments = useCallback(() => {
    setIsCommentsOpen(true);
  }, []);

  // Share handlers
  const handleShareWithUser = useCallback(
    async (email: string, permission: SharePermission) => {
      await shareDocument.mutateAsync({ documentId, email, permission });
    },
    [documentId, shareDocument]
  );

  const handleRemoveUser = useCallback(
    async (userId: string) => {
      await removeShare.mutateAsync({ documentId, userId });
    },
    [documentId, removeShare]
  );

  const handleUpdatePermission = useCallback(
    async (userId: string, permission: SharePermission) => {
      await updateSharePermission.mutateAsync({ documentId, userId, permission });
    },
    [documentId, updateSharePermission]
  );

  const handleCreateLink = useCallback(
    async (permission: SharePermission) => {
      await createShareLink.mutateAsync({ documentId, permission });
    },
    [documentId, createShareLink]
  );

  const handleDeleteLink = useCallback(async () => {
    await deleteShareLink.mutateAsync(documentId);
  }, [documentId, deleteShareLink]);

  // Version handlers
  const handleDownloadVersion = useCallback(
    async (versionId: string) => {
      const result = await downloadVersion.mutateAsync({ documentId, versionId });
      if (result.url) {
        const version = versions.find((v) => v.id === versionId);
        downloadFile(result.url, `${document?.name || 'document'}_v${version?.versionNumber || ''}`);
      }
    },
    [documentId, downloadVersion, versions, document?.name]
  );

  const handleRestoreVersion = useCallback(
    async (versionId: string) => {
      await restoreVersion.mutateAsync({ documentId, versionId });
    },
    [documentId, restoreVersion]
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Loading document...</span>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Document not found</h2>
        <p className="text-muted-foreground">
          The document you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
        <Button asChild>
          <Link href="/documents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Documents
          </Link>
        </Button>
      </div>
    );
  }

  const breadcrumbItems = document.folderId
    ? [{ id: document.folderId, name: 'Folder', path: '' }]
    : [];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="mb-4 flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/documents">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <FolderBreadcrumb items={breadcrumbItems} currentName={document.name} />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-lg bg-muted ${getMimeTypeColor(document.mimeType)}`}
            >
              <FileText className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{document.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{formatBytes(document.sizeBytes)}</span>
                <span>-</span>
                <span>{document.mimeType}</span>
                <Badge
                  variant={
                    document.status === 'ready'
                      ? 'default'
                      : document.status === 'error'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {document.status}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Real-time presence indicators */}
            {viewers.length > 0 && (
              <div className="flex items-center gap-2 border-r pr-3">
                <PresenceAvatars
                  viewers={viewers}
                  currentUserId={user?.id}
                  maxVisible={4}
                />
                {isConnected && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{viewers.length} viewing</span>
                  </div>
                )}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenComments}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Comments
            </Button>
            <DocumentActions
              document={document}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onRename={handleRename}
              onMove={handleMove}
              onCopy={handleCopy}
              onProcess={handleProcess}
              onViewHistory={handleViewHistory}
              onShare={handleShare}
              isProcessing={processDocument.isPending}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Preview section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {document.mimeType.startsWith('image/') && downloadUrlData?.url ? (
                  <div className="flex items-center justify-center rounded-lg bg-muted p-4">
                    <img
                      src={downloadUrlData.url}
                      alt={document.name}
                      className="max-h-96 max-w-full rounded-lg object-contain"
                    />
                  </div>
                ) : document.mimeType === 'application/pdf' && downloadUrlData?.url ? (
                  <iframe
                    src={`${downloadUrlData.url}#toolbar=0`}
                    className="h-[600px] w-full rounded-lg border"
                    title={document.name}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-lg bg-muted py-16">
                    <FileText className="h-16 w-16 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">
                      Preview not available for this file type
                    </p>
                    <Button className="mt-4" onClick={handleDownload}>
                      <Download className="mr-2 h-4 w-4" />
                      Download to view
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* OCR Text */}
            {document.metadata?.ocrText && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4" />
                    Extracted Text (OCR)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-auto rounded-lg bg-muted p-4">
                    <pre className="whitespace-pre-wrap text-sm">
                      {document.metadata.ocrText}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Info sidebar */}
          <div className="space-y-6">
            {/* Document info */}
            <Card>
              <CardHeader>
                <CardTitle>Document Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm">{formatDateTime(document.createdAt)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Modified</p>
                    <p className="text-sm">{formatRelativeTime(document.updatedAt)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Uploaded by</p>
                    <p className="text-sm">
                      {document.createdBy?.name || document.createdBy?.email || 'Unknown'}
                    </p>
                  </div>
                </div>

                {document.metadata?.pageCount && (
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Pages</p>
                      <p className="text-sm">{document.metadata.pageCount}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Processing Status */}
            {(document.processingStatus === 'processing' || hasActiveJobs) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Overall Progress</span>
                      <span className="font-medium">{Math.round(overallProgress)}%</span>
                    </div>
                    <Progress value={overallProgress} className="h-2" />
                  </div>

                  {jobStatuses && jobStatuses.length > 0 && (
                    <div className="space-y-2 border-t pt-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Active Jobs</p>
                      {jobStatuses.slice(0, 3).map((job) => (
                        <div key={job.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {job.status === 'processing' && (
                              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                            )}
                            {job.status === 'completed' && (
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                            )}
                            {job.status === 'failed' && (
                              <AlertCircle className="h-3 w-3 text-destructive" />
                            )}
                            {job.status === 'pending' && (
                              <Clock className="h-3 w-3 text-yellow-500" />
                            )}
                            <span className="capitalize">{job.type.replace('_', ' ')}</span>
                          </div>
                          <Badge
                            variant={
                              job.status === 'completed'
                                ? 'default'
                                : job.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className="text-xs"
                          >
                            {job.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Processing continues in the background. This page will update automatically.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* AI Classification */}
            {document.metadata?.classification && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4" />
                    AI Classification
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Category</span>
                      <Badge>{document.metadata.classification.category}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Confidence</span>
                      <span className="text-sm font-medium">
                        {Math.round(document.metadata.classification.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tags */}
            {document.metadata?.tags && document.metadata.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {document.metadata.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Version history */}
            {document.versions && document.versions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Version History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {document.versions.slice(0, 5).map((version) => (
                      <div
                        key={version.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>v{version.versionNumber}</span>
                        <span className="text-muted-foreground">
                          {formatRelativeTime(version.createdAt)}
                        </span>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={handleViewHistory}
                    >
                      View all versions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Share Dialog */}
      <ShareDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        documentId={documentId}
        documentName={document.name}
        sharedUsers={sharesData?.users || []}
        shareLink={sharesData?.link}
        onShareWithUser={handleShareWithUser}
        onRemoveUser={handleRemoveUser}
        onUpdatePermission={handleUpdatePermission}
        onCreateLink={handleCreateLink}
        onDeleteLink={handleDeleteLink}
        isLoading={shareDocument.isPending || createShareLink.isPending}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        open={isVersionHistoryOpen}
        onOpenChange={setIsVersionHistoryOpen}
        documentId={documentId}
        documentName={document.name}
        currentVersionNumber={Math.max(...(document.versions?.map((v) => v.versionNumber) || [1]))}
        versions={versions}
        onDownloadVersion={handleDownloadVersion}
        onRestoreVersion={handleRestoreVersion}
        isLoading={downloadVersion.isPending || restoreVersion.isPending}
      />

      {/* Comments Panel */}
      <CommentsPanel
        documentId={documentId}
        currentUserId={user?.id || ''}
        isAdmin={currentOrganization?.role === 'OWNER' || currentOrganization?.role === 'ADMIN'}
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
      />

      {/* Move Dialog */}
      <FolderPickerDialog
        open={isMoveDialogOpen}
        onOpenChange={setIsMoveDialogOpen}
        onSelect={handleMoveToFolder}
        title="Move Document"
        description={`Select a destination folder for "${document.name}"`}
        currentFolderId={document.folderId}
      />

      {/* Copy Dialog */}
      <FolderPickerDialog
        open={isCopyDialogOpen}
        onOpenChange={setIsCopyDialogOpen}
        onSelect={handleCopyToFolder}
        title="Copy Document"
        description={`Select a destination folder for the copy of "${document.name}"`}
        currentFolderId={document.folderId}
      />
    </div>
  );
}
