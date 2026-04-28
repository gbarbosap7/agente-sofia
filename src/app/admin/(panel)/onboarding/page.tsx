import { env } from "@/lib/env";
import { getCurrentAgent } from "@/lib/current-agent";
import { OnboardingWizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const agent = await getCurrentAgent();
  const slug = agent?.slug ?? "sofia";
  const channel = agent?.channel ?? "datacrazy";
  const webhook = `${env.APP_BASE_URL}/api/webhooks/${channel}/${slug}`;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Onboarding do <span className="text-accent">{agent?.name ?? "agente"}</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure o webhook do {channel}, ajuste o prompt, faça upload da base e teste.
        </p>
      </div>

      <OnboardingWizard webhook={webhook} />
    </div>
  );
}
