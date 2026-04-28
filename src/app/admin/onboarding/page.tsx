import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  const webhook = `${env.APP_BASE_URL}/api/webhooks/datacrazy`;
  const sample = JSON.stringify(
    {
      conv_id: "{{conversation.id}}",
      phone: "{{contact.phone}}",
      lead_id: "{{lead.id}}",
      contact_name: "{{contact.name}}",
      message_text: "{{message.text}}",
      message_id: "{{message.id}}",
      message_type: "{{message.type}}",
      timestamp: "{{message.created_at}}",
    },
    null,
    2,
  );

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">onboarding</h1>
        <p className="text-zinc-500 text-sm mt-1">
          configure o flow do DataCrazy pra disparar HTTP no webhook abaixo.
        </p>
      </div>

      <Step n={1} title="copie o webhook URL">
        <code className="block p-3 rounded-md bg-zinc-900 border border-zinc-800 text-sm text-[#a3ff5c] font-mono break-all">
          POST {webhook}
        </code>
      </Step>

      <Step n={2} title="adicione um nó “Requisição HTTP via JSON” no flow">
        <p className="text-sm text-zinc-400">
          No DataCrazy → flow → adicione bloco HTTP. Method: POST · URL: webhook acima ·
          Content-Type: application/json
        </p>
      </Step>

      <Step n={3} title="cole este body com as variáveis do DC">
        <pre className="p-3 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono overflow-x-auto">
          {sample}
        </pre>
      </Step>

      <Step n={4} title="teste enviando uma mensagem">
        <p className="text-sm text-zinc-400">
          Mande uma mensagem real pro WhatsApp da BM conectada. Em segundos a conversa aparece em{" "}
          <span className="text-[#a3ff5c]">/admin/conversas</span>.
        </p>
      </Step>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[#a3ff5c] font-mono text-xs">{String(n).padStart(2, "0")}</span>
        <h2 className="text-lg font-medium">{title}</h2>
      </div>
      <div className="ml-7">{children}</div>
    </div>
  );
}
