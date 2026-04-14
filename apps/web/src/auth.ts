import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import 'next-auth/jwt';

// Resolves the backend API host for server-side calls (NextAuth callbacks).
// Order of precedence:
// 1. API_URL  — server-only var, lets us point to an internal docker hostname
//               (e.g. http://portfolio-dms-api:4000) to avoid the public TLS hop.
// 2. NEXT_PUBLIC_API_URL — same value as the browser uses; safe fallback so the
//                          server side never silently falls back to localhost.
// 3. http://localhost:4000 — local dev fallback only.
const API_HOST = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface BackendAuthSuccess {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface BackendEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const loginUrl = `${API_HOST}/api/v1/auth/login`;

        try {
          const response = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!response.ok) {
            console.error(
              `[next-auth][credentials] backend login returned ${response.status} for ${loginUrl}`,
            );
            return null;
          }

          const json = (await response.json()) as
            | BackendEnvelope<BackendAuthSuccess>
            | BackendAuthSuccess;
          // Backend wraps success responses in { success, data, ... } via
          // TransformInterceptor, but tolerate an unwrapped shape too.
          const payload: BackendAuthSuccess | undefined =
            'data' in json && json.data
              ? (json.data as BackendAuthSuccess)
              : (json as BackendAuthSuccess);

          if (!payload?.user?.id || !payload.accessToken) {
            console.error(
              '[next-auth][credentials] unexpected backend response shape',
              JSON.stringify(json).slice(0, 300),
            );
            return null;
          }

          return {
            id: payload.user.id,
            email: payload.user.email,
            name: payload.user.name,
            image: payload.user.avatarUrl,
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
          };
        } catch (err) {
          console.error(
            `[next-auth][credentials] failed to reach ${loginUrl}:`,
            err instanceof Error ? err.message : err,
          );
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
    newUser: '/documents',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        if (account.provider === 'google') {
          try {
            const response = await fetch(`${API_HOST}/api/v1/auth/oauth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                idToken: account.id_token,
                accessToken: account.access_token,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              return {
                ...token,
                accessToken: data.data.accessToken,
                refreshToken: data.data.refreshToken,
                expiresAt: Date.now() + data.data.expiresIn * 1000,
              };
            }
          } catch {
            return token;
          }
        }

        return {
          ...token,
          accessToken: (user as { accessToken?: string }).accessToken,
          refreshToken: (user as { refreshToken?: string }).refreshToken,
          expiresAt: Date.now() + 15 * 60 * 1000,
        };
      }

      if (Date.now() < (token.expiresAt as number)) {
        return token;
      }

      try {
        const response = await fetch(`${API_HOST}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refreshToken: token.refreshToken,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to refresh token');
        }

        const data = await response.json();

        return {
          ...token,
          accessToken: data.data.accessToken,
          refreshToken: data.data.refreshToken ?? token.refreshToken,
          expiresAt: Date.now() + data.data.expiresIn * 1000,
        };
      } catch {
        return { ...token, error: 'RefreshAccessTokenError' };
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.error = token.error as string | undefined;
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
  // Auth.js v5 uses AUTH_SECRET, fallback to NEXTAUTH_SECRET for compatibility
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
});

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    refreshToken?: string;
    error?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: string;
  }
}
