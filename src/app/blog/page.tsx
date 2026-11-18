import Link from "next/link";
import { PublicNav, PublicFooter } from "@/components/PublicLayout";

const posts = [
  {
    slug: "hello-agentwing",
    title: "Hello AgentWing",
    meta: "launch · 2026 · 3 min read",
    excerpt: "AI agents can run commands, edit files, call tools, and touch production. Most teams still lack a runtime control layer. AgentWing launches with policy checks, sandbox routing, approval decisions, feedback, receipts, and BYOK sandbox execution.",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Blog</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">AgentWing blog</h1>
        <div className="mt-8 space-y-4">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded-md border border-divider bg-surface p-6 transition hover:border-outline"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subdued">{post.meta}</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{post.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{post.excerpt}</p>
              <p className="mt-4 text-xs font-semibold text-brand">Read →</p>
            </Link>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
