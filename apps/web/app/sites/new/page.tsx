import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { db, eq } from "../../../db";
import { siteMembers, sites } from "../../../db/schema";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add a site · Footfall" };

async function createSite(formData: FormData): Promise<void> {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const token = String(formData.get("token") ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  const name = String(formData.get("name") ?? "").trim() || token;
  if (!token) redirect("/sites/new?error=missing");

  const existing = await db.select().from(sites).where(eq(sites.token, token)).limit(1);
  if (existing[0]) redirect("/sites/new?error=exists");

  const [site] = await db.insert(sites).values({ token, name, source: "live" }).returning();
  if (site) {
    await db
      .insert(siteMembers)
      .values({ siteId: site.id, userId: session.user.id, role: "owner" })
      .onConflictDoNothing();
  }
  redirect(`/sites/${encodeURIComponent(token)}`);
}

export default async function NewSitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { error } = await searchParams;

  return (
    <main className="wrap" style={{ maxWidth: 520 }}>
      <div className="masthead">
        <div className="brand">
          <span className="steps">👣</span> Footfall
        </div>
      </div>
      <section className="mod">
        <div className="modhead">
          <h2>Add a site</h2>
        </div>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Use your site's domain as its token — that's the value the snippet sends. You'll get a
          one-line install command next.
        </p>
        {error === "exists" ? (
          <div className="callout" style={{ background: "var(--crit-soft)", color: "var(--crit)" }}>
            A site with that token already exists.
          </div>
        ) : error === "missing" ? (
          <div className="callout" style={{ background: "var(--crit-soft)", color: "var(--crit)" }}>
            Please enter a domain/token.
          </div>
        ) : null}
        <form action={createSite} style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Domain / token</span>
            <input
              name="token"
              placeholder="mysite.com"
              required
              style={{
                font: "inherit",
                padding: "8px 12px",
                border: "1px solid var(--line)",
                borderRadius: 8,
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Display name (optional)</span>
            <input
              name="name"
              placeholder="My site"
              style={{
                font: "inherit",
                padding: "8px 12px",
                border: "1px solid var(--line)",
                borderRadius: 8,
              }}
            />
          </label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="submit"
              style={{
                font: "inherit",
                fontWeight: 600,
                background: "var(--ink)",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                padding: "9px 18px",
                cursor: "pointer",
              }}
            >
              Create site
            </button>
            <a className="linkbtn" href="/">
              Cancel
            </a>
          </div>
        </form>
      </section>
    </main>
  );
}
