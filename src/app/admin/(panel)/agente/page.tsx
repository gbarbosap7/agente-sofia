import { getSetting, DEFAULT_SYSTEM_PROMPT } from "@/lib/settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PromptEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function AgentePage() {
  const prompt = await getSetting("system_prompt", DEFAULT_SYSTEM_PROMPT);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agente</h1>
        <p className="text-muted-foreground text-sm mt-1">
          system prompt aplicado em toda mensagem do usuário antes de chamar o Gemini.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System prompt</CardTitle>
          <CardDescription>
            Define personalidade, funil, tools que pode usar e regras de confidencialidade.
            Vale para conversas novas — antigas mantêm seu histórico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromptEditor initial={prompt} fallback={DEFAULT_SYSTEM_PROMPT} />
        </CardContent>
      </Card>
    </div>
  );
}
