'use client';

import { useState } from 'react';
import {
  Download,
  Pencil,
  Trash2,
  Copy,
  FolderInput,
  Share2,
  History,
  Eye,
  Wand2,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dms/ui';
import type { DocumentDetail } from '@/hooks/useDocuments';

interface DocumentActionsProps {
  document: DocumentDetail;
  onDownload: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
  onMove: () => void;
  onCopy: () => void;
  onProcess: (operations: string[]) => void;
  onViewHistory: () => void;
  onShare: () => void;
  isProcessing?: boolean;
}

export function DocumentActions({
  document,
  onDownload,
  onDelete,
  onRename,
  onMove,
  onCopy,
  onProcess,
  onViewHistory,
  onShare,
  isProcessing,
}: DocumentActionsProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [newName, setNewName] = useState(document.name);

  const handleRename = () => {
    if (newName.trim() && newName !== document.name) {
      onRename(newName.trim());
    }
    setIsRenameOpen(false);
  };

  const handleDelete = () => {
    onDelete();
    setIsDeleteOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>

        <Button variant="outline" onClick={onShare}>
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Wand2 className="mr-2 h-4 w-4" />
              Process
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => onProcess(['ocr'])}
              disabled={isProcessing}
            >
              Extract Text (OCR)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onProcess(['ai_classify'])}
              disabled={isProcessing}
            >
              AI Classification
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onProcess(['thumbnail'])}
              disabled={isProcessing}
            >
              Generate Thumbnail
            </DropdownMenuItem>
            {document.mimeType === 'application/pdf' && (
              <DropdownMenuItem
                onClick={() => onProcess(['pdf_split'])}
                disabled={isProcessing}
              >
                Split PDF
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onProcess(['ocr', 'ai_classify', 'embedding'])}
              disabled={isProcessing}
            >
              Full Processing
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <span className="sr-only">More actions</span>
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsRenameOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMove}>
              <FolderInput className="mr-2 h-4 w-4" />
              Move to...
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopy}>
              <Copy className="mr-2 h-4 w-4" />
              Make a copy
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onViewHistory}>
              <History className="mr-2 h-4 w-4" />
              Version history
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setIsDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
            <DialogDescription>
              Enter a new name for this document.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Document name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!newName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{document.name}&quot;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
