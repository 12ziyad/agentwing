import Link from "next/link";
import { PublicNav, PublicFooter } from "@/components/PublicLayout";

const contacts = [
  { label: "General", email: "founder@gpmai.dev", desc: "General questions about AgentWing." },
  { label: "Support", email: "founder@gpmai.dev", desc: "Help with your workspace, API keys, or integrations." },
  { label: "Security", email: "founder@gpmai.dev", desc: "Security reports and vulnerability disclosures." },
  { label: "Partnerships / demo", email: "founder@gpmai.dev", desc: "Partnerships, enterprise, or demo requests." },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Contact</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">Contact</h1>
        <p className="mt-4 text-base text-muted">
          <Link href="/about" className="text-brand underline underline-offset-4">GPMai Labs</Link>
          {" builds and operates AgentWing."}
        </p>

        <div className="mt-8 space-y-3">
          {contacts.map(({ label, email, desc }) => (
            <div key={label} className="flex items-start justify-between gap-4 rounded-md border border-divider bg-surface px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="mt-0.5 text-xs text-subdued">{desc}</p>
              </div>
              <a href={`mailto:${email}`} className="shrink-0 font-mono text-sm text-brand transition hover:text-brand-text">
                {email}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <a href="https://github.com/12ziyad" target="_blank" rel="noopener noreferrer" className="rounded-md border border-divider bg-surface p-5 transition hover:border-outline">
            <p className="font-semibold text-foreground">GitHub</p>
            <p className="mt-1 font-mono text-xs text-brand">github.com/12ziyad</p>
          </a>
          <a href="https://www.reddit.com/user/Far_Pangolin_7657/" target="_blank" rel="noopener noreferrer" className="rounded-md border border-divider bg-surface p-5 transition hover:border-outline">
            <p className="font-semibold text-foreground">Reddit</p>
            <p className="mt-1 font-mono text-xs text-brand">u/Far_Pangolin_7657</p>
          </a>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
