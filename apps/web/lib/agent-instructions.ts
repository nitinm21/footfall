// The copy-paste task a user hands to their AI coding agent (Claude Code, Cursor, …) to install
// Footfall. Thin on purpose: it drives `npx footfall init` (which does the detection + codemod) and
// is explicit about the autonomy boundary — the agent owns the repo half; the host half (Vercel
// env + deploy) is agent-done only when the Vercel CLI is authed, else handed back, and never
// without the user's OK. Scope is Next.js / Vercel only (v1).

export const DEFAULT_INGEST_URL = "https://footfall-phi.vercel.app/api/ingest";

export function agentInstructions(token: string, ingestUrl: string = DEFAULT_INGEST_URL): string {
  return `Install Footfall (agent-experience analytics) on this project.

Footfall is observe-only and fails open — it never blocks, delays, or modifies a response, sets no
cookies, and stores no request bodies. Its whole job is to show which AI agents hit this site and
where they fail.

SCOPE: this snippet install works only for a **Next.js app deployed on Vercel**. If this project is
not Next.js/Vercel, stop and tell me — Footfall can still analyze a log export instead.

Site token (already provisioned — do not change it): ${token}

Do the following in order. Do NOT commit, push, or deploy without my explicit approval.

1. Make sure the git working tree is clean (ask me to commit/stash if not) so the whole install is
   reviewable as one diff.

2. Run the installer from the project root — it detects the router/package-manager, wraps
   middleware.ts (or creates it), wires the 5xx beacon in instrumentation.ts, and writes .env.local:
     npx footfall init ${token}
   If it prints "Manual step" for an unrecognized middleware, follow those instructions exactly and
   do not force-edit the file.

3. Confirm the app still builds (use this project's build command, e.g. \`next build\`).

4. Set the two required env vars on Vercel so the DEPLOYED middleware actually emits (.env.local is
   local-only and won't reach production). First check the Vercel CLI:
     vercel whoami
   - If that succeeds and the repo is linked (.vercel/project.json exists):
       printf '%s' "${token}" | vercel env add FOOTFALL_TOKEN production
       printf '%s' "${ingestUrl}" | vercel env add FOOTFALL_INGEST_URL production
     (If a var already exists, \`vercel env rm\` it first, then re-add — keep it idempotent.)
   - If \`vercel whoami\` fails or the repo isn't linked: tell me to run \`vercel login\` and
     \`vercel link\` (these are interactive — I'll do them), then continue. Or, if I prefer, tell me
     to add these two variables in the Vercel dashboard myself:
       FOOTFALL_TOKEN=${token}
       FOOTFALL_INGEST_URL=${ingestUrl}

5. Show me the git diff and the env changes, and ask for my confirmation before deploying.

6. After I confirm, deploy (\`vercel --prod\`, or via my normal git push if I say so). Note: env-var
   changes only take effect on a new deployment. Then verify the end-to-end round-trip:
     npx footfall check ${token}

7. Report back: exactly what you changed, whether \`footfall check\` confirmed live events, and any
   steps still left to me. Be honest — "code wired" is not the same as "live in production."`;
}
