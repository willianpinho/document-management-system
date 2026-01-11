'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, X, Filter, Send, Loader2 } from 'lucide-react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@dms/ui';

import { CommentItem } from './CommentItem';
import {
  commentsApi,
  type Comment,
  type CreateCommentInput,
  type UpdateCommentInput,
} from '@/lib/api';

interface CommentsPanelProps {
  documentId: string;
  currentUserId: string;
  isAdmin?: boolean;
  isOpen: boolean;
  onClose: () => void;
}

type FilterType = 'all' | 'open' | 'resolved';

export function CommentsPanel({
  documentId,
  currentUserId,
  isAdmin = false,
  isOpen,
  onClose,
}: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ total: 0, resolved: 0 });

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await commentsApi.list(documentId, { includeReplies: true });
      // API response.data is CommentListResponse { data: Comment[], ... }
      // So we need response.data.data to get the actual comments array
      setComments(response.data?.data || []);
    } catch (err) {
      setError('Failed to load comments');
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  const fetchCounts = useCallback(async () => {
    try {
      const response = await commentsApi.getCount(documentId);
      setCounts(response.data || { total: 0, resolved: 0 });
    } catch (err) {
      console.error('Error fetching comment counts:', err);
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
      fetchCounts();
    }
  }, [isOpen, fetchComments, fetchCounts]);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      const data: CreateCommentInput = {
        content: newComment.trim(),
        parentId: replyToId || undefined,
      };
      await commentsApi.create(documentId, data);
      setNewComment('');
      setReplyToId(null);
      await fetchComments();
      await fetchCounts();
    } catch (err) {
      console.error('Error creating comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string, data: UpdateCommentInput) => {
    try {
      await commentsApi.update(documentId, commentId, data);
      await fetchComments();
    } catch (err) {
      console.error('Error updating comment:', err);
    }
  };

  const handleResolveComment = async (commentId: string, resolved: boolean) => {
    try {
      await commentsApi.resolve(documentId, commentId, resolved);
      await fetchComments();
      await fetchCounts();
    } catch (err) {
      console.error('Error resolving comment:', err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await commentsApi.delete(documentId, commentId);
      await fetchComments();
      await fetchCounts();
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const handleReply = (commentId: string) => {
    setReplyToId(commentId);
    // Focus the input
    const input = document.querySelector('[data-comment-input]') as HTMLTextAreaElement;
    input?.focus();
  };

  const filteredComments = comments.filter((comment) => {
    // Only filter top-level comments
    if (comment.parentId) return true;
    if (filter === 'open') return !comment.isResolved;
    if (filter === 'resolved') return comment.isResolved;
    return true;
  });

  // Get only top-level comments for display
  const topLevelComments = filteredComments.filter((c) => !c.parentId);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-background border-l shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <h2 className="font-semibold">Comments</h2>
          <span className="text-sm text-muted-foreground">
            ({counts.total - counts.resolved} open, {counts.resolved} resolved)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Filter className="h-4 w-4 mr-1" />
                {filter === 'all' ? 'All' : filter === 'open' ? 'Open' : 'Resolved'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilter('all')}>
                All comments
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('open')}>
                Open only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('resolved')}>
                Resolved only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchComments}>
              Retry
            </Button>
          </div>
        ) : topLevelComments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No comments yet</p>
            <p className="text-sm">Be the first to add a comment</p>
          </div>
        ) : (
          <div className="space-y-2 divide-y">
            {topLevelComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onReply={handleReply}
                onEdit={handleEditComment}
                onResolve={handleResolveComment}
                onDelete={handleDeleteComment}
              />
            ))}
          </div>
        )}
      </div>

      {/* New comment input */}
      <div className="border-t p-4">
        {replyToId && (
          <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
            <span>Replying to comment</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => setReplyToId(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            data-comment-input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={replyToId ? 'Write a reply...' : 'Add a comment...'}
            className="flex-1 min-h-[60px] p-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmitComment();
              }
            }}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-muted-foreground">
            Press {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter to send
          </span>
          <Button
            size="sm"
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4 mr-1" />
                Send
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
