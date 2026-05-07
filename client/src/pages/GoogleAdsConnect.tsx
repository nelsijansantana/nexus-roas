import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  googleAdsListAccounts,
  googleAdsListConversionActions,
  googleAdsConnect,
  type GoogleAdsAccount,
  type GoogleAdsConversionAction,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Link2, Plus, X } from "lucide-react";

// Standard event names the system tracks
const STANDARD_EVENTS = ["Purchase", "Lead", "Contact", "InitiateCheckout", "ViewContent", "AddToCart"];

type Step = "accounts" | "conversion-id" | "events" | "saving";

export default function GoogleAdsConnect() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const sessionId = params.get("session") ?? "";
  const projectId = params.get("projectId") ?? "";
  const error     = params.get("error");

  const [step, setStep]               = useState<Step>("accounts");
  const [accounts, setAccounts]       = useState<GoogleAdsAccount[]>([]);
  const [selectedAccount, setSelected] = useState<GoogleAdsAccount | null>(null);
  const [conversionId, setConversionId] = useState("");
  const [conversionActions, setConversionActions] = useState<GoogleAdsConversionAction[]>([]);
  const [eventMap, setEventMap]       = useState<Record<string, { label: string; actionResource: string }>>({});
  const [customEvents, setCustomEvents] = useState<string[]>([]);
  const [newEventName, setNewEventName] = useState("");
  const [loading, setLoading]         = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [manualCustomerId, setManualCustomerId] = useState("");

  // Load accounts on mount
  useEffect(() => {
    if (!sessionId || !projectId) return;
    setLoadingAccounts(true);
    googleAdsListAccounts(sessionId)
      .then(({ accounts }) => setAccounts(accounts))
      .catch((e) => {
        const msg = e?.message || "Erro ao carregar contas Google Ads";
        setAccountsError(msg);
        toast.error(msg);
      })
      .finally(() => setLoadingAccounts(false));
  }, [sessionId, projectId]);

  // Load conversion actions when account is selected
  useEffect(() => {
    if (!selectedAccount || !sessionId) return;
    setLoading(true);
    googleAdsListConversionActions(sessionId, selectedAccount.customerId)
      .then(({ conversionActions }) => setConversionActions(conversionActions))
      .catch(() => setConversionActions([]))  // fallback: campos de texto livres no mapeamento
      .finally(() => setLoading(false));
  }, [selectedAccount, sessionId]);

  async function handleSave() {
    if (!selectedAccount) return;
    setStep("saving");
    try {
      await googleAdsConnect({
        sessionId,
        projectId,
        customerId:   selectedAccount.customerId,
        conversionId: conversionId || `customers/${selectedAccount.customerId}`,
        events:       eventMap,
      });
      toast.success("Google Ads conectado com sucesso!");
      navigate(`/projects/${projectId}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar integração");
      setStep("events");
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-destructive font-medium">
            Autorização cancelada ou falhou: {decodeURIComponent(error)}
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>
      </div>
    );
  }

  if (!sessionId || !projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Parâmetros inválidos. Tente reconectar.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate(`/projects/${projectId}`)} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-[#4285F4]" />
          <h1 className="font-semibold text-base">Conectar Google Ads</h1>
        </div>
        {/* Step indicator */}
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <StepDot active={step === "accounts"} done={step !== "accounts"} label="Conta" />
          <div className="w-4 h-px bg-border" />
          <StepDot active={step === "conversion-id"} done={["events","saving"].includes(step)} label="ID" />
          <div className="w-4 h-px bg-border" />
          <StepDot active={step === "events"} done={step === "saving"} label="Eventos" />
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-8 space-y-6">

        {/* ── Step 1: Selecionar conta ── */}
        {step === "accounts" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Selecione a conta Google Ads</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Escolha a conta que receberá as conversões deste projeto.
              </p>
            </div>
            {loadingAccounts ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Carregando contas...</span>
              </div>
            ) : accountsError ? (
              /* ── Fallback manual quando a listagem automática falha (token em teste) ── */
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm space-y-1">
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    Listagem automática indisponível
                  </p>
                  <p className="text-xs text-muted-foreground">
                    O Developer Token ainda está em modo de teste — a listagem automática de contas só funciona após aprovação do Basic Access. Enquanto isso, informe o Customer ID manualmente.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manualId">Customer ID</Label>
                  <Input
                    id="manualId"
                    value={manualCustomerId}
                    onChange={(e) => setManualCustomerId(e.target.value.replace(/\D/g, ""))}
                    placeholder="1234567890"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre no Google Ads — canto superior direito, formato <span className="font-mono">123-456-7890</span>. Cole só os números.
                  </p>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => {
                      if (!manualCustomerId) return;
                      setSelected({ customerId: manualCustomerId, name: `Conta ${manualCustomerId}`, resourceName: `customers/${manualCustomerId}` });
                      setStep("conversion-id");
                    }}
                    disabled={!manualCustomerId}
                  >
                    Próximo <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            ) : accounts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nenhuma conta encontrada. Verifique se você tem acesso a contas Google Ads.
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <button
                    key={acc.customerId}
                    onClick={() => setSelected(acc)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      selectedAccount?.customerId === acc.customerId
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/40"
                    }`}
                  >
                    <div className="font-medium text-sm">{acc.name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      ID: {acc.customerId}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!accountsError && (
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setStep("conversion-id")}
                  disabled={!selectedAccount}
                >
                  Próximo <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Conversion ID ── */}
        {step === "conversion-id" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Conversion ID (opcional)</h2>
              <p className="text-sm text-muted-foreground mt-1">
                O Conversion ID (<span className="font-mono">AW-XXXXXXXXXX</span>) é necessário apenas para o
                disparo via browser (gtag). Se você vai usar somente server-side, pode pular.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="conversionId">Conversion ID</Label>
              <Input
                id="conversionId"
                value={conversionId}
                onChange={(e) => setConversionId(e.target.value)}
                placeholder="AW-123456789"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Google Ads → Metas e conversões → Conversões → selecione → ver tag
              </p>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("accounts")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
              <Button onClick={() => setStep("events")}>
                Próximo <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Mapeamento de eventos ── */}
        {step === "events" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Mapear eventos de conversão</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Associe cada evento a uma ação de conversão do Google Ads. Deixe em branco para ignorar.
              </p>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando ações de conversão...
              </div>
            )}

            {/* Eventos padrão */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Eventos padrão</p>
              {STANDARD_EVENTS.map((eventName) => (
                <EventMappingRow
                  key={eventName}
                  eventName={eventName}
                  conversionActions={conversionActions}
                  value={eventMap[eventName] ?? { label: "", actionResource: "" }}
                  onChange={(v) => setEventMap((m) => ({ ...m, [eventName]: v }))}
                />
              ))}
            </div>

            {/* Eventos customizados */}
            {customEvents.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Eventos customizados</p>
                {customEvents.map((eventName) => (
                  <EventMappingRow
                    key={eventName}
                    eventName={eventName}
                    conversionActions={conversionActions}
                    value={eventMap[eventName] ?? { label: "", actionResource: "" }}
                    onChange={(v) => setEventMap((m) => ({ ...m, [eventName]: v }))}
                    onRemove={() => {
                      setCustomEvents((c) => c.filter((e) => e !== eventName));
                      setEventMap((m) => { const n = { ...m }; delete n[eventName]; return n; });
                    }}
                  />
                ))}
              </div>
            )}

            {/* Adicionar evento customizado */}
            <div className="rounded-lg border border-dashed border-border/60 p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Adicionar evento customizado</p>
              <div className="flex gap-2">
                <Input
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newEventName.trim()) {
                      const name = newEventName.trim();
                      if (!STANDARD_EVENTS.includes(name) && !customEvents.includes(name)) {
                        setCustomEvents((c) => [...c, name]);
                      }
                      setNewEventName("");
                    }
                  }}
                  placeholder="Ex: CompleteRegistration, ScheduleDemo…"
                  className="h-9 bg-muted/40 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={() => {
                    const name = newEventName.trim();
                    if (!name) return;
                    if (!STANDARD_EVENTS.includes(name) && !customEvents.includes(name)) {
                      setCustomEvents((c) => [...c, name]);
                    }
                    setNewEventName("");
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Use o nome exato do evento como ele é enviado pelo pixel (ex: <span className="font-mono">ViewCart</span>, <span className="font-mono">CompleteRegistration</span>). Pressione Enter ou clique em +.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              <strong>label</strong> — disparo via browser (gtag).{" "}
              <strong>action_resource</strong> — server-side Conversions API.
              Ambos podem coexistir no mesmo evento.
            </p>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("conversion-id")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
              <Button onClick={handleSave}>
                Salvar e conectar <CheckCircle2 className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Saving ── */}
        {step === "saving" && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Salvando integração...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1 ${active ? "text-foreground font-medium" : done ? "text-primary" : "text-muted-foreground"}`}>
      <div className={`w-2 h-2 rounded-full ${active ? "bg-primary" : done ? "bg-primary" : "bg-muted-foreground/40"}`} />
      {label}
    </div>
  );
}

function EventMappingRow({
  eventName,
  conversionActions,
  value,
  onChange,
  onRemove,
}: {
  eventName: string;
  conversionActions: GoogleAdsConversionAction[];
  value: { label: string; actionResource: string };
  onChange: (v: { label: string; actionResource: string }) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">{eventName}</div>
        {onRemove && (
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Label (browser)</Label>
          {conversionActions.length > 0 ? (
            <select
              value={value.label}
              onChange={(e) => onChange({ ...value, label: e.target.value })}
              className="w-full h-9 rounded-md border border-input bg-muted/40 px-3 text-sm font-mono"
            >
              <option value="">— ignorar —</option>
              {conversionActions.map((a) => (
                <option key={a.id} value={a.label}>
                  {a.name} ({a.label})
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={value.label}
              onChange={(e) => onChange({ ...value, label: e.target.value })}
              placeholder="xXxXxXxXxX"
              className="h-9 font-mono bg-muted/40"
            />
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Action Resource (server)</Label>
          {conversionActions.length > 0 ? (
            <select
              value={value.actionResource}
              onChange={(e) => onChange({ ...value, actionResource: e.target.value })}
              className="w-full h-9 rounded-md border border-input bg-muted/40 px-3 text-sm font-mono"
            >
              <option value="">— ignorar —</option>
              {conversionActions.map((a) => (
                <option key={a.id} value={a.resourceName}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={value.actionResource}
              onChange={(e) => onChange({ ...value, actionResource: e.target.value })}
              placeholder="customers/123/conversionActions/456"
              className="h-9 font-mono bg-muted/40"
            />
          )}
        </div>
      </div>
    </div>
  );
}
