import { acceptCurrentTerms } from "@/lib/agentwingStore";
import { getDashboardAuth } from "@/lib/auth";
import { ACTIVE_TERMS_VERSION } from "@/lib/terms";

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  const sameOrigin = fetchSite
    ? fetchSite === "same-origin"
    : request.headers.get("origin") === new URL(request.url).origin;
  if (!sameOrigin) {
    return new Response(null, { status: 403 });
  }

  const auth = await getDashboardAuth(request);
  if (!auth) return redirect("/api/auth/signin/google");

  const form = await request.formData().catch(() => undefined);
  if (form?.get("accepted") !== "yes" || form.get("version") !== ACTIVE_TERMS_VERSION) {
    return redirect("/accept-terms?error=review");
  }

  try {
    await acceptCurrentTerms(auth.user.userId);
  } catch {
    return redirect("/accept-terms?error=retry");
  }

  return redirect("/dashboard");
}
