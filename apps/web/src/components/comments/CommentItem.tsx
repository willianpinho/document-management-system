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

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {comment.author.name || comment.author.email}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
            {comment.editedAt && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
            {comment.isResolved && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950 px-1.5 py-0.5 rounded">
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
                className="w-full min-h-[80px] p-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
              {comment.content}
            </p>
          )}

          {/* Annotation info */}
          {comment.pageNumber && (
            <p className="text-xs text-muted-foreground mt-1">
              Page {comment.pageNumber}
              {comment.positionX !== null && comment.positionY !== null && (
                <span> at ({Math.round(comment.positionX)}%, {Math.round(comment.positionY)}%)</span>
              )}
            </p>
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {depth < maxDepth && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setIsReplying(!isReplying)}
                >
                  <CornerDownRight className="h-3 w-3 mr-1" />
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
                  <Check className="h-3 w-3 mr-1" />
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
                className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
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
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onDelete?.(comment.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
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
