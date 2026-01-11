'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { TooltipProvider } from '@dms/ui';
import { useAuthSync } from '@/hooks/useAuthSync';
import { useAuth } from '@/hooks/useAuth';

// Component that syncs NextAuth session with localStorage and loads organizations
function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuthSync();

  // This triggers organization loading once tokens are synced
  const { currentOrganization, isLoading } = useAuth();

  // Wait for organization to be loaded before rendering children
  // This ensures X-Organization-ID is available for API calls
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      // Wait until organizations finish loading AND we have a current organization
      // (or loading is done and there are no organizations - edge case)
      if (!isLoading && currentOrganization) {
        setReady(true);
      } else if (!isLoading) {
        // Organizations loaded but none found - still allow rendering
        // (user might need to create/join an organization)
        setReady(true);
      }
    } else if (status === 'unauthenticated') {
      setReady(true);
    }
  }, [status, currentOrganization, isLoading]);

  // Don't render children until we're ready (organization loaded or unauthenticated)
  if (!ready) {
    return null; // Let the loading state be handled by layout
  }

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
