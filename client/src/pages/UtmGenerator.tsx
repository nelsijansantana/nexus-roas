import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings2, 
  Users, 
  Zap, 
  Copy, 
  Check, 
  ExternalLink,
  Info,
  Facebook,
  Video,
  Search,
  Target,
  Linkedin,
  Globe,
  Wand2,
  Code
} from "lucide-react";
import { cn } from "@/lib/utils";

type Platform = 'meta' | 'google' | 'tiktok' | 'linkedin' | 'kwai';

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const OPTIONS = {
  platforms: [
    { value: 'meta', label: 'Meta Ads', icon: Facebook, color: 'text-blue-500' },
    { value: 'google', label: 'Google Ads', icon: Search, color: 'text-emerald-500' },
    { value: 'tiktok', label: 'TikTok Ads', icon: Video, color: 'text-rose-500' },
    { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-700' },
    { value: 'kwai', label: 'Kwai Ads', icon: Target, color: 'text-orange-500' },
  ],
  phases: [
    { value: 'PERF', label: 'Performance' },
    { value: 'TEST', label: 'Teste' },
    { value: 'SCALE', label: 'Escala' },
  ],
  funnels: [
    { value: 'TOF', label: 'Topo de Funil (TOF)' },
    { value: 'MOF', label: 'Meio de Funil (MOF)' },
    { value: 'BOF', label: 'Fundo de Funil (BOF)' },
  ],
  geos: [
    { value: 'BR', label: 'Brasil' },
    { value: 'WW', label: 'Worldwide' },
    { value: 'US', label: 'USA' },
    { value: 'PT', label: 'Portugal' },
  ],
  budgets: [
    { value: 'DIA', label: 'Diário' },
    { value: 'TOTAL', label: 'Total' },
  ],
  campaignTypes: [
    { value: 'CBO', label: 'CBO (Campaign Budget)' },
    { value: 'ABO', label: 'ABO (Adset Budget)' },
  ],
  objectives: [
    { value: 'CONVERSION', label: 'Conversão' },
    { value: 'LEAD', label: 'Lead' },
    { value: 'TRAFFIC', label: 'Tráfego' },
    { value: 'VIDEO_VIEW', label: 'Video View' },
  ],
  audienceTypes: [
    { value: 'interest', label: 'Interesse' },
    { value: 'lookalike', label: 'Lookalike' },
    { value: 'custom', label: 'Retargeting' },
    { value: 'broad', label: 'Aberto (Broad)' },
  ],
  creativeFormats: [
    { value: 'VIDEO', label: 'Vídeo' },
    { value: 'IMAGE', label: 'Imagem' },
    { value: 'CARR', label: 'Carrossel' },
  ],
  placements: [
    { value: 'FEED', label: 'Feed' },
    { value: 'STORIES', label: 'Stories' },
    { value: 'REELS', label: 'Reels' },
    { value: 'SEARCH', label: 'Search' },
    { value: 'ADVANTAGE', label: 'Advantage+' },
  ]
};

const PLATFORM_MACROS: Record<Platform, any> = {
  meta: {
    platform: '{{site_source_name}}',
    placement: '{{placement}}',
    ad_id: '{{ad.id}}',
    adset_id: '{{adset.id}}',
    campaign_id: '{{campaign.id}}',
    utm_id: '{{campaign.id}}'
  },
  google: {
    platform: 'google_ads',
    placement: '{placement}',
    ad_id: '{adgroupid}',
    adset_id: '{adgroupid}',
    campaign_id: '{campaignid}',
    utm_id: '{campaignid}'
  },
  tiktok: {
    platform: 'tiktok',
    placement: '__PLACEMENT__',
    ad_id: '__AD_ID__',
    adset_id: '__AID__',
    campaign_id: '__CID__',
    utm_id: '__CID__'
  },
  linkedin: {
    platform: 'linkedin',
    placement: 'feed',
    ad_id: 'ad_id',
    adset_id: 'adset_id',
    campaign_id: 'campaign_id',
    utm_id: 'campaign_id'
  },
  kwai: {
    platform: 'kwai',
    placement: 'feed',
    ad_id: '__AID__',
    adset_id: '__AID__',
    campaign_id: '__CID__',
    utm_id: '__CID__'
  }
};

export default function UtmGenerator() {
  const { toast } = useToast();
  const currentMonthIdx = new Date().getMonth();
  
  // Wizard State
  const [baseUrl, setBaseUrl] = useState("");
  const [config, setConfig] = useState({
    platform: 'meta' as Platform,
    month: MONTHS[currentMonthIdx],
    sequence: '001',
    phase: 'PERF',
    funnel: 'TOF',
    geo: 'BR',
    budget: 'DIA',
    type: 'CBO',
    objective: 'CONVERSION',
    offer: 'CREME',
    audienceType: 'interest',
    audienceDescriptor: 'snowboard',
    creativeFormat: 'VIDEO',
    creativePlacement: 'FEED',
    hook: 'PROVA_SOCIAL',
    variation: 'V1',
    conversionType: 'purchase'
  });

  const [copied, setCopied] = useState(false);

  const naming = useMemo(() => {
    const campaign = `${config.month}_${config.sequence}_${config.phase}_${config.objective}_${config.funnel}_${config.geo}_${config.offer}_${config.budget}_${config.type}`;
    const term = `${config.audienceType}_${config.creativePlacement}_${config.audienceDescriptor}`;
    const content = `${config.creativeFormat}_${config.hook}_${config.variation}`;
    return { 
      campaign: campaign.toUpperCase(), 
      term: term.toUpperCase(), 
      content: content.toUpperCase() 
    };
  }, [config]);

  const builds = useMemo(() => {
    const macros = PLATFORM_MACROS[config.platform];
    const sp = new URLSearchParams();
    
    // Core parameters
    sp.set('utm_source', config.platform);
    sp.set('utm_medium', 'paid_social');
    sp.set('utm_campaign', naming.campaign);
    sp.set('utm_content', naming.content);
    sp.set('utm_term', naming.term);
    
    // Performance parameters (Macros)
    sp.set('utm_id', macros.utm_id);
    sp.set('utm_platform', macros.platform);
    sp.set('placement', macros.placement);
    sp.set('creative_format', config.creativeFormat.toLowerCase());
    sp.set('conversion_type', config.conversionType);
    sp.set('ad_id', macros.ad_id);
    sp.set('adset_id', macros.adset_id);
    sp.set('campaign_id', macros.campaign_id);

    // Template with macros
    const templatePath = decodeURIComponent(sp.toString());

    // Realistic Example
    const spEx = new URLSearchParams(sp.toString());
    spEx.set('utm_id', 'cmp_2026_14987');
    spEx.set('utm_platform', config.platform === 'meta' ? 'instagram' : config.platform);
    spEx.set('placement', config.creativePlacement.toLowerCase());
    spEx.set('ad_id', '23851234567892');
    spEx.set('adset_id', '23851234567891');
    spEx.set('campaign_id', '23851234567890');

    const examplePath = decodeURIComponent(spEx.toString());

    return { 
      template: templatePath, 
      example: examplePath 
    };
  }, [config, naming]);

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Link Copiado!", description: "Link enviado para sua área de transferência." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Wand2 className="h-8 w-8 text-primary" />
          Nexus UTM Wizard
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Configuração profissional de rastreamento e nomenclatura para escala de anúncios.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column: Form Sections */}
        <div className="xl:col-span-8 space-y-6">
          
          {/* Section 1: Campaign Configuration */}
          <Card className="border-primary/10 bg-primary/2 shadow-glow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">PASSO 1</Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Configuração da Campanha
              </CardTitle>
              <CardDescription>Defina os parâmetros base da sua estrutura de anúncios.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Platform */}
                <div className="space-y-2 md:col-span-3">
                  <Label>Plataforma</Label>
                  <Select value={config.platform} onValueChange={(v) => setConfig({...config, platform: v as Platform})}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPTIONS.platforms.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          <div className="flex items-center gap-2">
                            <p.icon className={cn("h-4 w-4", p.color)} />
                            {p.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mês & Sequência */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mês</Label>
                    <Select value={config.month} onValueChange={(v) => setConfig({...config, month: v})}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sequência</Label>
                    <Input value={config.sequence} onChange={(e) => setConfig({...config, sequence: e.target.value})} className="bg-background" />
                  </div>
                </div>

                {/* Fase & Funil */}
                <div className="space-y-2">
                  <Label>Fase</Label>
                  <Select value={config.phase} onValueChange={(v) => setConfig({...config, phase: v})}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPTIONS.phases.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Funil</Label>
                  <Select value={config.funnel} onValueChange={(v) => setConfig({...config, funnel: v})}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPTIONS.funnels.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Geo, Orçamento, Tipo */}
                <div className="space-y-2">
                  <Label>Geo</Label>
                  <Select value={config.geo} onValueChange={(v) => setConfig({...config, geo: v})}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPTIONS.geos.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Orçamento</Label>
                  <Select value={config.budget} onValueChange={(v) => setConfig({...config, budget: v})}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPTIONS.budgets.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estratégia</Label>
                  <Select value={config.type} onValueChange={(v) => setConfig({...config, type: v})}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPTIONS.campaignTypes.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Objetivo & Oferta */}
                <div className="space-y-2 md:col-span-2">
                  <Label>Objetivo</Label>
                  <Select value={config.objective} onValueChange={(v) => setConfig({...config, objective: v})}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPTIONS.objectives.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Oferta/Produto</Label>
                  <Input value={config.offer} onChange={(e) => setConfig({...config, offer: e.target.value.toUpperCase()})} className="bg-background" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Section 2: Audience */}
            <Card className="border-border/50 bg-background/40 relative">
              <div className="absolute top-0 right-0 p-4">
                <Badge variant="outline" className="text-[10px]">PASSO 2</Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary/60" />
                  Público (Audiência)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Audiência</Label>
                  <Select value={config.audienceType} onValueChange={(v) => setConfig({...config, audienceType: v})}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPTIONS.audienceTypes.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descritor</Label>
                  <Input 
                    value={config.audienceDescriptor} 
                    onChange={(e) => setConfig({...config, audienceDescriptor: e.target.value})} 
                    placeholder="snowboard, buyers_180d" 
                    className="bg-background"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Creative */}
            <Card className="border-border/50 bg-background/40 relative">
              <div className="absolute top-0 right-0 p-4">
                <Badge variant="outline" className="text-[10px]">PASSO 3</Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500/60" />
                  Criativo (Anúncio)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Formato</Label>
                    <Select value={config.creativeFormat} onValueChange={(v) => setConfig({...config, creativeFormat: v})}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPTIONS.creativeFormats.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Posicionamento</Label>
                    <Select value={config.creativePlacement} onValueChange={(v) => setConfig({...config, creativePlacement: v})}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPTIONS.placements.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hook/Gancho</Label>
                    <Input value={config.hook} onChange={(e) => setConfig({...config, hook: e.target.value})} placeholder="prova_social" className="bg-background text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label>Variação</Label>
                    <Input value={config.variation} onChange={(e) => setConfig({...config, variation: e.target.value})} placeholder="V1" className="bg-background text-xs" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column: Output & Insights */}
        <div className="xl:col-span-4 space-y-6">
          <Card className="border-primary/20 shadow-glow-md bg-gradient-to-b from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-3">
                <Globe className="h-6 w-6 text-primary" />
                Resultado Final
              </CardTitle>
              <CardDescription>Copie as UTMs geradas para o seu gerenciador.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Naming Preview */}
              <div className="space-y-4">
                <div className="p-4 bg-background/50 rounded-xl border border-border shadow-inner space-y-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome da Campanha</p>
                    <p className="font-mono text-xs font-bold text-foreground break-all">{naming.campaign}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome do Conjunto</p>
                    <p className="font-mono text-xs font-bold text-primary break-all">{naming.term}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome do Anúncio</p>
                    <p className="font-mono text-xs font-bold text-foreground break-all">{naming.content}</p>
                  </div>
                </div>
              </div>

              {/* URL Tabs */}
              <Tabs defaultValue="macros" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                  <TabsTrigger value="macros" className="text-xs flex gap-1.5"><Code className="h-3.5 w-3.5" /> Template Macros</TabsTrigger>
                  <TabsTrigger value="example" className="text-xs flex gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Exemplo Real</TabsTrigger>
                </TabsList>
                
                <TabsContent value="macros" className="space-y-4 pt-4">
                  <div className="p-4 bg-background border border-border rounded-xl font-mono text-[10px] leading-relaxed text-muted-foreground break-all min-h-[120px]">
                    {builds.template}
                  </div>
                  <Button 
                    className="w-full h-11 shadow-glow-sm" 
                    onClick={() => handleCopy(builds.template)}
                  >
                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? "Copiado!" : "Copiar Sufixo (Parametros)"}
                  </Button>
                </TabsContent>

                <TabsContent value="example" className="space-y-4 pt-4">
                  <div className="p-4 bg-background border border-border rounded-xl font-mono text-[10px] leading-relaxed text-primary/70 break-all min-h-[120px]">
                    {builds.example}
                  </div>
                  <Button 
                    variant="outline"
                    className="w-full h-11" 
                    onClick={() => handleCopy(builds.example)}
                  >
                    Copiar Exemplo Sufixo
                  </Button>
                </TabsContent>
              </Tabs>

              {/* Insights */}
              <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
                  <Info className="h-4 w-4" />
                  Dica Nexus
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  O padrão <strong>{naming.campaign.split('_')[2]}</strong> (Fase) ajuda o Nexus a comparar automaticamente o custo de aquisição entre campanhas de Teste e Escala.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
