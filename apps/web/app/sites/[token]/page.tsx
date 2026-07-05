import { notFound, redirect } from "next/navigation";
import { auth } from "../../../auth";
import { getAccessibleSite, listUserSites } from "../../../lib/access";
import { buildDashboard } from "../../../src/dashboard-data";
import { Dashboard } from "./dashboard";

export const dynamic = "force-dynamic";

export default async function SitePage({ params }: { params: Promise<{ token: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { token } = await params;
  // Membership is the only way in — a non-member (or unknown token) is indistinguishable: 404.
  const site = await getAccessibleSite(session.user.id, token);
  if (!site) notFound();

  const [data, sites] = await Promise.all([
    buildDashboard(site, Date.now()),
    listUserSites(session.user.id),
  ]);

  return (
    <Dashboard
      data={data}
      sites={sites}
      userName={session.user.name ?? session.user.email ?? null}
    />
  );
}
