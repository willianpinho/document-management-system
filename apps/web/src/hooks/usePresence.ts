'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@/lib/api';

export interface CursorPosition {
  page: number;
  x: number;
  y: number;
}

export interface PresenceUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  cursorPosition?: CursorPosition | null;
  color: string;
  lastActiveAt: string;
}

interface UsePresenceOptions {
  documentId: string;
  enabled?: boolean;
  onViewersChange?: (viewers: PresenceUser[]) => void;
  onCursorChange?: (userId: string, position: CursorPosition | null) => void;
}

interface UsePresenceReturn {
  viewers: PresenceUser[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  updateCursor: (position: CursorPosition | null) => void;
  leave: () => void;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

export function usePresence({
  documentId,
  enabled = true,
  onViewersChange,
  onCursorChange,
}: UsePresenceOptions): UsePresenceReturn {
  const [viewers, setViewers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const hasJoinedRef = useRef(false);

  // Store callbacks in refs to avoid useEffect re-runs
  const onViewersChangeRef = useRef(onViewersChange);
  const onCursorChangeRef = useRef(onCursorChange);

  // Update refs when callbacks change
  useEffect(() => {
    onViewersChangeRef.current = onViewersChange;
  }, [onViewersChange]);

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange;
  }, [onCursorChange]);

  // Connect to WebSocket
  useEffect(() => {
    if (!enabled || !documentId) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setError('Not authenticated');
      setIsLoading(false);
      return;
    }

    // Create socket connection
    const socket = io(`${SOCKET_URL}/realtime`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Connection established
    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    // Connection error
    socket.on('connect_error', (err) => {
      setError(`Connection error: ${err.message}`);
      setIsConnected(false);
    });

    // Disconnected
    socket.on('disconnect', () => {
      setIsConnected(false);
      hasJoinedRef.current = false;
    });

    // Connected event from server
    socket.on('connected', (data) => {
      if (data.success && !hasJoinedRef.current) {
        // Join document presence
        socket.emit('presence:join', { documentId }, (response: any) => {
          setIsLoading(false);
          if (response.success) {
            setViewers(response.viewers || []);
            hasJoinedRef.current = true;
            onViewersChangeRef.current?.(response.viewers || []);
          } else {
            setError(response.error?.message || 'Failed to join presence');
          }
        });
      }
    });

    // Presence events
    socket.on('presence:join', (data) => {
      if (data.documentId === documentId) {
        setViewers(data.viewers);
        onViewersChangeRef.current?.(data.viewers);
      }
    });

    socket.on('presence:leave', (data) => {
      if (data.documentId === documentId) {
        setViewers(data.viewers);
        onViewersChangeRef.current?.(data.viewers);
      }
    });

    socket.on('presence:cursor', (data) => {
      if (data.documentId === documentId) {
        setViewers((prev) =>
          prev.map((v) =>
            v.id === data.userId
              ? { ...v, cursorPosition: data.cursorPosition }
              : v
          )
        );
        onCursorChangeRef.current?.(data.userId, data.cursorPosition);
      }
    });

    socket.on('presence:sync', (data) => {
      if (data.documentId === documentId) {
        setViewers(data.viewers);
        onViewersChangeRef.current?.(data.viewers);
      }
    });

    // Cleanup on unmount
    return () => {
      if (hasJoinedRef.current) {
        socket.emit('presence:leave', { documentId });
      }
      socket.disconnect();
      socketRef.current = null;
      hasJoinedRef.current = false;
    };
  }, [documentId, enabled]);

  // Update cursor position
  const updateCursor = useCallback(
    (position: CursorPosition | null) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('presence:cursor', {
          documentId,
          position,
        });
      }
    },
    [documentId]
  );

  // Leave presence
  const leave = useCallback(() => {
    if (socketRef.current?.connected && hasJoinedRef.current) {
      socketRef.current.emit('presence:leave', { documentId });
      hasJoinedRef.current = false;
    }
  }, [documentId]);

  return {
    viewers,
    isConnected,
    isLoading,
    error,
    updateCursor,
    leave,
  };
}
