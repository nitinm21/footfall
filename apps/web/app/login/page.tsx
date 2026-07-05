import { redirect } from "next/navigation";
import { auth, signIn } from "../../auth";

export const metadata = { title: "Sign in · Footfall" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="wrap" style={{ maxWidth: 420 }}>
      <div className="masthead">
        <div className="brand">
          <span className="steps">👣</span> Footfall
        </div>
      </div>
      <section className="mod">
        <div className="modhead">
          <h2>Sign in</h2>
        </div>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Agent-experience analytics for your sites — see the AI agents in your traffic, where they
          fail, and whether your fixes worked.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            style={{
              font: "inherit",
              fontWeight: 600,
              background: "var(--ink)",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            Continue with GitHub
          </button>
        </form>
      </section>
    </main>
  );
}
