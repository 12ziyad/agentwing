import { cookies } from "next/headers";
import { Hero } from "@/components/Hero";
import { getDashboardAuthFromCookieHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
  const auth = await getDashboardAuthFromCookieHeader(cookieHeader);
  const isSignedIn = Boolean(auth);

  return (
    <div className="min-h-full bg-[#05070d]">
      <Hero isSignedIn={isSignedIn} />
    </div>
  );
}
