import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from 'next-auth';

import { signIn } from '@/auth';

// Route: /api/demo-login
// Render mode: force-dynamic (auth side effect, never cached)
// Auth: public entry point for demo mode only — real login flow is untouched

/**
 * Demo-mode auto sign-in.
 *
 * Server-side only: the demo credentials are read from process.env here and
 * never sent to the browser. `middleware.ts` redirects unauthenticated
 * visitors here when NEXT_PUBLIC_DEMO_MODE=true; this handler signs them in
 * via the existing Credentials provider (same path as a real login) and
 * redirects to the target page. Outside demo mode, or if the demo user
 * isn't configured/seeded, it just falls back to the real /login page.
 */
export async function GET(request: NextRequest) {
  const demoModeEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const email = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;

  if (!demoModeEnabled || !email || !password) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const redirectTo = sanitizeRedirectTarget(request.nextUrl.searchParams.get('redirectTo'));

  try {
    await signIn('credentials', { email, password, redirectTo });
  } catch (error) {
    // AuthError = the demo credentials were rejected (e.g. not seeded on
    // this environment's DB). Anything else is the internal NEXT_REDIRECT
    // signal from a successful signIn() and must propagate.
    if (error instanceof AuthError) {
      return NextResponse.redirect(new URL('/login?demoError=1', request.url));
    }
    throw error;
  }

  return NextResponse.redirect(new URL(redirectTo, request.url));
}

// Only allow same-app relative paths — prevents an open redirect via
// ?redirectTo=https://evil.example on this publicly reachable route.
function sanitizeRedirectTarget(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/documents';
  }
  return raw;
}
