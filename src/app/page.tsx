export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100 px-6">
      <div className="max-w-2xl w-full space-y-8">
        <div>
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="text-[#a3ff5c]">agente-sofia</span>
          </h1>
          <p className="mt-3 text-zinc-400">
            SDR consignado CLT · powered by Gemini 3.0 + DataCrazy
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-zinc-500 text-xs uppercase tracking-wide">status</div>
            <div className="mt-1 text-[#a3ff5c]">● online</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-zinc-500 text-xs uppercase tracking-wide">stage</div>
            <div className="mt-1">bootstrap</div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 text-sm">
          <div className="text-zinc-500 text-xs uppercase tracking-wide mb-2">endpoints</div>
          <ul className="space-y-1 font-mono text-xs">
            <li>
              <span className="text-zinc-500">GET </span>
              <span className="text-zinc-200">/api/health</span>
            </li>
            <li>
              <span className="text-zinc-500">POST </span>
              <span className="text-zinc-200">/api/webhooks/datacrazy</span>
            </li>
          </ul>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-600">Adapta · {new Date().getFullYear()}</span>
          <a
            href="/admin"
            className="text-zinc-500 hover:text-[#a3ff5c] transition border border-zinc-800 hover:border-[#a3ff5c]/40 rounded-md px-3 py-1"
          >
            admin →
          </a>
        </div>
      </div>
    </main>
  );
}
