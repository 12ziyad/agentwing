import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicFooter, PublicNav } from "@/components/PublicLayout";
import { hasAcceptedCurrentTerms } from "@/lib/agentwingStore";
import { requireSignedInDashboardUser } from "@/lib/dashboardSession";
import { ACTIVE_TERMS_VERSION } from "@/lib/terms";

export default async function AcceptTermsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user } = await requireSignedInDashboardUser();
  if (await hasAcceptedCurrentTerms(user.userId)) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Review the Terms of Service</h1>
        <p className="mt-4 text-sm leading-6 text-secondary">
          Read the{" "}
          <Link href="/terms" target="_blank" rel="noopener" className="text-brand underline underline-offset-4">
            AgentWing Terms of Service (opens in a new tab)
          </Link>{" "}
          before continuing to your dashboard.
        </p>

        <form action="/api/auth/accept-terms" method="post" className="mt-6 rounded-md border border-divider bg-surface p-5">
          <input type="hidden" name="version" value={ACTIVE_TERMS_VERSION} />
          {error && (
            <p role="alert" className="mb-4 text-sm text-secondary">
              {error === "retry"
                ? "We couldn’t save your acceptance. Please try again."
                : "Review and agree to the current Terms of Service to continue."}
            </p>
          )}
          <label className="flex items-start gap-3 text-sm leading-6">
            <input type="checkbox" name="accepted" value="yes" required className="mt-1 size-4 shrink-0" />
            <span>I agree to the AgentWing Terms of Service.</span>
          </label>
          <button type="submit" className="mt-5 rounded-md border border-brand-outline bg-brand-surface px-4 py-2 text-sm font-semibold text-brand-text hover:border-brand">
            Continue to dashboard
          </button>
        </form>
        <form action="/api/auth/signout" method="post" className="mt-4">
          <button type="submit" className="text-sm text-muted underline underline-offset-4 hover:text-foreground">
            Sign out
          </button>
        </form>
      </main>
      <PublicFooter />
    </div>
  );
}
