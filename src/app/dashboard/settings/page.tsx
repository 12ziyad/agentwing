import { cookies } from "next/headers";
import Link from "next/link";
import { DangerZoneControls, CopyButton } from "./SettingsClientControls";
import { getDashboardAuthFromCookieHeader } from "@/lib/auth";
import { getSandboxConfigForWorkspace, listApiKeys } from "@/lib/agentwingStore";
import type { AgentWingApiKeyRecord, SandboxProviderConfig } from "@/lib/agentwingTypes";

export const dynamic = "force-dynamic";

const NOT_AVAILABLE = "Not available yet";

async function safeLoad<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");

  const auth = await safeLoad(
    () => getDashboardAuthFromCookieHeader(cookieHeader),
    undefined,
  );

  const user = auth?.mode === "user" ? auth.user : undefined;
  const workspace = auth?.mode === "user" ? auth.workspace : undefined;

  const [allKeys, sandboxConfig] = await Promise.all([
    workspace
      ? safeLoad<AgentWingApiKeyRecord[]>(() => listApiKeys(undefined, workspace.workspaceId), [])
      : Promise.resolve([]),
    workspace
      ? safeLoad<SandboxProviderConfig | null>(() => getSandboxConfigForWorkspace(workspace.workspaceId), null)
      : Promise.resolve(null),
  ]);

  const activeKeys = allKeys.filter((key) => !key.revokedAt);
  const revokedKeys = allKeys.filter((key) => key.revokedAt);
  const connectedSandboxProviders = sandboxConfig?.connected || sandboxConfig?.e2bKeySaved ? 1 : 0;
  const lastSandboxTest = sandboxConfig?.lastTestedAt
    ? `${sandboxConfig.lastTestStatus ?? "tested"} at ${formatDate(sandboxConfig.lastTestedAt)}`
    : NOT_AVAILABLE;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Settings</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Account and workspace settings</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your account, security posture, data controls, support links, and safe deletion request flow.
        </p>
      </div>

      <SettingsSection title="Account">
        <div className="space-y-3 text-sm">
          {user?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" referrerPolicy="no-referrer" className="size-14 rounded-full border border-white/[0.1]" />
          )}
          <Row label="Name" value={user?.name ?? NOT_AVAILABLE} />
          <Row label="Email" value={user?.email ?? NOT_AVAILABLE} />
          <Row label="Avatar" value={user?.image ? "Available" : NOT_AVAILABLE} />
          <Row label="User ID" value={user?.userId ?? NOT_AVAILABLE} mono />
          <Row label="Login method" value="Google" />
          <Row label="Account created" value={formatDate(user?.createdAt)} />
          <Row label="Last login" value={formatDate(user?.lastLoginAt)} />
          {user?.deleteRequestedAt && <Row label="Deletion request" value={formatDate(user.deleteRequestedAt)} />}
        </div>
        <div className="mt-5">
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="rounded border border-white/[0.1] px-4 py-2 text-xs font-semibold text-slate-300 transition hover:text-white">
              Sign out
            </button>
          </form>
        </div>
        <p className="mt-3 text-xs text-slate-500">AgentWing uses Google sign-in. No password is stored by AgentWing.</p>
      </SettingsSection>

      <SettingsSection title="Workspace">
        <div className="space-y-3 text-sm">
          <Row label="Workspace name" value={workspace?.name ?? NOT_AVAILABLE} />
          <Row label="Workspace ID" value={workspace?.workspaceId ?? NOT_AVAILABLE} mono copyable={Boolean(workspace?.workspaceId)} />
          <Row label="Owner email" value={user?.email ?? NOT_AVAILABLE} />
          <Row label="Plan" value="Free/Beta" />
          <Row label="Created date" value={formatDate(workspace?.createdAt)} />
          {workspace?.deleteRequestedAt && <Row label="Deletion request" value={formatDate(workspace.deleteRequestedAt)} />}
        </div>
      </SettingsSection>

      <SettingsSection title="Security">
        <div className="space-y-2 text-sm text-slate-300">
          <SecurityItem ok label="Google OAuth enabled" />
          <SecurityItem ok={false} label="Password login: not used" />
          <SecurityItem ok label="API keys: hashed at rest" />
          <SecurityItem ok label="E2B/BYOK keys: encrypted server-side" />
          <SecurityItem ok label="Admin access: restricted" />
        </div>
      </SettingsSection>

      <SettingsSection title="API & Sandbox">
        <div className="space-y-3 text-sm">
          <Row label="Total API keys" value={String(allKeys.length)} />
          <Row label="Active API keys" value={String(activeKeys.length)} />
          <Row label="Revoked API keys" value={String(revokedKeys.length)} />
          <Row label="Connected sandbox providers" value={String(connectedSandboxProviders)} />
          <Row label="Last sandbox test" value={lastSandboxTest} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/dashboard/api-keys" className="rounded border border-white/[0.1] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:text-white">
            Manage API keys
          </Link>
          <Link href="/dashboard/sandboxes" className="rounded border border-white/[0.1] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:text-white">
            Manage sandboxes
          </Link>
        </div>
      </SettingsSection>

      <SettingsSection title="Data & Privacy">
        <div className="grid gap-5 text-sm text-slate-300 md:grid-cols-2">
          <DataList
            title="What AgentWing stores"
            items={[
              "Google profile basics",
              "workspace/project metadata",
              "API key hashes",
              "encrypted sandbox credentials",
              "policies",
              "receipts",
              "usage counters",
              "product/security events",
            ]}
          />
          <DataList
            title="What AgentWing does not store"
            items={[
              "no password",
              "no raw API key after creation",
              "no plain-text E2B key",
              "no OAuth secret exposed to browser",
            ]}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="mailto:founder@gpmai.dev?subject=Data export request" className="rounded border border-white/[0.1] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:text-white">
            Request data export
          </a>
          <a href="mailto:founder@gpmai.dev?subject=Account deletion question" className="rounded border border-white/[0.1] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:text-white">
            Ask about deletion
          </a>
        </div>
      </SettingsSection>

      <SettingsSection title="Support">
        <div className="flex flex-wrap gap-3 text-sm">
          <a href="mailto:founder@gpmai.dev" className="rounded border border-white/[0.1] px-3 py-2 text-slate-300 transition hover:text-white">
            founder@gpmai.dev
          </a>
          <a href="https://github.com/12ziyad" target="_blank" rel="noopener noreferrer" className="rounded border border-white/[0.1] px-3 py-2 text-slate-300 transition hover:text-white">
            GitHub
          </a>
          <a href="https://www.reddit.com/user/Far_Pangolin_7657/" target="_blank" rel="noopener noreferrer" className="rounded border border-white/[0.1] px-3 py-2 text-slate-300 transition hover:text-white">
            Reddit
          </a>
        </div>
      </SettingsSection>

      <SettingsSection title="Legal">
        <div className="flex flex-wrap gap-3 text-sm">
          {[
            { href: "/privacy", label: "Privacy" },
            { href: "/terms", label: "Terms" },
            { href: "/security", label: "Security" },
            { href: "/support", label: "Support" },
            { href: "/contact", label: "Contact" },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="rounded border border-white/[0.1] px-3 py-2 text-slate-300 transition hover:text-white">
              {label}
            </Link>
          ))}
        </div>
      </SettingsSection>

      <section className="rounded-md border border-red-300/20 bg-[#080b12] p-6">
        <h2 className="text-base font-semibold text-red-200">Danger Zone</h2>
        <p className="mt-1 text-xs text-slate-500">
          Destructive and privacy-sensitive actions. AgentWing records account deletion requests for review instead of hard-deleting immediately.
        </p>
        <div className="mt-5">
          <DangerZoneControls deletionRequestedAt={user?.deleteRequestedAt} />
        </div>
      </section>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-6">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  const displayValue = value || NOT_AVAILABLE;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-44 shrink-0 text-slate-500">{label}</span>
      <span className={`break-all text-slate-200 ${mono ? "font-mono text-xs" : ""}`}>{displayValue}</span>
      {copyable && displayValue !== NOT_AVAILABLE && <CopyButton value={displayValue} />}
    </div>
  );
}

function SecurityItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-2 shrink-0 rounded-full ${ok ? "bg-emerald-400" : "bg-slate-600"}`} />
      <span className={ok ? "text-slate-300" : "text-slate-500"}>{label}</span>
    </div>
  );
}

function DataList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-semibold text-white">{title}</p>
      <ul className="mt-2 space-y-1 text-slate-400">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-0.5 text-cyan-400">-</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return NOT_AVAILABLE;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? NOT_AVAILABLE : date.toLocaleString();
}
