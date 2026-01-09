'use client';

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
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from '@dms/ui';
import { DocumentActions } from '@/components/documents/DocumentActions';
import { FolderBreadcrumb } from '@/components/folders/FolderBreadcrumb';
import {
  useDocument,
  useUpdateDocument,
  useDeleteDocument,
  useDocumentDownloadUrl,
  useProcessDocument,
} from '@/hooks/useDocuments';
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

  const { data: document, isLoading, error } = useDocument(documentId);
  const { data: downloadUrlData } = useDocumentDownloadUrl(documentId);
  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();
  const processDocument = useProcessDocument();

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

  const handleMove = () => {
    // Open move dialog - for now just redirect
    router.push(`/documents/${documentId}?move=true`);
  };

  const handleCopy = () => {
    // Open copy dialog - for now just redirect
    router.push(`/documents/${documentId}?copy=true`);
  };

  const handleProcess = async (operations: string[]) => {
    await processDocument.mutateAsync({ id: documentId, operations });
  };

  const handleViewHistory = () => {
    // Open version history dialog
  };

  const handleShare = () => {
    // Open share dialog
  };

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
                    {document.versions.length > 5 && (
                      <Button variant="ghost" size="sm" className="w-full">
                        View all {document.versions.length} versions
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
