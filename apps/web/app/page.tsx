import { redirect } from "next/navigation";
import { auth, signOut } from "../auth";
import { listUserSites } from "../lib/access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sites = await listUserSites(session.user.id);
  if (sites.length === 1 && sites[0]) redirect(`/sites/${sites[0].token}`);

  return (
    <main className="wrap">
      <div className="masthead">
        <div className="brand">
          <span className="steps">👣</span> Footfall
        </div>
        <span className="sub">{session.user.name ?? session.user.email}</span>
        <span style={{ marginLeft: "auto" }}>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="linkbtn"
              style={{ border: 0, background: "none", cursor: "pointer" }}
            >
              sign out
            </button>
          </form>
        </span>
      </div>

      <section className="mod">
        <div className="modhead">
          <h2>Your sites</h2>
        </div>
        {sites.length === 0 ? (
          <p style={{ color: "var(--muted)", marginTop: 0 }} data-testid="no-sites">
            No sites yet. Install the snippet on a site to start seeing agent traffic.
          </p>
        ) : (
          <div className="sitegrid">
            {sites.map((s) => (
              <a className="sitecard" key={s.id} href={`/sites/${s.token}`}>
                <div className="nm">{s.name}</div>
                <div className="tk">{s.token}</div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
