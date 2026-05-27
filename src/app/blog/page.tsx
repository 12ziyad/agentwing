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
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Blog</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">AgentWing blog</h1>
        <div className="mt-8 space-y-4">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded-md border border-white/[0.08] bg-[#080b12] p-6 transition hover:border-white/[0.14]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{post.meta}</p>
              <p className="mt-2 text-xl font-semibold text-white">{post.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{post.excerpt}</p>
              <p className="mt-4 text-xs font-semibold text-cyan-200">Read →</p>
            </Link>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
