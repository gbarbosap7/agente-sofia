"use client";

import { useState } from "react";
import { Webhook, Bot, Database, CheckCircle2, Copy, Check, ArrowRight, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

const STEPS = [
  { id: "datacrazy", label: "DataCrazy", icon: Webhook },
  { id: "agente", label: "Agente", icon: Bot },
  { id: "rag", label: "RAG", icon: Database },
  { id: "teste", label: "Teste", icon: CheckCircle2 },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export function OnboardingWizard({ webhook }: { webhook: string }) {
  const [step, setStep] = useState<StepId>("datacrazy");
  const idx = STEPS.findIndex((s) => s.id === step);
  const progress = ((idx + 1) / STEPS.length) * 100;

  return (
    <div className="space-y-6">
      {/* progress */}
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* tabs */}
      <Card>
        <div className="flex items-center divide-x divide-border border-b border-border">
          {STEPS.map(({ id, label, icon: Icon }, i) => (
            <button
              key={id}
              onClick={() => setStep(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 text-sm transition",
                step === id
                  ? "text-foreground bg-muted/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/20",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  step === id ? "text-accent" : i < idx ? "text-accent/60" : "",
                )}
              />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>

        <CardContent className="p-6">
          {step === "datacrazy" && <DataCrazyStep webhook={webhook} onNext={() => setStep("agente")} />}
          {step === "agente" && <AgenteStep onNext={() => setStep("rag")} />}
          {step === "rag" && <RagStep onNext={() => setStep("teste")} />}
          {step === "teste" && <TesteStep webhook={webhook} />}
        </CardContent>
      </Card>
    </div>
  );
}

function DataCrazyStep({ webhook, onNext }: { webhook: string; onNext: () => void }) {
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
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <CardTitle>1. Conectar DataCrazy</CardTitle>
          <CardDescription className="mt-1">
            Adicione um nó “Requisição HTTP via JSON” no flow e aponte pra URL abaixo.
          </CardDescription>
        </div>
        <Badge variant="accent">WEBHOOK_URL</Badge>
      </div>

      <CopyBlock label="POST" value={webhook} />

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Body (cole no nó HTTP)
        </div>
        <CopyBlock value={sample} multiline />
      </div>

      <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
        <li>DataCrazy → seu flow → adicionar nó <strong className="text-foreground">Requisição HTTP via JSON</strong></li>
        <li>Method: <code className="text-accent">POST</code> · URL: webhook acima · Content-Type: <code className="text-accent">application/json</code></li>
        <li>Cole o body com as variáveis do DC</li>
        <li>Salve e ative o flow</li>
      </ol>

      <div className="flex justify-end pt-2">
        <Button onClick={onNext}>
          Próximo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function AgenteStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <CardTitle>2. System Prompt da Sofia</CardTitle>
        <CardDescription className="mt-1">
          O prompt fica em <code className="text-accent">/admin/agente</code>. Você pode editar lá
          a qualquer momento — vale pra todas as conversas novas.
        </CardDescription>
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Padrão atual: SDR consignado CLT, tom humano direto, máx 2 linhas, sem emoji.
        <br />
        Inclui guardrails contra vazamento (comissão, BMs, infra).
      </div>

      <div className="flex items-center justify-between pt-2">
        <a
          href="/admin/agente"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border hover:bg-muted text-sm font-medium transition"
        >
          <Bot className="h-4 w-4" /> Editar prompt
        </a>
        <Button onClick={onNext}>
          Próximo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function RagStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <CardTitle>3. Base de conhecimento (opcional)</CardTitle>
        <CardDescription className="mt-1">
          Documentos com regras pro cliente (limites, prazos, taxas, FAQ). Suba em{" "}
          <code className="text-accent">/admin/rag</code> marcando como <Badge variant="accent">client</Badge>.
        </CardDescription>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300">
        ⚠️ Nunca suba documento <strong>internal</strong> com info sensível (comissão, custos,
        tabelas internas) marcado como <strong>client</strong> — Sofia vai falar pro lead.
      </div>

      <div className="flex items-center justify-between pt-2">
        <a
          href="/admin/rag"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border hover:bg-muted text-sm font-medium transition"
        >
          <Database className="h-4 w-4" /> Subir documento
        </a>
        <Button onClick={onNext}>
          Próximo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function TesteStep({ webhook }: { webhook: string }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    reply?: string | null;
    tools?: string[];
    error?: string | null;
  } | null>(null);

  async function runTest() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conv_id: `onboard-test-${Date.now()}`,
          phone: "5511993909833",
          message_text: "oi tudo bem? quero saber sobre emprestimo",
          message_id: `onb-${Date.now()}`,
          contact_name: "Onboarding Test",
        }),
      });
      const json = await res.json();
      setResult({
        ok: res.ok,
        reply: json.aiReply,
        tools: json.toolsRun,
        error: json.aiError,
      });
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    setRunning(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <CardTitle>4. Teste end-to-end</CardTitle>
        <CardDescription className="mt-1">
          Dispara um POST sintético no webhook → Sofia gera a primeira resposta. Não envia mensagem
          real pra DC (conv_id é fake) — só valida o pipeline.
        </CardDescription>
      </div>

      <div>
        <Button onClick={runTest} disabled={running}>
          <Send className="h-4 w-4" />
          {running ? "executando…" : "Rodar teste"}
        </Button>
      </div>

      {result && (
        <div className="space-y-3">
          <Badge variant={result.ok && result.reply ? "accent" : "danger"}>
            {result.ok && result.reply ? "OK" : "FALHOU"}
          </Badge>

          {result.reply && (
            <div className="rounded-md border border-accent/30 bg-accent/10 p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Resposta da Sofia
              </div>
              <div className="whitespace-pre-wrap text-foreground">{result.reply}</div>
            </div>
          )}

          {result.tools && result.tools.length > 0 && (
            <div className="text-xs text-muted-foreground">
              tools chamadas: {result.tools.map((t) => (
                <Badge key={t} variant="outline" className="ml-1">
                  {t}
                </Badge>
              ))}
            </div>
          )}

          {result.error && (
            <pre className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive whitespace-pre-wrap overflow-x-auto">
              {result.error.slice(0, 600)}
            </pre>
          )}
        </div>
      )}

      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        ✓ Quando o teste passar e seu flow do DC tiver o nó HTTP apontado pro webhook, mande uma
        mensagem real pra qualquer BM ligada nesse flow. Sofia responde em ~5–10s.
      </div>
    </div>
  );
}

function CopyBlock({
  label,
  value,
  multiline = false,
}: {
  label?: string;
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="relative group">
      {multiline ? (
        <pre className="rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground font-mono overflow-x-auto">
          {value}
        </pre>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm font-mono">
          {label && <span className="text-accent font-bold">{label}</span>}
          <span className="text-foreground break-all flex-1">{value}</span>
        </div>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={copy}
        className={cn(
          "absolute top-2 right-2 h-7 w-7 p-0 text-muted-foreground",
          multiline ? "" : "static ml-auto",
        )}
        title="copiar"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
