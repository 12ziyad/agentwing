import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardAuthFromCookieHeader } from "@/lib/auth";
import type { DashboardAuthContext } from "@/lib/agentwingTypes";

/**
 * The signed-in dashboard user, or a redirect to sign-in.
 *
 * Every dashboard page needs the same three lines — read cookies, resolve the
 * session, bail if there isn't one — and each page writing them itself is how
 * `auth?.workspaceId` spread through the tree. That optional chain is what let
 * an unauthenticated render reach the store with no workspace, which the store
 * used to answer with every tenant's rows.
 *
 * This returns a non-optional context, so a page cannot accidentally query
 * without a workspace.
 */
export async function requireDashboardSession(): Promise<DashboardAuthContext> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");

  const auth = await getDashboardAuthFromCookieHeader(cookieHeader);
  if (!auth) redirect("/api/auth/signin/google");

  return auth;
}
