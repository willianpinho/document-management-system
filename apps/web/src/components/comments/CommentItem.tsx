'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageCircle,
  MoreVertical,
  Check,
  Pencil,
  Trash2,
  CornerDownRight,
  X,
} from 'lucide-react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dms/ui';

import type { Comment, UpdateCommentInput } from '@/lib/api';

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  isAdmin?: boolean;
  onReply?: (commentId: string) => void;
  onEdit?: (commentId: string, data: UpdateCommentInput) => void;
  onResolve?: (commentId: string, resolved: boolean) => void;
  onDelete?: (commentId: string) => void;
  depth?: number;
}

export function CommentItem({
  comment,
  currentUserId,
  isAdmin = false,
  onReply,
  onEdit,
  onResolve,
  onDelete,
  depth = 0,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');

  const isAuthor = comment.author.id === currentUserId;
  const canModify = isAuthor || isAdmin;
  const maxDepth = 3;

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== comment.content) {
      onEdit?.(comment.id, { content: editContent.trim() });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  const handleSubmitReply = () => {
    if (replyContent.trim()) {
      onReply?.(comment.id);
      setReplyContent('');
      setIsReplying(false);
    }
  };

  return (
    <div className={`group ${depth > 0 ? 'ml-8 border-l-2 border-muted pl-4' : ''}`}>
      <div className={`flex gap-3 py-3 ${comment.isResolved ? 'opacity-60' : ''}`}>
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.author.avatarUrl || undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(comment.author.name, comment.author.email)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {comment.author.name || comment.author.email}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
            {comment.editedAt && <span className="text-xs text-muted-foreground">(edited)</span>}
            {comment.isResolved && (
              <span className="inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-600 dark:bg-green-950">
                <Check className="h-3 w-3" />
                Resolved
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="mt-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[80px] w-full resize-none rounded-md border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
              {comment.content}
            </p>
          )}

          {/* Annotation info */}
          {comment.pageNumber && (
            <p className="mt-1 text-xs text-muted-foreground">
              Page {comment.pageNumber}
              {comment.positionX !== null && comment.positionY !== null && (
                <span>
                  {' '}
                  at ({Math.round(comment.positionX)}%, {Math.round(comment.positionY)}%)
                </span>
              )}
            </p>
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="mt-2 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              {depth < maxDepth && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setIsReplying(!isReplying)}
                >
                  <CornerDownRight className="mr-1 h-3 w-3" />
                  Reply
                </Button>
              )}
              {!comment.isResolved && canModify && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-green-600"
                  onClick={() => onResolve?.(comment.id, true)}
                >
                  <Check className="mr-1 h-3 w-3" />
                  Resolve
                </Button>
              )}
              {comment.isResolved && canModify && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onResolve?.(comment.id, false)}
                >
                  Reopen
                </Button>
              )}
            </div>
          )}

          {/* Reply input */}
          {isReplying && (
            <div className="mt-3">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="min-h-[60px] w-full resize-none rounded-md border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={handleSubmitReply}>
                  Reply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReplyContent('');
                    setIsReplying(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Menu */}
        {canModify && !isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAuthor && (
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onDelete?.(comment.id)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-0">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onReply={onReply}
              onEdit={onEdit}
              onResolve={onResolve}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
