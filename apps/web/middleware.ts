// Route gating on the Edge runtime. Uses the DB-free auth.config (JWT decode only), so no
// Node-only database driver is pulled into the edge bundle. The `authorized` callback decides.
import NextAuth from "next-auth";
import authConfig from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Run on pages only. Excludes /api/* (ingest is token-authorized; auth handler is public;
  // data routes self-gate), Next internals, the login page, and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|llms.txt|docs).*)"],
};
