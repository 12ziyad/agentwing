export function AdminAccessScreen({ error }: { error?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070d] px-4 text-slate-100">
      <section className="w-full max-w-md rounded-md border border-white/[0.08] bg-[#080b12] p-6 shadow-2xl shadow-black/40">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">AgentWing Console</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Admin access required</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Enter the server-side admin access code to open the dashboard. Public docs, landing, and Runtime Lab remain available.
        </p>
        <form action="/api/admin/access" method="post" className="mt-5 space-y-3">
          <label htmlFor="access-code" className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Access code
          </label>
          <input
            id="access-code"
            name="code"
            type="password"
            autoComplete="current-password"
            className="min-h-11 w-full rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
          />
          {error && <p className="rounded border border-red-400/20 bg-red-400/[0.08] px-3 py-2 text-sm text-red-100">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-md border border-cyan-300/25 bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-[#031018] transition hover:bg-cyan-200"
          >
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}
