import { PublicNav, PublicFooter } from "@/components/PublicLayout";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <PublicNav />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Terms of Service</h1>
        <p className="mt-2 text-xs text-slate-500">Last updated: 2026 · GPMai Labs</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-slate-300">
          <Section title="1. Acceptance">
            <p>By using AgentWing you agree to these Terms. If you do not agree, do not use the service.</p>
          </Section>

          <Section title="2. Service description">
            <p>AgentWing provides a runtime control layer for AI agents: policy evaluation, approval gates, sandbox routing, restore point signaling, structured feedback, and audit receipts via a REST API and dashboard.</p>
          </Section>

          <Section title="3. Accounts and API keys">
            <p>You are responsible for maintaining the security of your API keys and Google account. Do not share API keys. Revoke compromised keys immediately. AgentWing stores API keys as hashes — the raw key is shown once and cannot be recovered.</p>
          </Section>

          <Section title="4. BYOK sandbox responsibility">
            <p>If you connect a third-party sandbox provider key (E2B or other), you are responsible for the costs, security, and compliance of that provider. AgentWing encrypts your key server-side but does not control or monitor the provider&apos;s infrastructure. AgentWing is not liable for charges incurred through your connected sandbox provider.</p>
          </Section>

          <Section title="5. Acceptable use">
            <p>You may not use AgentWing to:</p>
            <ul className="mt-2 space-y-1 text-slate-400">
              {[
                "Abuse, spam, or generate excessive API calls beyond fair use",
                "Resell or proxy AgentWing services without a written agreement",
                "Attempt to bypass rate limits, workspace isolation, or access other users&apos; data",
                "Use the service for illegal activity or to violate third-party rights",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2"><span className="shrink-0 text-slate-500">•</span><span dangerouslySetInnerHTML={{ __html: item }} /></li>
              ))}
            </ul>
          </Section>

          <Section title="6. Agent responsibility">
            <p>You are responsible for your agents&apos; actions. AgentWing reduces risk by evaluating actions against policies, but cannot guarantee that every unsafe action is detected. AgentWing is not liable for actions your agent executes, including those that pass policy evaluation.</p>
          </Section>

          <Section title="7. Free and beta service">
            <p>AgentWing is provided free during beta on an as-is basis with no uptime guarantees. We may change limits, features, or pricing with notice. Continued use after notice constitutes acceptance.</p>
          </Section>

          <Section title="8. Customer data">
            <p>You retain ownership of your data. We process it as described in our <a href="/privacy" className="text-cyan-200 underline">Privacy Policy</a>. You may request deletion at any time.</p>
          </Section>

          <Section title="9. Telemetry">
            <p>AgentWing records product and security events (sign-ins, API calls, policy matches, errors) to operate and improve the service. This data is never sold.</p>
          </Section>

          <Section title="10. Limitation of liability">
            <p>To the maximum extent permitted by law, GPMai Labs is not liable for indirect, incidental, special, or consequential damages arising from your use of AgentWing, including losses from agent actions that bypassed policy checks, downtime, or data loss.</p>
          </Section>

          <Section title="11. Suspension and termination">
            <p>We may suspend or terminate accounts that violate these Terms or pose a security risk, with or without notice in serious cases.</p>
          </Section>

          <Section title="12. Changes">
            <p>We may update these Terms. We will notify users via email or dashboard notice. Continued use after the effective date constitutes acceptance.</p>
          </Section>

          <Section title="13. Governing law">
            <p>These Terms are governed by the laws of India. Disputes shall be resolved in the courts of India.</p>
          </Section>

          <Section title="14. Contact">
            <p>Questions about these Terms: <a href="mailto:founder@gpmai.dev" className="text-cyan-200 underline">founder@gpmai.dev</a></p>
          </Section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="mt-2">{children}</div>
    </div>
  );
}
