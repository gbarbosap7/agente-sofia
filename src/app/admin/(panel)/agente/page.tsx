import { getSetting, DEFAULT_SYSTEM_PROMPT } from "@/lib/settings";
import { PromptEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function AgentePage() {
  const prompt = await getSetting("system_prompt", DEFAULT_SYSTEM_PROMPT);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">agente</h1>
        <p className="text-zinc-500 text-sm mt-1">
          system prompt aplicado em toda mensagem do usuario antes de chamar o Gemini.
        </p>
      </div>

      <PromptEditor initial={prompt} fallback={DEFAULT_SYSTEM_PROMPT} />
    </div>
  );
}
