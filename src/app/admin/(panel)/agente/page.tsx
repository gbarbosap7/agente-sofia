import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/current-agent";

export const dynamic = "force-dynamic";

export default async function AgentePage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/admin/agents");
  redirect(`/admin/agents/${agent.slug}`);
}
