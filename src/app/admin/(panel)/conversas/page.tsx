import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conversas</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} no total</p>
        </div>
        <form className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="buscar phone ou nome…"
            className="w-72 pl-8"
          />
        </form>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wide border-b border-border">
              <tr>
                <th className="text-left font-normal px-5 py-2.5">Contato</th>
                <th className="text-left font-normal px-5 py-2.5">Phone</th>
                <th className="text-left font-normal px-5 py-2.5">Msgs</th>
                <th className="text-left font-normal px-5 py-2.5">IA</th>
                <th className="text-left font-normal px-5 py-2.5">State</th>
                <th className="text-left font-normal px-5 py-2.5">Atualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-muted-foreground text-center">
                    nenhuma conversa.
                  </td>
                </tr>
              )}
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition">
                  <td className="px-5 py-2.5">
                    <Link
                      href={`/admin/conversas/${c.id}`}
                      className="text-foreground hover:text-accent"
                    >
                      {c.contactName ?? "—"}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">
                    {c.phone}
                  </td>
                  <td className="px-5 py-2.5 text-muted-foreground">{c._count.messages}</td>
                  <td className="px-5 py-2.5">
                    <Badge variant={c.aiEnabled ? "accent" : "default"}>
                      {c.aiEnabled ? "on" : "off"}
                    </Badge>
                    {c.handoffReason && (
                      <span className="text-muted-foreground text-xs ml-2">
                        ({c.handoffReason})
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-muted-foreground">{c.state}</td>
                  <td className="px-5 py-2.5 text-muted-foreground text-xs">
                    {new Date(c.updatedAt).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
    <div className="flex items-center justify-end gap-2 text-sm">
      <Link
        href={qs(Math.max(1, page - 1))}
        className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-border hover:bg-muted text-muted-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> ant
      </Link>
      <span className="text-muted-foreground text-xs">
        {page} / {last}
      </span>
      <Link
        href={qs(Math.min(last, page + 1))}
        className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-border hover:bg-muted text-muted-foreground"
      >
        prox <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
