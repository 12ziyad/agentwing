import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ApprovalsPage() {
  redirect("/dashboard/runs?status=waiting_approval");
}
