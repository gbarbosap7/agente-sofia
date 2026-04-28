import { env } from "@/lib/env";
import { OnboardingWizard } from "./wizard";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  const webhook = `${env.APP_BASE_URL}/api/webhooks/datacrazy`;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Onboarding do <span className="text-accent">agente-sofia</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure o webhook do DataCrazy, ajuste o prompt, faça upload da base e teste.
        </p>
      </div>

      <OnboardingWizard webhook={webhook} />
    </div>
  );
}
