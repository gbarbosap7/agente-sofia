import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const pageNum = Math.max(1, Number(page ?? 1));
  const PER = 30;

  const where = q
    ? {
        OR: [
          { phone: { contains: q } },
          { contactName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (pageNum - 1) * PER,
      take: PER,
      select: {
        id: true,
        phone: true,
        contactName: true,
        aiEnabled: true,
        handoffReason: true,
        state: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">conversas</h1>
          <p className="text-zinc-500 text-sm mt-1">{total} no total</p>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="buscar phone ou nome…"
            className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 focus:border-[#a3ff5c] focus:outline-none text-sm w-72"
          />
        </form>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/80 text-zinc-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-normal px-4 py-2">contato</th>
              <th className="text-left font-normal px-4 py-2">phone</th>
              <th className="text-left font-normal px-4 py-2">msgs</th>
              <th className="text-left font-normal px-4 py-2">ia</th>
              <th className="text-left font-normal px-4 py-2">state</th>
              <th className="text-left font-normal px-4 py-2">atualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-zinc-500 text-center">
                  nenhuma conversa.
                </td>
              </tr>
            )}
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-900/60 transition">
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/conversas/${c.id}`}
                    className="text-zinc-100 hover:text-[#a3ff5c]"
                  >
                    {c.contactName ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-zinc-400">{c.phone}</td>
                <td className="px-4 py-2 text-zinc-400">{c._count.messages}</td>
                <td className="px-4 py-2">
                  <span className={c.aiEnabled ? "text-[#a3ff5c]" : "text-zinc-600"}>
                    {c.aiEnabled ? "on" : "off"}
                  </span>
                  {c.handoffReason && (
                    <span className="text-zinc-600 text-xs ml-2">({c.handoffReason})</span>
                  )}
                </td>
                <td className="px-4 py-2 text-zinc-400">{c.state}</td>
                <td className="px-4 py-2 text-zinc-500 text-xs">
                  {new Date(c.updatedAt).toLocaleString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager total={total} page={pageNum} per={PER} q={q} />
    </div>
  );
}

function Pager({ total, page, per, q }: { total: number; page: number; per: number; q?: string }) {
  const last = Math.max(1, Math.ceil(total / per));
  if (last === 1) return null;
  const qs = (p: number) =>
    `?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) }).toString()}`;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href={qs(Math.max(1, page - 1))}
        className="px-3 py-1 rounded-md border border-zinc-800 hover:bg-zinc-900 text-zinc-400"
      >
        ← ant
      </Link>
      <span className="text-zinc-500 text-xs">
        {page} / {last}
      </span>
      <Link
        href={qs(Math.min(last, page + 1))}
        className="px-3 py-1 rounded-md border border-zinc-800 hover:bg-zinc-900 text-zinc-400"
      >
        prox →
      </Link>
    </div>
  );
}
