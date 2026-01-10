'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText } from 'lucide-react';

import { setAuthTokens } from '@/lib/api';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      return;
    }

    if (accessToken && refreshToken) {
      // Store tokens
      setAuthTokens(accessToken, refreshToken);

      // Redirect to dashboard
      router.replace('/dashboard');
    } else {
      setError('Authentication failed. Please try again.');
    }
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <FileText className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-destructive">
          Authentication Failed
        </h1>
        <p className="text-center text-muted-foreground">{error}</p>
        <button
          onClick={() => router.push('/login')}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <FileText className="h-8 w-8 animate-pulse text-primary" />
      </div>
      <h1 className="text-xl font-semibold">Completing sign in...</h1>
      <p className="text-muted-foreground">Please wait while we redirect you.</p>
      <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 animate-[loading_1s_ease-in-out_infinite] bg-primary" />
      </div>
    </div>
  );
}
