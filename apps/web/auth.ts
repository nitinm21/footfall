// Full Auth.js (NextAuth v5) config for the app (Node runtime). GitHub OAuth for real users;
// a test-only Credentials provider (env-gated) makes headless e2e login possible without an
// external OAuth round-trip. JWT sessions + the Drizzle adapter: users/accounts persist to the
// metadata DB (stable ids for site membership) while sessions stay stateless (edge-decodable).

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";
import { db } from "./db";
import { accounts, sessions, siteMembers, sites, users, verificationTokens } from "./db/schema";

const E2E = process.env.FOOTFALL_E2E === "1";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    ...authConfig.providers,
    // Test-only: authorize a seeded user by email (no password). Never enabled in prod.
    ...(E2E
      ? [
          Credentials({
            id: "e2e",
            name: "E2E login",
            credentials: { email: { label: "Email", type: "text" } },
            authorize: async (creds) => {
              const email = typeof creds?.email === "string" ? creds.email : null;
              if (!email) return null;
              const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
              return u ? { id: u.id, email: u.email, name: u.name } : null;
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
    // Bootstrap owner access: Phase 5 has no onboarding UI (that's Phase 6), so the configured
    // operator is auto-attached as owner to their own live sites on first sign-in. Idempotent.
    async signIn({ user }) {
      const owner = process.env.FOOTFALL_OWNER_EMAIL;
      if (owner && user?.email === owner && user.id) {
        const live = await db.select().from(sites).where(eq(sites.source, "live"));
        for (const s of live) {
          await db
            .insert(siteMembers)
            .values({ siteId: s.id, userId: user.id, role: "owner" })
            .onConflictDoNothing();
        }
      }
      return true;
    },
  },
});
