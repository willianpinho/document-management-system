import type { NextRequest } from 'next/server';

/**
 * Resolve the public-facing origin for building absolute redirect URLs.
 *
 * Self-hosted behind Traefik, `request.url` / `request.nextUrl.origin` can
 * reflect the container's internal bind address (HOSTNAME=0.0.0.0, PORT=3000
 * in apps/web/Dockerfile) instead of the public domain, producing an
 * unreachable redirect like `https://0.0.0.0:3000/login`. Resolve the real
 * origin instead, in order of trust:
 *   1. NEXTAUTH_URL — the app already declares this as its public origin for
 *      Auth.js, so it's the most reliable source when set.
 *   2. x-forwarded-proto + x-forwarded-host — Traefik sets both on every
 *      proxied request.
 *   3. request.nextUrl.origin — last resort, only correct when not behind a
 *      reverse proxy (e.g. local dev without Traefik in front).
 */
export function getPublicBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXTAUTH_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}
