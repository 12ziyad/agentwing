import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown, ArrowRight, ArrowUpRight, Braces, Cable, FileCheck, Network, ShieldCheck, Terminal,
} from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/PublicLayout";
import { PolicyDemo } from "./PolicyDemo";
import styles from "./landing.module.css";

const integrations = [
  {
    title: "Coding agents",
    description: "Check local tool calls from Claude Code, Cursor, and Codex.",
    href: "https://github.com/12ziyad/agentwing/tree/main/packages/hook",
    icon: Terminal,
  },
  {
    title: "MCP clients",
    description: "Apply the same workspace policies to remote MCP tool calls.",
    href: "https://github.com/12ziyad/agentwing/tree/main/src/app/api/mcp",
    icon: Cable,
  },
  {
    title: "Custom agents",
    description: "Integrate directly with the REST API or TypeScript SDK.",
    href: "/docs",
    icon: Braces,
  },
];

const command = `curl https://agentwing.gpmai.dev/api/v1/check-action \\
  -H "Authorization: Bearer $AGENTWING_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "YOUR_PROJECT_ID",
    "actionType": "shell_command",
    "tool": "terminal",
    "command": "git status"
  }'`;

export function LandingPage({ isSignedIn }: { isSignedIn: boolean }) {
  const startHref = isSignedIn ? "/dashboard" : "/api/auth/signin/google?next=/dashboard";
  const startLabel = isSignedIn ? "Open dashboard" : "Get started";

  return (
    <div className={styles.page}>
      <a href="#main" className={styles.skipLink}>Skip to content</a>
      <PublicNav isSignedIn={isSignedIn} />
      <main id="main" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Open-source runtime control</p>
              <h1 id="hero-title">
                Control what your<br className={styles.heroBreak} /> agents <span>can do.</span>
              </h1>
              <p className={styles.heroIntro}>
                Put a policy check in front of your AI agent&apos;s tools. Decide what can run, what needs approval,
                and what belongs in a sandbox.
              </p>
              <div className={styles.actions}>
                <a href="#try" className={styles.primaryButton}>Try the policy engine <ArrowDown size={17} aria-hidden /></a>
                <Link href="/docs" className={styles.outlineButton}>Read the docs <ArrowUpRight size={16} aria-hidden /></Link>
              </div>
            </div>
            <div className={styles.heroVisual}>
              <div className={styles.artwork}>
                <Image
                  src="/agentwing-runtime.webp"
                  alt=""
                  fill
                  priority
                  unoptimized
                />
              </div>
              <ol className={styles.flow} aria-label="Where AgentWing fits">
                <li><Network size={16} aria-hidden /> Agent request</li>
                <li><ShieldCheck size={16} aria-hidden /> Policy check</li>
                <li><Terminal size={16} aria-hidden /> Tool execution</li>
              </ol>
            </div>
          </div>
        </section>

        <section id="try" className={styles.demoSection} aria-labelledby="demo-title">
          <div className={`${styles.container} ${styles.demoGrid}`}>
            <div>
              <p className={styles.eyebrow}>Live playground</p>
              <h2 id="demo-title">See a decision before an action runs.</h2>
              <p className={styles.sectionCopy}>
                Pick a tool call to see the decision and the rule behind it. The default policy engine runs in your
                browser without executing the action.
              </p>
              <Link href="/playground" className={styles.textLink}>Test your own action <ArrowUpRight size={17} aria-hidden /></Link>
            </div>
            <PolicyDemo />
          </div>
        </section>

        <section className={styles.integrationsSection} id="integrations" aria-labelledby="integrations-title">
          <div className={`${styles.container} ${styles.integrationGrid}`}>
            <div>
              <p className={styles.eyebrow}>Integrations</p>
              <h2 id="integrations-title">Connect the tools your agents already use.</h2>
              <ul className={styles.integrationLinks}>
                {integrations.map(({ title, description, href, icon: Icon }) => (
                  <li key={title}>
                    <Link href={href} className={styles.integrationLink}>
                      <span className={styles.integrationIcon}><Icon size={19} aria-hidden /></span>
                      <span><strong>{title}</strong><span>{description}</span></span>
                      <ArrowUpRight size={17} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.apiCard}>
              <div className={styles.panelBar}><Terminal size={16} aria-hidden /> Check an action over HTTP</div>
              <pre tabIndex={0} aria-label="Example API request"><code>{command}</code></pre>
              <p>Use the returned decision to control what your runner executes.</p>
            </div>
          </div>
        </section>

        <section className={styles.auditSection} aria-labelledby="audit-title">
          <div className={`${styles.container} ${styles.auditGrid}`}>
            <div>
              <p className={styles.eyebrow}>Audit trail</p>
              <h2 id="audit-title">Trace each decision back to its rule.</h2>
            </div>
            <div>
              <p className={styles.sectionCopy}>
                Each API check records the proposed action, decision, and matching policy in a receipt.
                Export the hash-chained log and verify its integrity offline.
              </p>
              <Link href="https://github.com/12ziyad/agentwing/tree/main/packages/receipt-verifier" className={styles.textLink}>
                <FileCheck size={17} aria-hidden /> Explore the receipt verifier <ArrowUpRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.ctaSection} aria-labelledby="start-title">
          <div className={`${styles.container} ${styles.ctaGrid}`}>
            <div>
              <h2 id="start-title">Protect your first tool call.</h2>
              <p>Free during the public beta. No credit card required.</p>
            </div>
            <a href={startHref} className={styles.primaryButton}>{startLabel} <ArrowRight size={18} aria-hidden /></a>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
