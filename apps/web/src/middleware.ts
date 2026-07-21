import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getPublicBaseUrl } from '@/lib/public-url';

// Demo mode: the live showcase deployment skips the login screen entirely.
// See apps/web/src/app/api/demo-login/route.ts for the actual sign-in.
const DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export default auth((req) => {
  const isAuthenticated = !!req.auth;
  const { pathname } = req.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/terms', '/privacy'];
  const isPublicRoute = publicRoutes.includes(pathname);

  // API routes should be handled by the API itself
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Static files and Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Don't redirect authenticated users away from auth pages
  // This allows the signOut flow to complete properly
  // The login/register pages will handle their own redirects if user is authenticated

  // Demo mode: an unauthenticated visitor never sees the login form — the
  // marketing home page, the login page, and every protected route all
  // route through the auto sign-in handler instead. /register,
  // /forgot-password, /terms and /privacy stay untouched and public.
  if (
    DEMO_MODE_ENABLED &&
    !isAuthenticated &&
    (pathname === '/' || pathname === '/login' || !isPublicRoute)
  ) {
    const demoLoginUrl = new URL('/api/demo-login', getPublicBaseUrl(req));
    const target = pathname === '/' || pathname === '/login' ? '/documents' : pathname;
    demoLoginUrl.searchParams.set('redirectTo', target);
    return NextResponse.redirect(demoLoginUrl);
  }

  // Redirect unauthenticated users to login for protected routes
  if (!isAuthenticated && !isPublicRoute) {
    const callbackUrl = encodeURIComponent(pathname);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, getPublicBaseUrl(req)),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
