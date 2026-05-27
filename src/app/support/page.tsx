import { PublicNav, PublicFooter } from "@/components/PublicLayout";

const faq = [
  {
    q: "Does AgentWing replace my agent?",
    a: "No. AgentWing sits between your agent and its tools. Your agent logic, prompts, and planning remain unchanged. AgentWing adds a policy check before each execution.",
  },
  {
    q: "Do you store my API keys?",
    a: "AgentWing API keys are shown once and stored as a SHA-256 hash. The full key is never retrievable after generation. Existing keys show only a masked prefix.",
  },
  {
    q: "Do you store my E2B key?",
    a: "BYOK sandbox keys are encrypted server-side using AES-GCM with a Worker secret. The raw key is never returned to the browser or stored in plaintext.",
  },
  {
    q: "Do I need a password?",
    a: "No. AgentWing uses Google sign-in. No password is stored by AgentWing.",
  },
  {
    q: "Can I delete or export my data?",
    a: "Yes. Email founder@gpmai.dev with your workspace ID to request a data export or account deletion during beta.",
  },
  {
    q: "Is AgentWing free?",
    a: "Yes, free during beta. Limits: 1,000 action checks and 20 sandbox runs per API key. Contact us if you need more.",
  },
  {
    q: "What action types does AgentWing check?",
    a: "file_access, shell_command, network_request, code_execution, git_operation, package_install, config_change, database_operation, and agent_spawn.",
  },
];

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Support</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Support</h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <ContactCard title="Email" href="mailto:founder@gpmai.dev" label="founder@gpmai.dev" desc="General support and billing" />
          <ContactCard title="GitHub" href="https://github.com/12ziyad" label="github.com/12ziyad" desc="Issues, feedback, and open source" external />
          <ContactCard title="Reddit" href="https://www.reddit.com/user/Far_Pangolin_7657/" label="u/Far_Pangolin_7657" desc="Community discussion" external />
        </div>

        <div className="mt-12">
          <h2 className="text-xl font-semibold text-white">FAQ</h2>
          <div className="mt-4 space-y-4">
            {faq.map(({ q, a }) => (
              <div key={q} className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
                <p className="font-semibold text-white">{q}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

function ContactCard({ title, href, label, desc, external }: { title: string; href: string; label: string; desc: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="rounded-md border border-white/[0.08] bg-[#080b12] p-5 transition hover:border-white/[0.14]"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <p className="mt-2 text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{desc}</p>
    </a>
  );
}
