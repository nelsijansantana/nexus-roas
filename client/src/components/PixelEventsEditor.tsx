import { useState, useEffect } from "react";
import {
  getPixelEvents,
  createPixelEvent,
  updatePixelEvent,
  deletePixelEvent,
  type PixelEvent,
  type TriggerType,
  type CreatePixelEventPayload,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerType, string> = {
  click: "Clique em elemento",
  form_submit: "Envio de formulário",
  scroll: "Scroll da página",
  time_on_page: "Tempo na página",
  pageload: "Carregamento da página",
};

const TRIGGER_COLORS: Record<TriggerType, string> = {
  click: "bg-blue-100 text-blue-800",
  form_submit: "bg-green-100 text-green-800",
  scroll: "bg-purple-100 text-purple-800",
  time_on_page: "bg-orange-100 text-orange-800",
  pageload: "bg-gray-100 text-gray-800",
};

const EVENT_SUGGESTIONS = [
  "Lead", "ViewContent", "InitiateCheckout", "AddToCart",
  "Purchase", "CompleteRegistration", "Subscribe", "Search",
  "ViewOffer", "ClickCTA", "WatchVideo",
];

const EMPTY_FORM: CreatePixelEventPayload = {
  eventName: "",
  triggerType: "click",
  selector: "",
  buttonText: "",
  scrollDepth: undefined,
  timeSeconds: undefined,
  customData: {},
};

// ─── Sub-component: trigger config fields ───────────────────────────────────

function TriggerFields({
  form,
  onChange,
}: {
  form: CreatePixelEventPayload;
  onChange: (patch: Partial<CreatePixelEventPayload>) => void;
}) {
  switch (form.triggerType) {
    case "click":
      return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">
              Seletor CSS <span className="text-gray-400">(opcional)</span>
            </Label>
            <Input
              placeholder=".btn-comprar, #cta-top"
              value={form.selector ?? ""}
              onChange={(e) => onChange({ selector: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">
              Texto do botão <span className="text-gray-400">(parcial)</span>
            </Label>
            <Input
              placeholder="Comprar agora"
              value={form.buttonText ?? ""}
              onChange={(e) => onChange({ buttonText: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
        </div>
      );
    case "form_submit":
      return (
        <div>
          <Label className="text-xs text-gray-500 mb-1 block">
            Seletor CSS do formulário <span className="text-gray-400">(vazio = qualquer form)</span>
          </Label>
          <Input
            placeholder="#form-contato, .lead-form"
            value={form.selector ?? ""}
            onChange={(e) => onChange({ selector: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      );
    case "scroll":
      return (
        <div>
          <Label className="text-xs text-gray-500 mb-1 block">
            Profundidade de scroll <span className="text-gray-400">(%)</span>
          </Label>
          <Input
            type="number"
            min={1}
            max={100}
            placeholder="50"
            value={form.scrollDepth ?? ""}
            onChange={(e) =>
              onChange({ scrollDepth: e.target.value ? parseInt(e.target.value) : undefined })
            }
            className="h-8 text-sm w-32"
          />
        </div>
      );
    case "time_on_page":
      return (
        <div>
          <Label className="text-xs text-gray-500 mb-1 block">
            Tempo na página <span className="text-gray-400">(segundos)</span>
          </Label>
          <Input
            type="number"
            min={1}
            placeholder="30"
            value={form.timeSeconds ?? ""}
            onChange={(e) =>
              onChange({ timeSeconds: e.target.value ? parseInt(e.target.value) : undefined })
            }
            className="h-8 text-sm w-32"
          />
        </div>
      );
    case "pageload":
      return (
        <p className="text-xs text-gray-400 italic">
          Dispara imediatamente ao carregar a página, junto com o PageView.
        </p>
      );
    default:
      return null;
  }
}

// ─── Main component ──────────────────────────────────────────────────────────

export function PixelEventsEditor({ projectId }: { projectId: string }) {
  const [rules, setRules] = useState<PixelEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreatePixelEventPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    getPixelEvents(projectId)
      .then(setRules)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  function patchForm(patch: Partial<CreatePixelEventPayload>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function validateForm(): string | null {
    if (!form.eventName.trim()) return 'Informe o nome do evento.';
    if (form.triggerType === 'click' && !form.selector?.trim() && !form.buttonText?.trim())
      return 'Para trigger de clique, informe o Seletor CSS ou o Texto do botão.';
    if (form.triggerType === 'scroll' && !form.scrollDepth)
      return 'Informe a profundidade de scroll (%).';
    if (form.triggerType === 'time_on_page' && !form.timeSeconds)
      return 'Informe o tempo em segundos.';
    return null;
  }

  async function handleSave() {
    const err = validateForm();
    if (err) { alert(err); return; }
    setSaving(true);
    try {
      const payload: CreatePixelEventPayload = {
        eventName: form.eventName.trim(),
        triggerType: form.triggerType,
        selector: form.selector?.trim() || undefined,
        buttonText: form.buttonText?.trim() || undefined,
        scrollDepth: form.scrollDepth,
        timeSeconds: form.timeSeconds,
        customData: form.customData,
      };

      if (editingId) {
        const updated = await updatePixelEvent(projectId, editingId, payload);
        setRules((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await createPixelEvent(projectId, payload);
        setRules((prev) => [...prev, created]);
      }

      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditingId(null);
    } catch (_) {
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(rule: PixelEvent) {
    setForm({
      eventName: rule.eventName,
      triggerType: rule.triggerType,
      selector: rule.selector ?? "",
      buttonText: rule.buttonText ?? "",
      scrollDepth: rule.scrollDepth ?? undefined,
      timeSeconds: rule.timeSeconds ?? undefined,
      customData: rule.customData ?? {},
    });
    setEditingId(rule.id);
    setShowForm(true);
  }

  function handleCancel() {
    setForm(EMPTY_FORM);
    setShowForm(false);
    setEditingId(null);
  }

  async function handleToggle(rule: PixelEvent) {
    const updated = await updatePixelEvent(projectId, rule.id, { isActive: !rule.isActive });
    setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deletePixelEvent(projectId, id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (_) {
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando regras de eventos...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rule list */}
      {rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center justify-between p-3 rounded-lg border bg-white transition-opacity ${
                rule.isActive ? "opacity-100" : "opacity-50"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Switch
                  checked={rule.isActive}
                  onCheckedChange={() => handleToggle(rule)}
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-gray-800">
                      {rule.eventName}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        TRIGGER_COLORS[rule.triggerType as TriggerType]
                      }`}
                    >
                      {TRIGGER_LABELS[rule.triggerType as TriggerType]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {rule.triggerType === "click" &&
                      ([rule.selector, rule.buttonText].filter(Boolean).join(" · ") || "—")}
                    {rule.triggerType === "form_submit" &&
                      (rule.selector || "qualquer formulário")}
                    {rule.triggerType === "scroll" &&
                      `${rule.scrollDepth}% da página`}
                    {rule.triggerType === "time_on_page" &&
                      `${rule.timeSeconds}s na página`}
                    {rule.triggerType === "pageload" && "ao carregar a página"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-blue-600"
                  onClick={() => handleEdit(rule)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-red-600"
                  disabled={deletingId === rule.id}
                  onClick={() => handleDelete(rule.id)}
                >
                  {deletingId === rule.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rules.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 italic">
          Nenhuma regra configurada ainda. Adicione a primeira regra para começar a rastrear
          eventos específicos nesta página.
        </p>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="border border-indigo-200 rounded-lg bg-indigo-50/40 p-4 space-y-4">
          <p className="text-sm font-semibold text-gray-700">
            {editingId ? "Editar regra" : "Nova regra de evento"}
          </p>

          {/* Event name */}
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">
              Nome do evento <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Lead, ViewContent, ClickCTA..."
                value={form.eventName}
                onChange={(e) => patchForm({ eventName: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {EVENT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="text-xs px-2 py-0.5 rounded bg-white border border-gray-200 hover:border-indigo-400 hover:text-indigo-700 transition-colors"
                  onClick={() => patchForm({ eventName: s })}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Trigger type */}
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Disparador</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    form.triggerType === t
                      ? "border-indigo-500 bg-indigo-500 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"
                  }`}
                  onClick={() => patchForm({ triggerType: t })}
                >
                  {TRIGGER_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Trigger-specific fields */}
          <TriggerFields form={form} onChange={patchForm} />

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-8"
              onClick={handleSave}
              disabled={saving || !form.eventName.trim()}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <Check className="w-3.5 h-3.5 mr-1" />
              )}
              {editingId ? "Salvar alterações" : "Adicionar regra"}
            </Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={handleCancel}>
              <X className="w-3.5 h-3.5 mr-1" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!showForm && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
          onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Adicionar regra de evento
        </Button>
      )}
    </div>
  );
}
