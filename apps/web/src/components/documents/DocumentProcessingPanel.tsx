'use client';

import { useState } from 'react';
import {
  FileText,
  Image,
  Brain,
  Search,
  FileType,
  Play,
  Pause,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
  Badge,
  Checkbox,
  Label,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@dms/ui';
import { cn } from '@/lib/utils';
import {
  useDocumentProcessing,
  type ProcessingOperationType,
} from '@/hooks/useDocumentProcessing';
import type { ProcessingJob } from '@/lib/api';

interface DocumentProcessingPanelProps {
  documentId: string;
  documentName: string;
  mimeType: string;
  currentProcessingStatus?: string;
  onProcessingComplete?: () => void;
}

const PROCESSING_OPTIONS: {
  type: ProcessingOperationType;
  label: string;
  description: string;
  icon: React.ReactNode;
  supportedTypes?: string[];
}[] = [
  {
    type: 'thumbnail',
    label: 'Generate Thumbnail',
    description: 'Create a preview image for the document',
    icon: <Image className="h-4 w-4" />,
  },
  {
    type: 'ocr',
    label: 'Extract Text (OCR)',
    description: 'Extract text using AWS Textract',
    icon: <FileText className="h-4 w-4" />,
    supportedTypes: ['application/pdf', 'image/'],
  },
  {
    type: 'ai_classify',
    label: 'AI Classification',
    description: 'Classify document type using GPT-4',
    icon: <Brain className="h-4 w-4" />,
  },
  {
    type: 'embedding',
    label: 'Generate Embeddings',
    description: 'Create vector embeddings for semantic search',
    icon: <Search className="h-4 w-4" />,
  },
  {
    type: 'pdf',
    label: 'PDF Operations',
    description: 'Split, merge, or extract from PDF',
    icon: <FileType className="h-4 w-4" />,
    supportedTypes: ['application/pdf'],
  },
];

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'cancelled':
      return <X className="h-4 w-4 text-muted-foreground" />;
    default:
      return null;
  }
}

function getStatusBadge(status: string) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    completed: 'default',
    processing: 'secondary',
    pending: 'outline',
    failed: 'destructive',
    cancelled: 'outline',
  };

  return (
    <Badge variant={variants[status] || 'outline'} className="capitalize">
      {status}
    </Badge>
  );
}

function JobRow({
  job,
  onRetry,
  onCancel,
  isRetrying,
  isCancelling,
}: {
  job: ProcessingJob;
  onRetry: () => void;
  onCancel: () => void;
  isRetrying: boolean;
  isCancelling: boolean;
}) {
  const option = PROCESSING_OPTIONS.find((o) => o.type === job.type);

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3">
        {getStatusIcon(job.status)}
        <div>
          <div className="flex items-center gap-2">
            {option?.icon}
            <span className="font-medium text-sm">{option?.label || job.type}</span>
          </div>
          {job.error && (
            <p className="text-xs text-destructive mt-1">{job.error}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {job.status === 'processing' && (
          <div className="w-24">
            <Progress value={job.progress} className="h-2" />
          </div>
        )}

        {getStatusBadge(job.status)}

        {job.status === 'failed' && (job.attempts ?? 0) < (job.maxAttempts ?? 3) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRetry}
            disabled={isRetrying}
            title="Retry"
          >
            <RefreshCw className={cn('h-4 w-4', isRetrying && 'animate-spin')} />
          </Button>
        )}

        {['pending', 'processing'].includes(job.status) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={isCancelling}
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function DocumentProcessingPanel({
  documentId,
  documentName,
  mimeType,
  currentProcessingStatus,
  onProcessingComplete,
}: DocumentProcessingPanelProps) {
  const [selectedOperations, setSelectedOperations] = useState<ProcessingOperationType[]>([]);

  const {
    jobStatuses,
    hasActiveJobs,
    overallProgress,
    isProcessing,
    isRetrying,
    isCancelling,
    startProcessing,
    retryJob,
    cancelJob,
  } = useDocumentProcessing({
    documentId,
    enabled: true,
  });

  // Filter available operations based on mime type
  const availableOperations = PROCESSING_OPTIONS.filter((op) => {
    if (!op.supportedTypes) return true;
    return op.supportedTypes.some((type) => mimeType.startsWith(type));
  });

  const toggleOperation = (type: ProcessingOperationType) => {
    setSelectedOperations((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleStartProcessing = async () => {
    if (selectedOperations.length === 0) return;
    await startProcessing(selectedOperations);
    setSelectedOperations([]);
  };

  const selectAllOperations = () => {
    setSelectedOperations(availableOperations.map((o) => o.type));
  };

  const clearSelection = () => {
    setSelectedOperations([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Document Processing
        </CardTitle>
        <CardDescription>
          Process &quot;{documentName}&quot; with AI-powered tools
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current status */}
        {currentProcessingStatus && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <span className="text-sm">Current status:</span>
            {getStatusBadge(currentProcessingStatus)}
          </div>
        )}

        {/* Active jobs */}
        {jobStatuses && jobStatuses.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Active Jobs</h4>
              {hasActiveJobs && (
                <div className="flex items-center gap-2">
                  <Progress value={overallProgress} className="w-24 h-2" />
                  <span className="text-xs text-muted-foreground">
                    {Math.round(overallProgress)}%
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {jobStatuses.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onRetry={() => retryJob(job.id)}
                  onCancel={() => cancelJob(job.id)}
                  isRetrying={isRetrying}
                  isCancelling={isCancelling}
                />
              ))}
            </div>
          </div>
        )}

        {/* Select operations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Available Operations</h4>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAllOperations}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            {availableOperations.map((option) => (
              <TooltipProvider key={option.type}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors',
                        selectedOperations.includes(option.type) && 'border-primary bg-primary/5'
                      )}
                    >
                      <Checkbox
                        checked={selectedOperations.includes(option.type)}
                        onCheckedChange={() => toggleOperation(option.type)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {option.icon}
                          <span className="font-medium">{option.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {option.description}
                        </p>
                      </div>
                    </label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{option.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>

        {/* Start button */}
        <Button
          onClick={handleStartProcessing}
          disabled={selectedOperations.length === 0 || isProcessing || hasActiveJobs}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting...
            </>
          ) : hasActiveJobs ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing in progress...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Start Processing ({selectedOperations.length} selected)
            </>
          )}
        </Button>

        {/* Processing info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            Processing may take a few minutes depending on document size and selected operations.
          </p>
          <p>You can close this panel and processing will continue in the background.</p>
        </div>
      </CardContent>
    </Card>
  );
}
