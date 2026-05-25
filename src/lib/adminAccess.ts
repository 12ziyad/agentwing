export const ADMIN_COOKIE_NAME = "agentwing_admin_access";

export function getAdminAccessCode() {
  return process.env.ADMIN_ACCESS_CODE ?? process.env.DEMO_ACCESS_CODE;
}

export async function hashAdminAccessCode(code: string) {
  const data = new TextEncoder().encode(code);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function isAdminRequest(request: Request) {
  const accessCode = getAdminAccessCode();
  if (!accessCode) return false;

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const index = entry.indexOf("=");
        return index === -1 ? [entry, ""] : [entry.slice(0, index), decodeURIComponent(entry.slice(index + 1))];
      }),
  );

  return cookies[ADMIN_COOKIE_NAME] === (await hashAdminAccessCode(accessCode));
}

export function adminRequiredResponse() {
  return Response.json(
    {
      error: "Admin access required",
      feedback: "Open /dashboard and authenticate before managing projects or API keys.",
    },
    { status: 401 },
  );
}
