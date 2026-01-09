'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';
import { TooltipProvider } from '@dms/ui';
import { useAuthSync } from '@/hooks/useAuthSync';

// Component that syncs NextAuth session with localStorage
function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  useAuthSync();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors
              if (error instanceof Error && error.message.includes('4')) {
                return false;
              }
              return failureCount < 3;
            },
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <AuthSyncProvider>
          <TooltipProvider delayDuration={300}>
            {children}
          </TooltipProvider>
        </AuthSyncProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
