"use server";

import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { db } from "../../../db";
import { fixes } from "../../../db/schema";
import { getAccessibleSite } from "../../../lib/access";

/**
 * Mark a failing path as fixed (the owner shipped an llms.txt, a redirect, etc.). Drives the
 * failure feed's "fix live" status and the fix-impact card. Auth + membership are re-checked
 * server-side — a server action is a public endpoint, so this is a security boundary, not UI.
 */
export async function markFixDeployed(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const path = String(formData.get("path") ?? "");
  const type = String(formData.get("type") ?? "dead_end");

  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const site = await getAccessibleSite(session.user.id, token);
  if (!site || !path) throw new Error("not found");

  await db
    .insert(fixes)
    .values({ siteId: site.id, path, type })
    .onConflictDoUpdate({
      target: [fixes.siteId, fixes.path],
      set: { markedDeployedAt: new Date(), type },
    });

  revalidatePath(`/sites/${token}`);
}
