import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "dashboard" },
  { href: "/admin/conversas", label: "conversas" },
  { href: "/admin/agente", label: "agente" },
  { href: "/admin/rag", label: "rag" },
  { href: "/admin/onboarding", label: "onboarding" },
  { href: "/admin/configs", label: "configs" },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="min-h-screen flex bg-zinc-950 text-zinc-100">
      <aside className="w-56 border-r border-zinc-900 px-5 py-6 flex flex-col">
        <div className="mb-8">
          <Link href="/admin" className="text-lg font-bold tracking-tight">
            <span className="text-[#a3ff5c]">sofia</span>
            <span className="text-zinc-500 text-xs ml-2">admin</span>
          </Link>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-4 border-t border-zinc-900 text-xs text-zinc-600">
          <div className="truncate mb-2">{session.email}</div>
          <form action="/api/admin/logout" method="post">
            <button className="text-zinc-500 hover:text-zinc-300 text-xs" type="submit">
              sair
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
