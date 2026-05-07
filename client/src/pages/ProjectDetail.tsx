import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  getProject,
  updateProject,
  googleAdsGetAuthUrl,
  googleAdsGetIntegration,
  googleAdsDisconnect,
  type ProjectDetail as ProjectDetailType,
  type GoogleAdsIntegration,
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PixelEventsEditor } from "@/components/PixelEventsEditor";
import {
  ArrowLeft,
  Settings,
  Code2,
  ShoppingCart,
  Zap,
  Globe,
  ChevronDown,
  Copy,
  Check,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BarChart2,
  Webhook,
  Link2,
  Server,
  Key,
  Rocket,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isConfigureMode = searchParams.get("configure") === "1";
  const trafficSectionRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<ProjectDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(
    isConfigureMode ? "meta" : null
  );
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(isConfigureMode);

  const [metaForm, setMetaForm] = useState({ pixelFacebookId: "", tokenFacebookApi: "", testEventCode: "" });
  const [tiktokForm, setTiktokForm] = useState({ tikTokPixelId: "", tokenTikTokApi: "", testEventCodeTikTok: "" });
  const [ga4Form, setGa4Form] = useState({ ga4MeasurementId: "", ga4ApiSecret: "" });
  const [googleAdsIntegration, setGoogleAdsIntegration] = useState<GoogleAdsIntegration | null>(null);
  const [connectingGoogleAds, setConnectingGoogleAds] = useState(false);
  const [generalForm, setGeneralForm] = useState({
    name: "", domain: "", checkoutType: "shopify", projectType: "ecommerce",
  });
  const [customDomainForm, setCustomDomainForm] = useState({ customDomain: "" });
  const [savingSection, setSavingSection] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getProject(id)
      .then((d) => {
        setData(d);
        setGeneralForm({
          name: d.project.name || "",
          domain: d.project.domain || "",
          checkoutType: d.project.checkoutType || "shopify",
          projectType: d.project.projectType || "ecommerce",
        });
        setMetaForm({
          pixelFacebookId: d.project.pixelFacebookId || "",
          tokenFacebookApi: "",
          testEventCode: d.project.testEventCode || "",
        });
        setTiktokForm({
          tikTokPixelId: d.project.tikTokPixelId || "",
          tokenTikTokApi: "",
          testEventCodeTikTok: d.project.testEventCodeTikTok || "",
        });
        setGa4Form({
          ga4MeasurementId: d.project.ga4MeasurementId || "",
          ga4ApiSecret: "",
        });
        setCustomDomainForm({ customDomain: d.project.customDomain || "" });
        googleAdsGetIntegration(d.project.id)
          .then(setGoogleAdsIntegration)
          .catch(() => {});
        if (isConfigureMode) {
          setTimeout(() => {
            trafficSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 300);
        }
      })
      .catch(() => toast.error("Projeto não encontrado"))
      .finally(() => setLoading(false));
  }, [id]);

  const saveSection = useCallback(async (section: string, payload: Record<string, unknown>) => {
    if (!id) return;
    setSavingSection(section);
    try {
      if (payload.tokenFacebookApi === "") delete payload.tokenFacebookApi;
      if (payload.tokenTikTokApi === "") delete payload.tokenTikTokApi;
      if (payload.ga4ApiSecret === "") delete payload.ga4ApiSecret;
      const updated = await updateProject(id, payload);
      setData(updated);
      // Sync forms from updated data so fields reflect what was saved
      if (section === "meta") {
        setMetaForm({
          pixelFacebookId: updated.project.pixelFacebookId || "",
          tokenFacebookApi: "",   // always blank for security
          testEventCode: updated.project.testEventCode || "",
        });
      }
      if (section === "tiktok") {
        setTiktokForm({
          tikTokPixelId: updated.project.tikTokPixelId || "",
          tokenTikTokApi: "",     // always blank for security
          testEventCodeTikTok: updated.project.testEventCodeTikTok || "",
        });
      }
      if (section === "ga4") {
        setGa4Form({
          ga4MeasurementId: updated.project.ga4MeasurementId || "",
          ga4ApiSecret: "",       // always blank for security
        });
      }
      if (section === "general") {
        setGeneralForm({
          name: updated.project.name || "",
          domain: updated.project.domain || "",
          checkoutType: updated.project.checkoutType || "shopify",
          projectType: updated.project.projectType || "ecommerce",
        });
      }
      if (section === "customDomain") {
        setCustomDomainForm({ customDomain: updated.project.customDomain || "" });
      }
      toast.success("Salvo com sucesso!");
      setExpandedSection(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSavingSection(null);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Carregando projeto...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { project } = data;
  const checkoutType = project.checkoutType ?? "shopify";
  const metaConfigured = project.hasFacebookToken || Boolean(project.pixelFacebookId);
  const tiktokConfigured = project.hasTikTokToken || Boolean(project.tikTokPixelId);
  const ga4Configured = project.hasGa4Secret || Boolean(project.ga4MeasurementId);
  const googleAdsConfigured = googleAdsIntegration?.connected ?? false;

  async function handleGoogleAdsConnect() {
    if (!project.id) return;
    setConnectingGoogleAds(true);
    try {
      const { authUrl } = await googleAdsGetAuthUrl(project.id);
      window.location.href = authUrl;
    } catch (e: any) {
      toast.error(e?.message || "Erro ao iniciar autenticação Google Ads");
      setConnectingGoogleAds(false);
    }
  }

  async function handleGoogleAdsDisconnect() {
    if (!project.id) return;
    try {
      await googleAdsDisconnect(project.id);
      setGoogleAdsIntegration({ connected: false });
      toast.success("Google Ads desconectado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao desconectar Google Ads");
    }
  }

  const toggle = (section: string) =>
    setExpandedSection((prev) => (prev === section ? null : section));

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      {/* Back */}
      <button
        onClick={() => navigate("/projects")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Voltar aos projetos
      </button>

      {/* Hero header */}
      <div className="relative rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden p-6">
        <div className="pointer-events-none absolute -top-16 right-0 h-48 w-64 rounded-full bg-primary/6 blur-[60px]" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow-sm shrink-0 text-2xl font-bold text-white font-display">
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
                {project.name}
              </h1>
              <StatusPill active={project.isActive} />
              <CheckoutBadge checkoutType={checkoutType} />
            </div>
            {project.domain && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <Globe className="h-3.5 w-3.5" />
                {project.domain}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            <button
              onClick={() => navigate(`/projects/${id}/dashboard`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
            >
              <BarChart2 className="h-4 w-4" />
              Dashboard
            </button>
            <div className="flex items-center gap-3">
              <IntegrationDot label="Meta" active={metaConfigured} />
              <IntegrationDot label="TikTok" active={tiktokConfigured} />
              <IntegrationDot label="GA4" active={ga4Configured} />
              <IntegrationDot label="G.Ads" active={googleAdsConfigured} />
              <IntegrationDot label="Checkout" active={true} dashed />
            </div>
          </div>
        </div>
      </div>

      {/* Section: Informações Gerais */}
      <SectionGroup label="Projeto" icon={Settings}>
        <IntegrationCard
          icon={<Settings className="h-4 w-4 text-muted-foreground" />}
          title="Informações Gerais"
          subtitle="Nome, domínio e tipo de integração"
          status="neutral"
          expanded={expandedSection === "general"}
          onToggle={() => toggle("general")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nome do projeto">
              <Input value={generalForm.name}
                onChange={(e) => setGeneralForm({ ...generalForm, name: e.target.value })}
                className="h-10 bg-muted/40 border-border/60" />
            </FormField>
            <FormField label="Domínio">
              <Input value={generalForm.domain}
                onChange={(e) => setGeneralForm({ ...generalForm, domain: e.target.value })}
                placeholder="sualoja.com.br"
                className="h-10 bg-muted/40 border-border/60" />
            </FormField>
            <FormField label="Tipo de projeto">
              <select
                value={generalForm.projectType}
                onChange={(e) => setGeneralForm({ ...generalForm, projectType: e.target.value })}
                className="h-10 w-full rounded-md border border-border/60 bg-muted/40 px-3 text-sm text-foreground focus:outline-none focus:border-primary/60"
              >
                <option value="ecommerce">E-commerce</option>
                <option value="direct">Tráfego Direto</option>
              </select>
            </FormField>
            <FormField label="Checkout / Plataforma">
              <select
                value={generalForm.checkoutType}
                onChange={(e) => setGeneralForm({ ...generalForm, checkoutType: e.target.value })}
                className="h-10 w-full rounded-md border border-border/60 bg-muted/40 px-3 text-sm text-foreground focus:outline-none focus:border-primary/60"
              >
                <option value="shopify">Shopify</option>
                <option value="cartpanda">CartPanda</option>
                <option value="shopify_yampi">Shopify + Yampi</option>
                <option value="shopify_cartpanda">Shopify + CartPanda</option>
                <option value="ticto">Ticto</option>
                <option value="hotmart">Hotmart</option>
                <option value="kirvano">Kirvano</option>
                <option value="kiwify">Kiwify</option>
                <option value="greenn">Greenn</option>
                <option value="lastlink">Lastlink</option>
                <option value="pagtrust">PagTrust</option>
                <option value="hubla">Hubla</option>
                <option value="eduzz">Eduzz</option>
                <option value="perfectpay">PerfectPay</option>
                <option value="payt">Payt</option>
                <option value="woocommerce">WooCommerce</option>
              </select>
            </FormField>
          </div>
          {(generalForm.checkoutType !== data.project.checkoutType ||
            generalForm.projectType !== data.project.projectType) && (
            <div className="flex items-start gap-3 p-3 rounded-xl border border-warning/20 bg-warning/5">
              <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ao alterar o tipo de checkout, os scripts exibidos nesta página serão atualizados
                para refletir a nova configuração. Certifique-se de reinstalar os scripts no novo formato.
              </p>
            </div>
          )}
          <SaveButton
            saving={savingSection === "general"}
            onClick={() => saveSection("general", { ...generalForm })}
          />
        </IntegrationCard>
      </SectionGroup>

      {/* Onboarding banner — shown when arriving from wizard */}
      {showOnboardingBanner && (
        <OnboardingBanner
          metaOk={metaConfigured}
          tiktokOk={tiktokConfigured}
          ga4Ok={ga4Configured}
          googleAdsOk={googleAdsConfigured}
          onDismiss={() => setShowOnboardingBanner(false)}
          onFocus={(section) => {
            setExpandedSection(section);
            trafficSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}

      {/* Section: Plataformas de Tráfego */}
      <div ref={trafficSectionRef}>
      <SectionGroup label="Plataformas de Tráfego" icon={Zap}>
        <IntegrationCard
          icon={<MetaIconSmall />}
          title="Meta Ads"
          subtitle="Facebook & Instagram · Conversions API v25.0"
          status={metaConfigured ? "connected" : "pending"}
          statusLabel={metaConfigured ? "Configurado" : "Não configurado"}
          expanded={expandedSection === "meta"}
          onToggle={() => toggle("meta")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Pixel ID">
              <Input value={metaForm.pixelFacebookId}
                onChange={(e) => setMetaForm({ ...metaForm, pixelFacebookId: e.target.value })}
                placeholder="1234567890"
                className="h-10 bg-muted/40 border-border/60 font-mono" />
            </FormField>
            <FormField
              label="Access Token (CAPI)"
              hint={project.hasFacebookToken ? "Configurado — deixe vazio para manter" : undefined}
            >
              <Input type="password" value={metaForm.tokenFacebookApi}
                onChange={(e) => setMetaForm({ ...metaForm, tokenFacebookApi: e.target.value })}
                placeholder={project.hasFacebookToken ? "••••••••••" : "EAAxxxxxx..."}
                className="h-10 bg-muted/40 border-border/60" />
            </FormField>
            <FormField label="Test Event Code" hint="Opcional">
              <Input value={metaForm.testEventCode}
                onChange={(e) => setMetaForm({ ...metaForm, testEventCode: e.target.value })}
                placeholder="TEST12345"
                className="h-10 bg-muted/40 border-border/60 font-mono" />
            </FormField>
          </div>
          <SaveButton saving={savingSection === "meta"} onClick={() => saveSection("meta", { ...metaForm })} />
        </IntegrationCard>

        <IntegrationCard
          icon={<TikTokIconSmall />}
          title="TikTok Ads"
          subtitle="TikTok & Reels · Events API"
          status={tiktokConfigured ? "connected" : "pending"}
          statusLabel={tiktokConfigured ? "Configurado" : "Não configurado"}
          expanded={expandedSection === "tiktok"}
          onToggle={() => toggle("tiktok")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Pixel ID">
              <Input value={tiktokForm.tikTokPixelId}
                onChange={(e) => setTiktokForm({ ...tiktokForm, tikTokPixelId: e.target.value })}
                placeholder="CTXXXXXX"
                className="h-10 bg-muted/40 border-border/60 font-mono" />
            </FormField>
            <FormField
              label="Access Token"
              hint={project.hasTikTokToken ? "Configurado — deixe vazio para manter" : undefined}
            >
              <Input type="password" value={tiktokForm.tokenTikTokApi}
                onChange={(e) => setTiktokForm({ ...tiktokForm, tokenTikTokApi: e.target.value })}
                placeholder={project.hasTikTokToken ? "••••••••••" : "xxxxxxxx..."}
                className="h-10 bg-muted/40 border-border/60" />
            </FormField>
            <FormField label="Test Event Code" hint="Opcional">
              <Input value={tiktokForm.testEventCodeTikTok}
                onChange={(e) => setTiktokForm({ ...tiktokForm, testEventCodeTikTok: e.target.value })}
                placeholder="TIKTEST001"
                className="h-10 bg-muted/40 border-border/60 font-mono" />
            </FormField>
          </div>
          <SaveButton saving={savingSection === "tiktok"} onClick={() => saveSection("tiktok", { ...tiktokForm })} />
        </IntegrationCard>

        <IntegrationCard
          icon={<GA4IconSmall />}
          title="Google Analytics 4"
          subtitle="Measurement Protocol — eventos server-side (Purchase, Lead)"
          status={ga4Configured ? "connected" : "pending"}
          statusLabel={ga4Configured ? "Configurado" : "Não configurado"}
          expanded={expandedSection === "ga4"}
          onToggle={() => toggle("ga4")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Measurement ID">
              <Input value={ga4Form.ga4MeasurementId}
                onChange={(e) => setGa4Form({ ...ga4Form, ga4MeasurementId: e.target.value })}
                placeholder="G-XXXXXXXXXX"
                className="h-10 bg-muted/40 border-border/60 font-mono" />
            </FormField>
            <FormField
              label="API Secret"
              hint={project.hasGa4Secret ? "Configurado — deixe vazio para manter" : undefined}
            >
              <Input type="password" value={ga4Form.ga4ApiSecret}
                onChange={(e) => setGa4Form({ ...ga4Form, ga4ApiSecret: e.target.value })}
                placeholder={project.hasGa4Secret ? "••••••••••" : "xxxxxxxxxxxx"}
                className="h-10 bg-muted/40 border-border/60" />
            </FormField>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
            GA4 Admin → Data Streams → seu stream → Measurement Protocol API secrets → criar secret.
          </p>
          <SaveButton saving={savingSection === "ga4"} onClick={() => saveSection("ga4", { ...ga4Form })} />
        </IntegrationCard>

        <IntegrationCard
          icon={<GoogleAdsIconSmall />}
          title="Google Ads"
          subtitle="Enhanced Conversions — server-side com OAuth2"
          status={googleAdsConfigured ? "connected" : "pending"}
          statusLabel={googleAdsConfigured ? "Conectado" : "Não conectado"}
          expanded={expandedSection === "google_ads"}
          onToggle={() => toggle("google_ads")}
          headerAction={!googleAdsConfigured ? (
            <button
              onClick={handleGoogleAdsConnect}
              disabled={connectingGoogleAds}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4285F4] hover:bg-[#3367d6] text-white text-xs font-medium transition-colors disabled:opacity-60"
            >
              {connectingGoogleAds ? <Loader2 className="h-3 w-3 animate-spin" /> : <GoogleAdsIconSmall white />}
              Conectar
            </button>
          ) : undefined}
        >
          {googleAdsConfigured ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Conta conectada</span>
                  {googleAdsIntegration?.customerId && (
                    <span className="text-muted-foreground ml-2 font-mono text-xs">
                      ID: {googleAdsIntegration.customerId}
                    </span>
                  )}
                </div>
              </div>
              {googleAdsIntegration?.events && Object.keys(googleAdsIntegration.events).length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground/70">Eventos configurados:</p>
                  {Object.entries(googleAdsIntegration.events).map(([name]) => (
                    <div key={name} className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                      {name}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleGoogleAdsConnect}
                  disabled={connectingGoogleAds}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  Reconectar
                </button>
                <button
                  onClick={handleGoogleAdsDisconnect}
                  className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                >
                  Desconectar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Conecte sua conta Google Ads para enviar conversões server-side com Enhanced Conversions.
                O fluxo de autenticação OAuth2 é guiado — não é necessário criar credenciais manualmente.
              </p>
              <button
                onClick={handleGoogleAdsConnect}
                disabled={connectingGoogleAds}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4285F4] hover:bg-[#3367d6] text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {connectingGoogleAds ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleAdsIconSmall white />
                )}
                Conectar Google Ads
              </button>
            </div>
          )}
        </IntegrationCard>
      </SectionGroup>
      </div>

      {/* Section: Regras de Eventos — only for direct-response projects */}
      {project.projectType === "direct" && (
        <SectionGroup label="Regras de Eventos" icon={Zap}>
          <IntegrationCard
            icon={<Zap className="h-4 w-4 text-indigo-500" />}
            title="Funil de Eventos"
            subtitle="Configure disparadores automáticos — cliques, formulários, scroll e tempo na página"
            status="connected"
            statusLabel="Ativo"
            expanded={expandedSection === "pixel-events"}
            onToggle={() => toggle("pixel-events")}
          >
            <PixelEventsEditor projectId={project.id} />
          </IntegrationCard>
        </SectionGroup>
      )}

      {/* Section: Checkout & Integração — conditional by checkoutType */}
      <CheckoutSection data={data} expandedSection={expandedSection} toggle={toggle} />

      {/* Section: Instalação — script + domínio personalizado */}
      <InstallSection
        data={data}
        expandedSection={expandedSection}
        toggle={toggle}
        customDomainForm={customDomainForm}
        setCustomDomainForm={setCustomDomainForm}
        savingSection={savingSection}
        saveSection={saveSection}
      />
    </div>
  );
}

// ─── Checkout Section (conditional by checkoutType) ────────────────────────────

function WebhookCallout() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/15 bg-primary/5">
      <Webhook className="h-4 w-4 text-primary shrink-0" />
      <p className="text-xs text-muted-foreground leading-relaxed flex-1">
        Configure os webhooks de compra em{" "}
        <a href="/account/webhooks" className="text-primary font-medium hover:underline">
          Webhooks
        </a>
        {" "}— gere a URL e vincule este projeto ao endpoint desejado.
      </p>
    </div>
  );
}

function CheckoutSection({
  data,
  expandedSection,
  toggle,
}: {
  data: ProjectDetailType;
  expandedSection: string | null;
  toggle: (s: string) => void;
}) {
  const { project } = data;
  const checkoutType = project.checkoutType ?? "shopify";

  if (checkoutType === "cartpanda") {
    return (
      <SectionGroup label="Integração CartPanda" icon={ShoppingCart}>
        <WebhookCallout />
        <IntegrationCard
          icon={<CartPandaIconSmall />}
          title="Script da Loja"
          subtitle="Script de rastreamento para todas as páginas da loja"
          status="connected" statusLabel="Disponível"
          expanded={expandedSection === "cp_store"}
          onToggle={() => toggle("cp_store")}
        >
          <div className="space-y-4">
            <InfoBox color="purple">
              Cole o script no <strong>Theme Liquid</strong> da sua loja CartPanda, dentro da tag{" "}
              <code className="bg-muted/50 px-1 rounded font-mono text-[11px]">&lt;head&gt;</code>.
              Este script rastreia todas as páginas (PageView, ViewContent, etc.).
            </InfoBox>
            <CodeBlock code={data.installScript} maxHeight={120} />
          </div>
        </IntegrationCard>
        <IntegrationCard
          icon={<CartPandaIconSmall />}
          title="Script de Checkout"
          subtitle="Script leve para o checkout CartPanda — registra o cart_token para atribuição correta"
          status="connected" statusLabel="Disponível"
          expanded={expandedSection === "cp_checkout"}
          onToggle={() => toggle("cp_checkout")}
        >
          <div className="space-y-4">
            <InfoBox color="purple">
              CartPanda → <strong>Configurações → Checkout → Scripts Adicionais</strong> → seção <strong>Geral</strong> → cole a tag abaixo. Esse script é diferente do script da loja: ele é otimizado para o checkout e vincula o <code className="bg-muted/50 px-1 rounded font-mono text-[11px]">cart_token</code> ao visitante, garantindo que as origens apareçam corretamente no dashboard.
            </InfoBox>
            <div className="p-3 rounded-xl border border-warning/20 bg-warning/5">
              <p className="text-[11px] text-muted-foreground">
                <strong>Purchase</strong> é processado pelo Webhook — este script cuida da identidade no checkout (InitiateCheckout) para fechar a atribuição.
              </p>
            </div>
            <CodeBlock code={data.cartpandaCheckoutScriptTag} maxHeight={80} />
          </div>
        </IntegrationCard>
      </SectionGroup>
    );
  }

  if (checkoutType === "shopify") {
    return (
      <SectionGroup label="Integração Shopify" icon={ShoppingCart}>
        <WebhookCallout />
        <IntegrationCard
          icon={<ShopifyIconSmall />}
          title="Customer Events — Código do Pixel"
          subtitle="Rastreia checkout: InitiateCheckout, Lead, AddPaymentInfo"
          status="connected" statusLabel="Disponível"
          expanded={expandedSection === "sf_pixel"}
          onToggle={() => toggle("sf_pixel")}
        >
          <div className="space-y-4">
            <InfoBox color="green">
              Shopify → <strong>Configurações → Customer Events → Add custom pixel</strong> → cole o código JavaScript abaixo no campo de código. <strong>Não é uma URL</strong> — é o código completo do pixel.
            </InfoBox>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Código do Pixel (cole no Shopify)</Label>
              <CodeBlock
                code={buildShopifyPixelCode(data.shopifyCheckoutPixelUrl.replace('/tracking/shopify-checkout.js', '/collect/event'))}
                maxHeight={260}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[{ label: "Eventos", value: "4 etapas" }, { label: "Sandbox", value: "Sim" }, { label: "CAPI", value: "Server-side" }].map((item) => (
                <div key={item.label} className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground mb-0.5">{item.label}</p>
                  <p className="text-xs font-mono font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </IntegrationCard>
      </SectionGroup>
    );
  }

  if (checkoutType === "shopify_yampi") {
    return (
      <SectionGroup label="Integração Shopify + Yampi" icon={ShoppingCart}>
        <WebhookCallout />
        <IntegrationCard
          icon={<ShopifyIconSmall />}
          title="Script do Tema Shopify"
          subtitle="Cole no theme.liquid — captura UTMs e identificação antes do checkout"
          status="connected" statusLabel="Disponível"
          expanded={expandedSection === "sy_store"}
          onToggle={() => toggle("sy_store")}
        >
          <div className="space-y-4">
            <InfoBox color="green">
              Shopify → <strong>Temas → Editar código → theme.liquid</strong> → cole o script dentro do <code className="bg-muted/50 px-1 rounded font-mono text-[11px]">&lt;head&gt;</code>. Este script persiste UTMs e o ID do visitante via <code className="bg-muted/50 px-1 rounded font-mono text-[11px]">cart attributes</code> para garantir a atribuição ao chegar no checkout Yampi.
            </InfoBox>
            <CodeBlock code={data.installScript} maxHeight={120} />
          </div>
        </IntegrationCard>
        <IntegrationCard
          icon={<YampiIconSmall />}
          title="Script de Checkout Yampi"
          subtitle="Cole nos Scripts Adicionais do checkout Yampi — rastreia InitiateCheckout, AddShippingInfo e AddPaymentInfo"
          status="connected" statusLabel="Disponível"
          expanded={expandedSection === "sy_checkout"}
          onToggle={() => toggle("sy_checkout")}
        >
          <div className="space-y-4">
            <InfoBox color="blue">
              Yampi → <strong>Configurações → Checkout → Scripts Adicionais</strong> → seção <strong>Geral</strong> → cole a tag abaixo. Este script é específico para o checkout Yampi e rastreia os passos do funil via DataLayer com deduplicação por WeakSet.
            </InfoBox>
            <div className="p-3 rounded-xl border border-warning/20 bg-warning/5">
              <p className="text-[11px] text-muted-foreground">
                <strong>Purchase</strong> é processado pelo Webhook — este script cuida dos eventos de checkout (InitiateCheckout, AddShippingInfo, AddPaymentInfo) para fechar a atribuição.
              </p>
            </div>
            <CodeBlock code={data.yampiCheckoutScriptTag} maxHeight={80} />
          </div>
        </IntegrationCard>
      </SectionGroup>
    );
  }

  if (checkoutType === "shopify_cartpanda") {
    return (
      <SectionGroup label="Integração Shopify + CartPanda" icon={ShoppingCart}>
        <WebhookCallout />
        <IntegrationCard
          icon={<ShopifyIconSmall />}
          title="Script do Tema Shopify"
          subtitle="Cole no theme.liquid — captura UTMs e identificação antes do checkout"
          status="connected" statusLabel="Disponível"
          expanded={expandedSection === "sc_store"}
          onToggle={() => toggle("sc_store")}
        >
          <div className="space-y-4">
            <InfoBox color="green">
              Shopify → <strong>Temas → Editar código → theme.liquid</strong> → cole o script dentro do <code className="bg-muted/50 px-1 rounded font-mono text-[11px]">&lt;head&gt;</code>. Este script persiste UTMs e o ID do visitante para garantir a atribuição ao chegar no checkout CartPanda.
            </InfoBox>
            <CodeBlock code={data.installScript} maxHeight={120} />
          </div>
        </IntegrationCard>
        <IntegrationCard
          icon={<CartPandaIconSmall />}
          title="Script de Checkout CartPanda"
          subtitle="Cole nos Scripts Adicionais do checkout CartPanda — rastreia InitiateCheckout, AddShippingInfo e AddPaymentInfo"
          status="connected" statusLabel="Disponível"
          expanded={expandedSection === "sc_checkout"}
          onToggle={() => toggle("sc_checkout")}
        >
          <div className="space-y-4">
            <InfoBox color="purple">
              CartPanda → <strong>Configurações → Checkout → Scripts Adicionais</strong> → seção <strong>Geral</strong> → cole a tag abaixo. Este script rastreia os eventos do funil CartPanda via DataLayer com fallback de 2s.
            </InfoBox>
            <div className="p-3 rounded-xl border border-warning/20 bg-warning/5">
              <p className="text-[11px] text-muted-foreground">
                <strong>Purchase</strong> é processado pelo Webhook — este script cuida dos eventos de checkout (InitiateCheckout, AddShippingInfo, AddPaymentInfo) para fechar a atribuição.
              </p>
            </div>
            <CodeBlock code={data.cartpandaCheckoutScriptTag} maxHeight={80} />
          </div>
        </IntegrationCard>
      </SectionGroup>
    );
  }

  if (checkoutType === "ticto") {
    return (
      <SectionGroup label="Integração Ticto" icon={ShoppingCart}>
        <WebhookCallout />
        <IntegrationCard
          icon={<TictoIconSmall />}
          title="Script da Loja"
          subtitle="Cole no <head> de todas as páginas da sua loja ou landing page"
          status="connected" statusLabel="Disponível"
          expanded={expandedSection === "ticto_store"}
          onToggle={() => toggle("ticto_store")}
        >
          <div className="space-y-4">
            <InfoBox color="blue">
              Cole o script no <strong>&lt;head&gt;</strong> de todas as páginas da sua loja para rastrear
              PageView e capturar dados do visitante antes da compra.
            </InfoBox>
            <CodeBlock code={data.installScript} maxHeight={120} />
          </div>
        </IntegrationCard>
      </SectionGroup>
    );
  }

  if (checkoutType === "hotmart") {
    return (
      <SectionGroup label="Integração Hotmart" icon={ShoppingCart}>
        <WebhookCallout />
        <IntegrationCard
          icon={<HotmartIconSmall />}
          title="Script da Loja"
          subtitle="Cole no <head> de todas as páginas para rastrear visitantes"
          status="connected" statusLabel="Disponível"
          expanded={expandedSection === "hotmart_store"}
          onToggle={() => toggle("hotmart_store")}
        >
          <div className="space-y-4">
            <InfoBox color="blue">
              Cole o script no <strong>&lt;head&gt;</strong> da sua landing page ou funil para rastrear
              PageView, capturar UTMs e identificar o visitante antes da compra.
            </InfoBox>
            <CodeBlock code={data.installScript} maxHeight={120} />
          </div>
        </IntegrationCard>
      </SectionGroup>
    );
  }

  const simpleCheckouts: Record<string, { label: string; icon: React.ReactNode; infoColor: "blue" | "green" | "purple" }> = {
    kirvano:    { label: "Kirvano",    icon: <KirvanoIconSmall />,    infoColor: "blue" },
    kiwify:     { label: "Kiwify",     icon: <KiwifyIconSmall />,     infoColor: "blue" },
    greenn:     { label: "Greenn",     icon: <GreennIconSmall />,     infoColor: "green" },
    lastlink:   { label: "Lastlink",   icon: <LastlinkIconSmall />,   infoColor: "blue" },
    pagtrust:   { label: "PagTrust",   icon: <PagTrustIconSmall />,   infoColor: "blue" },
    hubla:      { label: "Hubla",      icon: <HublaIconSmall />,      infoColor: "purple" },
    eduzz:      { label: "Eduzz",      icon: <EduzzIconSmall />,      infoColor: "blue" },
    perfectpay: { label: "PerfectPay", icon: <PerfectPayIconSmall />, infoColor: "blue" },
    payt:       { label: "Payt",       icon: <PaytIconSmall />,       infoColor: "blue" },
  };

  if (simpleCheckouts[checkoutType]) {
    const { label, icon, infoColor } = simpleCheckouts[checkoutType];
    const storeKey = `${checkoutType}_store`;
    return (
      <SectionGroup label={`Integração ${label}`} icon={ShoppingCart}>
        <WebhookCallout />
        <IntegrationCard
          icon={icon}
          title="Script da Loja"
          subtitle="Cole no <head> para rastrear visitantes e capturar UTMs"
          status="connected" statusLabel="Disponível"
          expanded={expandedSection === storeKey}
          onToggle={() => toggle(storeKey)}
        >
          <div className="space-y-4">
            <InfoBox color={infoColor}>
              Cole o script no <strong>&lt;head&gt;</strong> de todas as páginas da sua landing page ou funil.
            </InfoBox>
            <CodeBlock code={data.installScript} maxHeight={120} />
          </div>
        </IntegrationCard>
      </SectionGroup>
    );
  }

  // woocommerce or unknown
  return (
    <SectionGroup label="Integração de Checkout" icon={ShoppingCart}>
      <IntegrationCard
        icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
        title="WooCommerce"
        subtitle="Integração em desenvolvimento"
        status="soon" statusLabel="Em breve"
        expanded={false} onToggle={() => {}} disabled
      />
    </SectionGroup>
  );
}

// ─── Info Box ──────────────────────────────────────────────────────────────────

function InfoBox({ children, color }: { children: React.ReactNode; color: "purple" | "green" | "blue" }) {
  const styles = {
    purple: "border-violet-500/15 bg-violet-500/5 text-violet-400",
    green: "border-emerald-500/15 bg-emerald-500/5 text-emerald-400",
    blue: "border-blue-500/15 bg-blue-500/5 text-blue-400",
  };
  return (
    <div className={cn("flex items-start gap-3 p-4 rounded-xl border", styles[color])}>
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

// ─── Onboarding Banner ────────────────────────────────────────────────────────

const PLATFORMS = [
  { key: "meta",       label: "Meta Ads",    section: "meta"       },
  { key: "tiktok",     label: "TikTok",      section: "tiktok"     },
  { key: "ga4",        label: "GA4",         section: "ga4"        },
  { key: "googleAds",  label: "Google Ads",  section: "google_ads" },
] as const;

function OnboardingBanner({
  metaOk, tiktokOk, ga4Ok, googleAdsOk, onDismiss, onFocus,
}: {
  metaOk: boolean; tiktokOk: boolean; ga4Ok: boolean; googleAdsOk: boolean;
  onDismiss: () => void;
  onFocus: (section: string) => void;
}) {
  const states = { meta: metaOk, tiktok: tiktokOk, ga4: ga4Ok, googleAds: googleAdsOk };
  const doneCount = Object.values(states).filter(Boolean).length;
  const total = PLATFORMS.length;
  const allDone = doneCount === total;

  const firstPending = PLATFORMS.find((p) => !states[p.key]);

  return (
    <div className={cn(
      "relative rounded-2xl border overflow-hidden transition-all duration-300",
      allDone
        ? "border-success/30 bg-success/5"
        : "border-primary/25 bg-primary/5"
    )}>
      <div className="pointer-events-none absolute -top-12 right-0 h-32 w-48 rounded-full bg-primary/8 blur-[40px]" />

      <div className="relative p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
            allDone ? "bg-success/15" : "bg-primary/15"
          )}>
            {allDone
              ? <CheckCircle2 className="h-5 w-5 text-success" />
              : <Rocket className="h-5 w-5 text-primary" />
            }
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <p className="text-sm font-semibold text-foreground">
                {allDone ? "Projeto totalmente configurado!" : "Configure seus pixels de anúncio"}
              </p>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                allDone ? "bg-success/15 text-success" : "bg-primary/15 text-primary"
              )}>
                {doneCount}/{total}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {allDone
                ? "Todos os pixels estão configurados. O rastreamento de conversões está ativo."
                : "Adicione as credenciais das plataformas que você usa. Cada plataforma é independente — configure só o que precisar."}
            </p>

            {/* Platform pills */}
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const ok = states[p.key];
                return (
                  <button
                    key={p.key}
                    onClick={() => !ok && onFocus(p.section)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                      ok
                        ? "border-success/30 bg-success/10 text-success cursor-default"
                        : "border-primary/25 bg-primary/8 text-primary hover:bg-primary/15 cursor-pointer"
                    )}
                  >
                    {ok
                      ? <Check className="h-3 w-3" />
                      : <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                    }
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* CTA */}
            {!allDone && firstPending && (
              <button
                onClick={() => onFocus(firstPending.section)}
                className="mt-4 flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Começar com {firstPending.label}
                <ArrowLeft className="h-3 w-3 rotate-180" />
              </button>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={onDismiss}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Progress bar */}
        {!allDone && (
          <div className="mt-4 h-1 w-full rounded-full bg-primary/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
              style={{ width: `${(doneCount / total) * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Group ─────────────────────────────────────────────────────────────

function SectionGroup({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className="flex-1 h-px bg-border/40" />
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// ─── Integration Card ─────────────────────────────────────────────────────────

type IntegrationStatus = "connected" | "pending" | "soon" | "neutral";

function IntegrationCard({
  icon, title, subtitle, status, statusLabel,
  expanded, onToggle, children, disabled, headerAction,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  status: IntegrationStatus;
  statusLabel?: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  headerAction?: React.ReactNode;
}) {
  const statusStyles: Record<IntegrationStatus, string> = {
    connected: "text-success bg-success/10",
    pending: "text-warning bg-warning/10",
    soon: "text-muted-foreground bg-muted/30",
    neutral: "text-muted-foreground bg-muted/30",
  };
  const statusIcons: Record<IntegrationStatus, React.ReactNode> = {
    connected: <CheckCircle2 className="h-3 w-3" />,
    pending: <AlertCircle className="h-3 w-3" />,
    soon: null,
    neutral: null,
  };

  return (
    <div className={cn(
      "rounded-xl border border-border/60 bg-card overflow-hidden transition-all duration-200",
      disabled ? "opacity-50" : "hover:border-border/80",
      expanded && "border-primary/25 shadow-glow-sm"
    )}>
      <button
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={cn(
          "w-full flex items-center gap-4 px-5 py-4 transition-colors",
          !disabled && "hover:bg-muted/10 cursor-pointer",
          expanded && "bg-muted/10"
        )}
      >
        <div className="shrink-0">{icon}</div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
        {statusLabel && (
          <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0", statusStyles[status])}>
            {statusIcons[status]}
            {statusLabel}
          </div>
        )}
        {headerAction && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {headerAction}
          </div>
        )}
        {!disabled && (
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0", expanded && "rotate-180")} />
        )}
      </button>
      {expanded && children && (
        <div className="border-t border-border/40 px-5 py-5 space-y-4 animate-fade-in bg-muted/5">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CheckoutBadge({ checkoutType }: { checkoutType: string }) {
  const labels: Record<string, { label: string; cls: string }> = {
    shopify:           { label: "Shopify",              cls: "bg-[#95BF47]/15 text-[#95BF47]"       },
    cartpanda:         { label: "CartPanda",            cls: "bg-violet-500/15 text-violet-400"      },
    shopify_yampi:     { label: "Shopify + Yampi",      cls: "bg-emerald-500/15 text-emerald-400"    },
    shopify_cartpanda: { label: "Shopify + CartPanda",  cls: "bg-violet-500/15 text-violet-400"      },
    woocommerce:       { label: "WooCommerce",          cls: "bg-purple-500/15 text-purple-400"      },
    ticto:         { label: "Ticto",           cls: "bg-sky-500/15 text-sky-400"            },
    hotmart:       { label: "Hotmart",         cls: "bg-red-500/15 text-red-400"            },
    kirvano:       { label: "Kirvano",         cls: "bg-indigo-500/15 text-indigo-400"      },
    kiwify:        { label: "Kiwify",          cls: "bg-emerald-600/15 text-emerald-500"    },
    greenn:        { label: "Greenn",          cls: "bg-green-500/15 text-green-400"         },
    lastlink:      { label: "Lastlink",        cls: "bg-blue-500/15 text-blue-400"           },
    pagtrust:      { label: "PagTrust",        cls: "bg-orange-500/15 text-orange-400"       },
    hubla:         { label: "Hubla",           cls: "bg-violet-500/15 text-violet-400"       },
    eduzz:         { label: "Eduzz",           cls: "bg-cyan-500/15 text-cyan-400"           },
    perfectpay:    { label: "PerfectPay",      cls: "bg-pink-500/15 text-pink-400"           },
    payt:          { label: "Payt",            cls: "bg-teal-500/15 text-teal-400"           },
  };
  const { label, cls } = labels[checkoutType] ?? { label: checkoutType, cls: "bg-muted/30 text-muted-foreground" };
  return <span className={cn("text-[10px] font-semibold px-2.5 py-1 rounded-full", cls)}>{label}</span>;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
      active ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-success animate-pulse-glow" : "bg-muted-foreground")} />
      {active ? "Ativo" : "Inativo"}
    </div>
  );
}

function IntegrationDot({ label, active, dashed }: { label: string; active: boolean; dashed?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn("h-2 w-2 rounded-full",
        active ? (dashed ? "bg-success/60" : "bg-success animate-pulse-glow") : "bg-muted-foreground/30")} />
      <span className="text-[9px] text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-foreground/80">{label}</Label>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <div className="pt-2 flex justify-end">
      <button onClick={onClick} disabled={saving}
        className="flex items-center gap-2 px-5 h-9 rounded-lg bg-gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-all shadow-glow-sm">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}

// Gera o código JavaScript do Shopify Custom Pixel para copiar e colar no admin.
// Espelha buildScript() em nexus-worker/src/routes/shopify-checkout.ts.
function buildShopifyPixelCode(collectUrl: string): string {
  return `var __NX_COLLECT__ = ${JSON.stringify(collectUrl)};
var __NX_FIRED__   = {};

function nxUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function nxGetCookie(name) {
  try {
    var parts = ('; ' + document.cookie).split('; ' + name + '=');
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift() || '');
  } catch (_) {}
  return null;
}

function nxGetNxUser(checkout) {
  var attrs = (checkout && checkout.attributes) ? checkout.attributes : {};
  return attrs.nx_user || attrs.nx_lead_id || nxGetCookie('nx_lid') || '';
}

function nxGetUtms(checkout) {
  var attrs = (checkout && checkout.attributes) ? checkout.attributes : {};
  var utms = {};
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','src','sck','xcod'].forEach(function(k) {
    if (attrs[k]) utms[k] = attrs[k];
  });
  return Object.keys(utms).length ? utms : undefined;
}

function nxExtractItems(lineItems) {
  var contentIds = [], contents = [], names = [], numItems = 0;
  if (!lineItems) return { contentIds, contents, names, numItems };
  for (var i = 0; i < lineItems.length; i++) {
    var item = lineItems[i], variant = item.variant || {}, product = variant.product || {};
    var id = String(product.id || variant.id || ''), name = item.title || product.title || '';
    var qty = parseInt(item.quantity, 10) || 1;
    var price = (variant.price && variant.price.amount) ? parseFloat(variant.price.amount) : 0;
    if (id)   { contentIds.push(id); contents.push({ id, quantity: qty, item_price: price }); }
    if (name) names.push(name);
    numItems += qty;
  }
  return { contentIds, contents, names, numItems };
}

function nxSend(eventType, eventId, checkout, customer) {
  var token = (checkout && checkout.token) || '';
  var sig = eventType + ':' + token;
  if (__NX_FIRED__[sig]) return;
  __NX_FIRED__[sig] = true;

  var nxUser = nxGetNxUser(checkout);
  var items = nxExtractItems(checkout && checkout.lineItems);
  var total = checkout && checkout.totalPrice;
  var value = total ? parseFloat(total.amount || '0') : undefined;
  var currency = total ? (total.currencyCode || 'BRL') : 'BRL';
  var addr = (checkout && (checkout.shippingAddress || checkout.billingAddress)) || {};
  var email = (customer && customer.email) || (checkout && checkout.email) || undefined;
  var phone = (customer && customer.phone) || addr.phone || undefined;
  var firstName = (customer && customer.firstName) || addr.firstName || undefined;
  var lastName  = (customer && customer.lastName)  || addr.lastName  || undefined;
  var pageUrl = '';
  try { pageUrl = document.location.href.split('?')[0]; } catch (_) {}

  fetch(__NX_COLLECT__, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({
      event: eventType, event_id: eventId, nx_user: nxUser, page_url: pageUrl,
      user_data: { email, phone, first_name: firstName, last_name: lastName,
        city: addr.city || undefined, state: addr.provinceCode || undefined,
        zip: addr.zip || undefined, country: addr.countryCode || undefined },
      browser_data: { fbc: nxGetCookie('_fbc') || undefined, fbp: nxGetCookie('_fbp') || undefined, ttp: nxGetCookie('_ttp') || undefined },
      utm_data: nxGetUtms(checkout),
      custom_data: { value, currency,
        content_ids:  items.contentIds.length ? items.contentIds : undefined,
        contents:     items.contents.length   ? items.contents   : undefined,
        content_name: items.names.join(', ')  || undefined,
        content_type: items.contentIds.length ? 'product' : undefined,
        num_items: items.numItems || undefined },
    }),
  }).catch(function() {});
}

analytics.subscribe('checkout_started', function(event) {
  var checkout = event.data && event.data.checkout;
  var customer = checkout && checkout.buyerIdentity && checkout.buyerIdentity.customer;
  var eventId = (checkout && checkout.token) ? ('sh_cart_' + checkout.token) : nxUuid();
  nxSend('InitiateCheckout', eventId, checkout, customer);
});
analytics.subscribe('checkout_contact_info_submitted', function(event) {
  var checkout = event.data && event.data.checkout;
  var customer = checkout && checkout.buyerIdentity && checkout.buyerIdentity.customer;
  nxSend('Lead', nxUuid(), checkout, customer);
});
analytics.subscribe('checkout_shipping_info_submitted', function(event) {
  var checkout = event.data && event.data.checkout;
  var customer = checkout && checkout.buyerIdentity && checkout.buyerIdentity.customer;
  nxSend('AddShippingInfo', nxUuid(), checkout, customer);
});
analytics.subscribe('payment_info_submitted', function(event) {
  var checkout = event.data && event.data.checkout;
  var customer = checkout && checkout.buyerIdentity && checkout.buyerIdentity.customer;
  nxSend('AddPaymentInfo', nxUuid(), checkout, customer);
});`;
}

function CopyField({ value, mono }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex gap-2">
      <Input readOnly value={value}
        className={cn("h-10 bg-muted/30 border-border/60 text-sm flex-1", mono && "font-mono")} />
      <button onClick={handleCopy}
        className={cn("h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 transition-all",
          copied ? "border-success/40 bg-success/10 text-success" : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:border-border")}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function CodeBlock({ code, maxHeight }: { code: string; maxHeight?: number }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/30">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-destructive/50" />
          <div className="h-2.5 w-2.5 rounded-full bg-warning/50" />
          <div className="h-2.5 w-2.5 rounded-full bg-success/50" />
        </div>
        <button onClick={handleCopy}
          className={cn("flex items-center gap-1.5 text-xs font-medium transition-colors",
            copied ? "text-success" : "text-muted-foreground hover:text-foreground")}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="px-4 py-3 text-[11px] font-mono text-muted-foreground overflow-auto bg-muted/10"
        style={{ maxHeight: maxHeight ? `${maxHeight}px` : undefined }}>
        {code}
      </pre>
    </div>
  );
}

// ─── Platform Icons ────────────────────────────────────────────────────────────

function MetaIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm shrink-0">f</div>;
}
function TikTokIconSmall() {
  return (
    <div className="h-8 w-8 rounded-lg bg-[#010101] flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.02a8.19 8.19 0 0 0 4.79 1.53V7.12a4.85 4.85 0 0 1-1.02-.43z" fill="white"/>
      </svg>
    </div>
  );
}
function GoogleIconSmall() {
  return (
    <div className="h-8 w-8 rounded-lg bg-white/5 border border-border/40 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="h-4 w-4">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    </div>
  );
}
function CartPandaIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0"><ShoppingCart className="h-4 w-4 text-white" /></div>;
}
function ShopifyIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-[#95BF47] flex items-center justify-center shrink-0 text-white font-black text-sm">S</div>;
}
function YampiIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400 font-black text-sm">Y</div>;
}
function TictoIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 text-white font-black text-sm">T</div>;
}
function HotmartIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-red-500/20 border border-red-500/20 flex items-center justify-center shrink-0 text-red-400 font-black text-sm">H</div>;
}
function KirvanoIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0 text-indigo-400 font-black text-xs">Kv</div>;
}
function KiwifyIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-emerald-600/20 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400 font-black text-xs">Ki</div>;
}
function GreennIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-green-500/20 border border-green-500/20 flex items-center justify-center shrink-0 text-green-400 font-black text-xs">Gr</div>;
}
function LastlinkIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-blue-500/20 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 font-black text-xs">Ll</div>;
}
function PagTrustIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/20 flex items-center justify-center shrink-0 text-orange-400 font-black text-xs">PT</div>;
}
function HublaIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-violet-500/20 border border-violet-500/20 flex items-center justify-center shrink-0 text-violet-400 font-black text-xs">Hb</div>;
}
function EduzzIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-cyan-500/20 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400 font-black text-xs">Ed</div>;
}
function PerfectPayIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-pink-500/20 border border-pink-500/20 flex items-center justify-center shrink-0 text-pink-400 font-black text-xs">PP</div>;
}
function PaytIconSmall() {
  return <div className="h-8 w-8 rounded-lg bg-teal-500/20 border border-teal-500/20 flex items-center justify-center shrink-0 text-teal-400 font-black text-xs">Pt</div>;
}
function GA4IconSmall() {
  return (
    <div className="h-8 w-8 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="#F9AB00"/>
      </svg>
    </div>
  );
}
function GoogleAdsIconSmall({ white }: { white?: boolean } = {}) {
  if (white) {
    // Compact icon for use on colored button backgrounds
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white" fillOpacity={0.9}/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white" fillOpacity={0.9}/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="white" fillOpacity={0.9}/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white" fillOpacity={0.9}/>
      </svg>
    );
  }
  return (
    <div className="h-8 w-8 rounded-lg bg-white/5 border border-border/40 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="h-4 w-4">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    </div>
  );
}

// ─── Install Section ───────────────────────────────────────────────────────────
// Replaces old WorkerSection + Instalação do Pixel sections.
// Shows the pixel script (ready to use — no worker setup needed) and the
// optional custom domain configuration via CNAME.

function InstallSection({
  data,
  expandedSection,
  toggle,
  customDomainForm,
  setCustomDomainForm,
  savingSection,
  saveSection,
}: {
  data: ProjectDetailType;
  expandedSection: string | null;
  toggle: (s: string) => void;
  customDomainForm: { customDomain: string };
  setCustomDomainForm: (v: { customDomain: string }) => void;
  savingSection: string | null;
  saveSection: (section: string, payload: Record<string, unknown>) => void;
}) {
  const { project } = data;
  const hasCustomDomain = !!project.customDomain;

  const isCartPanda = ["cartpanda", "shopify_yampi", "shopify_cartpanda"].includes(project.checkoutType ?? "");

  return (
    <SectionGroup label="Instalação" icon={Code2}>
      {/* ── Script Principal — oculto no CartPanda (coberto pelo "Script da Loja") ── */}
      {!isCartPanda && <IntegrationCard
        icon={<Code2 className="h-4 w-4 text-primary" />}
        title="Script de Rastreamento"
        subtitle="Cole no <head> de todas as páginas — captura UTMs, identifica visitantes e dispara eventos"
        status="connected"
        statusLabel="Pronto"
        expanded={expandedSection === "install_script"}
        onToggle={() => toggle("install_script")}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl border border-primary/15 bg-primary/5">
            <Server className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              O script roda no <strong>Worker compartilhado Nexus ROAS</strong> (edge global). Nenhuma configuração adicional necessária — seus pixels Meta e TikTok já estão configurados pelo painel.
              {hasCustomDomain && (
                <> O script é servido pelo <strong>seu domínio personalizado</strong> (<code className="bg-muted/50 px-1 rounded font-mono text-[11px]">{project.customDomain}</code>), tornando-o invisível para ad-blockers.</>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pixel ID</Label>
            <CopyField value={project.pixelId} mono />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              HTML — cole no &lt;head&gt;
            </Label>
            <CodeBlock code={data.installScript} maxHeight={120} />
          </div>

          {(project.checkoutType === "shopify" || project.checkoutType === "shopify_yampi") && (
            <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5">
              <AlertCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Instale no <code className="bg-muted/50 px-1 rounded font-mono text-[11px]">theme.liquid</code> dentro do <code className="bg-muted/50 px-1 rounded font-mono text-[11px]">&lt;head&gt;</code>. O script persiste UTMs e o ID do visitante via <code className="bg-muted/50 px-1 rounded font-mono text-[11px]">cart attributes</code> para que a atribuição chegue ao webhook de pedido.
              </p>
            </div>
          )}
        </div>
      </IntegrationCard>}

      {/* ── Domínio Personalizado ── */}
      <IntegrationCard
        icon={<Link2 className={cn("h-4 w-4", hasCustomDomain ? "text-success" : "text-muted-foreground")} />}
        title="Domínio Personalizado"
        subtitle={hasCustomDomain
          ? `Ativo: ${project.customDomain} → Worker Nexus ROAS`
          : "Opcional — aponte um subdomínio seu para o Worker via CNAME (invisível para ad-blockers)"}
        status={hasCustomDomain ? "connected" : "neutral"}
        statusLabel={hasCustomDomain ? "Configurado" : "Opcional"}
        expanded={expandedSection === "custom_domain"}
        onToggle={() => toggle("custom_domain")}
      >
        <div className="space-y-5">
          {/* Step 1: enter subdomain */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">1</span>
              <p className="text-xs font-medium text-foreground">Digite o subdomínio que você quer usar</p>
            </div>
            <FormField label="Subdomínio (sem https://)">
              <Input
                value={customDomainForm.customDomain}
                onChange={(e) => setCustomDomainForm({ customDomain: e.target.value.toLowerCase().trim() })}
                placeholder="tracker.sualoja.com.br"
                className="h-10 bg-muted/40 border-border/60 font-mono"
              />
            </FormField>
            <SaveButton
              saving={savingSection === "customDomain"}
              onClick={() => saveSection("customDomain", { customDomain: customDomainForm.customDomain || null })}
            />
          </div>

          {/* Step 2: add CNAME */}
          {data.workerBaseUrl && (
            <div className="space-y-3 border-t border-border/30 pt-4">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">2</span>
                <p className="text-xs font-medium text-foreground">Adicione este CNAME no DNS do seu domínio</p>
              </div>
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-border/40 bg-muted/20">
                  <div className="px-3 py-2">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Tipo</p>
                    <p className="text-xs font-mono font-semibold text-foreground">CNAME</p>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Nome / Host</p>
                    <p className="text-xs font-mono font-semibold text-foreground">
                      {customDomainForm.customDomain || project.customDomain || "tracker.sualoja.com.br"}
                    </p>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Valor / Destino</p>
                    <p className="text-xs font-mono font-semibold text-foreground truncate">
                      {data.workerBaseUrl.replace(/^https?:\/\//, '')}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Funciona com qualquer provedor DNS (Cloudflare, GoDaddy, Registro.br, etc.). O cliente não precisa ter conta na Cloudflare. Após salvar o CNAME, aguarde a propagação do DNS (geralmente minutos; pode levar até 24h).
              </p>
            </div>
          )}

          {/* Step 3: scripts are updated automatically */}
          {hasCustomDomain && (
            <div className="space-y-3 border-t border-border/30 pt-4">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-success/15 border border-success/20 flex items-center justify-center text-[10px] font-bold text-success shrink-0">✓</span>
                <p className="text-xs font-medium text-foreground">Scripts e webhooks atualizados automaticamente</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Todos os scripts e URLs de webhook desta página já usam <code className="bg-muted/50 px-1 rounded font-mono text-[11px]">{project.customDomain}</code>. Reinstale o script no site se você acabou de configurar o domínio.
              </p>
            </div>
          )}

          {/* Info: no custom domain */}
          {!data.workerBaseUrl && (
            <div className="flex items-start gap-3 p-3 rounded-xl border border-warning/20 bg-warning/5">
              <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>WORKER_URL</strong> não está configurado no ambiente do backend. Configure a variável de ambiente para habilitar o domínio personalizado.
              </p>
            </div>
          )}
        </div>
      </IntegrationCard>

      {/* ── Credenciais avançadas ── */}
      <IntegrationCard
        icon={<Key className="h-4 w-4 text-muted-foreground" />}
        title="Credenciais de Ingestão"
        subtitle="Pixel ID e Ingest Key — usados internamente pelo Worker para enviar dados ao dashboard"
        status="neutral"
        expanded={expandedSection === "install_creds"}
        onToggle={() => toggle("install_creds")}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-muted/10">
            <AlertCircle className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Essas credenciais são configuradas automaticamente no Worker quando você salva o projeto. Você não precisa copiá-las manualmente salvo em situações de diagnóstico.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pixel ID</Label>
            <CopyField value={project.pixelId} mono />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingest API Key</Label>
            <CopyField value={data.ingestApiKey} mono />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingest URL</Label>
            <CopyField value={data.ingestUrl} mono />
          </div>
        </div>
      </IntegrationCard>
    </SectionGroup>
  );
}
