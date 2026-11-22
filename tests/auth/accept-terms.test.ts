import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/accept-terms/route";
import { acceptCurrentTerms } from "@/lib/agentwingStore";
import { getDashboardAuth } from "@/lib/auth";
import type { DashboardAuthContext } from "@/lib/agentwingTypes";
import { ACTIVE_TERMS_VERSION } from "@/lib/terms";

vi.mock("@/lib/agentwingStore", () => ({ acceptCurrentTerms: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getDashboardAuth: vi.fn() }));

const origin = "https://agentwing.gpmai.dev";

function submit(fields: Record<string, string>, requestOrigin = origin, fetchSite?: string) {
  return POST(new Request(`${origin}/api/auth/accept-terms`, {
    method: "POST",
    headers: { origin: requestOrigin, ...(fetchSite ? { "sec-fetch-site": fetchSite } : {}) },
    body: new URLSearchParams(fields),
  }));
}

describe("dashboard terms acceptance", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getDashboardAuth).mockResolvedValue({
      user: { userId: "user-123" },
    } as DashboardAuthContext);
  });

  it("records consent for the authenticated user before continuing", async () => {
    const response = await submit({ accepted: "yes", version: ACTIVE_TERMS_VERSION });
    expect(acceptCurrentTerms).toHaveBeenCalledWith("user-123");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/dashboard");
  });

  it.each<Record<string, string>>([
    { version: ACTIVE_TERMS_VERSION },
    { accepted: "yes", version: "outdated" },
  ])("requires an explicit check for the current version", async (fields) => {
    const response = await submit(fields);
    expect(response.headers.get("location")).toBe("/accept-terms?error=review");
    expect(acceptCurrentTerms).not.toHaveBeenCalled();
  });

  it("rejects requests from other origins", async () => {
    const response = await submit({ accepted: "yes", version: ACTIVE_TERMS_VERSION }, "https://gpmai.dev");
    expect(response.status).toBe(403);
    expect(acceptCurrentTerms).not.toHaveBeenCalled();
  });

  it("uses browser fetch metadata when the proxy rewrites the URL", async () => {
    const response = await submit({ accepted: "yes", version: ACTIVE_TERMS_VERSION }, "https://original.example", "same-origin");
    expect(response.headers.get("location")).toBe("/dashboard");
  });

  it("returns to the prompt when saving fails", async () => {
    vi.mocked(acceptCurrentTerms).mockRejectedValueOnce(new Error("Database unavailable"));
    const response = await submit({ accepted: "yes", version: ACTIVE_TERMS_VERSION });
    expect(response.headers.get("location")).toBe("/accept-terms?error=retry");
  });
});
