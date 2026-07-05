// Edge-safe auth config: no database adapter, no Node-only imports. Used by middleware.ts
// (which runs on the Edge runtime) to decode the JWT session and gate page routes.
// The full config in auth.ts extends this with the Drizzle adapter and DB-backed callbacks.

import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

export default {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [GitHub],
  callbacks: {
    // Gate the dashboard: "/" (site list) and "/sites/*" require a session.
    authorized({ auth, request }) {
      const loggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isProtected = path === "/" || path.startsWith("/sites");
      if (isProtected && !loggedIn) return false; // → redirect to /login
      return true;
    },
  },
} satisfies NextAuthConfig;
