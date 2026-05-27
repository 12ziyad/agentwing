import { PublicNav, PublicFooter } from "@/components/PublicLayout";

const contacts = [
  { label: "General", email: "founder@gpmai.dev", desc: "General questions about AgentWing." },
  { label: "Support", email: "founder@gpmai.dev", desc: "Help with your workspace, API keys, or integrations." },
  { label: "Security", email: "founder@gpmai.dev", desc: "Security reports and vulnerability disclosures." },
  { label: "Partnerships / demo", email: "founder@gpmai.dev", desc: "Partnerships, enterprise, or demo requests." },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <PublicNav />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Contact</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Contact</h1>
        <p className="mt-4 text-base text-slate-400">GPMai Labs — the company behind AgentWing.</p>

        <div className="mt-8 space-y-3">
          {contacts.map(({ label, email, desc }) => (
            <div key={label} className="flex items-start justify-between gap-4 rounded-md border border-white/[0.08] bg-[#080b12] px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
              </div>
              <a href={`mailto:${email}`} className="shrink-0 font-mono text-sm text-cyan-200 transition hover:text-cyan-100">
                {email}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <a href="https://github.com/12ziyad" target="_blank" rel="noopener noreferrer" className="rounded-md border border-white/[0.08] bg-[#080b12] p-5 transition hover:border-white/[0.14]">
            <p className="font-semibold text-white">GitHub</p>
            <p className="mt-1 font-mono text-xs text-cyan-200">github.com/12ziyad</p>
          </a>
          <a href="https://www.reddit.com/user/Far_Pangolin_7657/" target="_blank" rel="noopener noreferrer" className="rounded-md border border-white/[0.08] bg-[#080b12] p-5 transition hover:border-white/[0.14]">
            <p className="font-semibold text-white">Reddit</p>
            <p className="mt-1 font-mono text-xs text-cyan-200">u/Far_Pangolin_7657</p>
          </a>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
