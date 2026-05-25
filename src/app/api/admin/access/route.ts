import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, getAdminAccessCode, hashAdminAccessCode } from "@/lib/adminAccess";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const submittedCode = String(formData.get("code") ?? "");
  const accessCode = getAdminAccessCode();
  const url = new URL(request.url);

  if (!accessCode || submittedCode !== accessCode) {
    return NextResponse.redirect(new URL("/dashboard?access=denied", url.origin), { status: 303 });
  }

  const response = NextResponse.redirect(new URL("/dashboard", url.origin), { status: 303 });
  response.cookies.set(ADMIN_COOKIE_NAME, await hashAdminAccessCode(accessCode), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
