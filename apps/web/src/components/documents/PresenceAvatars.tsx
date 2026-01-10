'use client';

import { useMemo } from 'react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@dms/ui';

import type { PresenceUser } from '@/hooks/usePresence';

interface PresenceAvatarsProps {
  viewers: PresenceUser[];
  currentUserId?: string;
  maxVisible?: number;
}

export function PresenceAvatars({
  viewers,
  currentUserId,
  maxVisible = 4,
}: PresenceAvatarsProps) {
  // Filter out current user and limit visible
  const otherViewers = useMemo(
    () => viewers.filter((v) => v.id !== currentUserId),
    [viewers, currentUserId]
  );

  const visibleViewers = otherViewers.slice(0, maxVisible);
  const hiddenCount = otherViewers.length - maxVisible;

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

  if (otherViewers.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex items-center -space-x-2">
        {visibleViewers.map((viewer) => (
          <Tooltip key={viewer.id}>
            <TooltipTrigger asChild>
              <div
                className="relative"
                style={{
                  zIndex: visibleViewers.indexOf(viewer) + 1,
                }}
              >
                <Avatar
                  className="h-8 w-8 border-2 border-background ring-2"
                  style={{ ['--tw-ring-color' as string]: viewer.color } as React.CSSProperties}
                >
                  <AvatarImage src={viewer.avatarUrl || undefined} />
                  <AvatarFallback
                    className="text-xs"
                    style={{ backgroundColor: viewer.color, color: 'white' }}
                  >
                    {getInitials(viewer.name, viewer.email)}
                  </AvatarFallback>
                </Avatar>
                {/* Online indicator */}
                <span
                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background"
                  title="Online"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{viewer.name || viewer.email}</p>
              <p className="text-xs text-muted-foreground">Viewing now</p>
            </TooltipContent>
          </Tooltip>
        ))}

        {hiddenCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="relative"
                style={{ zIndex: maxVisible + 1 }}
              >
                <Avatar className="h-8 w-8 border-2 border-background bg-muted">
                  <AvatarFallback className="text-xs">
                    +{hiddenCount}
                  </AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{hiddenCount} more viewing</p>
              <ul className="text-xs text-muted-foreground mt-1">
                {otherViewers.slice(maxVisible).map((v) => (
                  <li key={v.id}>{v.name || v.email}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
