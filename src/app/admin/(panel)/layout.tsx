import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutGrid,
  Compass,
  MessagesSquare,
  Bot,
  Wrench,
  Settings,
  LogOut,
  Users,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { listAgents, getCurrentAgent } from "@/lib/current-agent";
import { AgentSwitcher } from "./agent-switcher";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/onboarding", label: "Onboarding", icon: Compass },
  { href: "/admin/conversas", label: "Conversas", icon: MessagesSquare },
  { href: "/admin/agente", label: "Agente", icon: Bot },
  { href: "/admin/rag", label: "Tools / RAG", icon: Wrench },
  { href: "/admin/agents", label: "Agentes", icon: Users },
  { href: "/admin/configs", label: "Configurações", icon: Settings },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const [agents, current] = await Promise.all([listAgents(), getCurrentAgent()]);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-64 border-r border-border flex flex-col">
        <div className="px-5 py-6 border-b border-border">
          <div className="text-lg font-bold tracking-tight">
            <span className="text-accent">agentes</span>
            <span className="text-muted-foreground text-xs ml-2">adapta</span>
          </div>
        </div>

        <div className="px-3 py-3 border-b border-border">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 mb-1.5">
            Agente atual
          </div>
          <AgentSwitcher agents={agents} currentSlug={current?.slug ?? null} />
        </div>

        <nav className="flex-1 flex flex-col gap-0.5 p-3 text-sm">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <div className="px-3 mb-2 text-xs text-muted-foreground truncate">{session.email}</div>
          <form action="/api/admin/logout" method="post">
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition text-sm"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
