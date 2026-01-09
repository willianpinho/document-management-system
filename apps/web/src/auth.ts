import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import 'next-auth/jwt';

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

        try {
          const response = await fetch(
            `${process.env.API_URL || 'http://localhost:4000'}/api/v1/auth/login`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            }
          );

          if (!response.ok) {
            return null;
          }

          const data = await response.json();

          return {
            id: data.data.user.id,
            email: data.data.user.email,
            name: data.data.user.name,
            image: data.data.user.avatarUrl,
            accessToken: data.data.accessToken,
            refreshToken: data.data.refreshToken,
          };
        } catch {
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
            const response = await fetch(
              `${process.env.API_URL || 'http://localhost:4000'}/api/v1/auth/oauth/google`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  idToken: account.id_token,
                  accessToken: account.access_token,
                }),
              }
            );

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
        const response = await fetch(
          `${process.env.API_URL || 'http://localhost:4000'}/api/v1/auth/refresh`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              refreshToken: token.refreshToken,
            }),
          }
        );

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
