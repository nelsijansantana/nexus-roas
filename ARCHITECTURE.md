# Nexus ROAS — Arquitetura do Sistema

> Documento vivo. Atualizar sempre que houver mudança estrutural.
> Data de referência: Abril/2026

---

## Visão Geral

O Nexus ROAS é um SaaS **multi-tenant** de rastreamento e atribuição de receita.
A arquitetura é dividida em duas camadas distintas com responsabilidades bem definidas:

```
┌─────────────────────────────────────────────────────────┐
│                  LOJA DO CLIENTE                        │
│  pixel.js (browser) + shopify-checkout.js (sandbox)    │
└────────────────────┬────────────────────────────────────┘
                     │ eventos browser + webhooks gateway
                     ▼
┌─────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKER  (edge, global)          │
│  Coleta · CAPI dispatch · Dedup · Identity store (D1)  │
└────────────────────┬────────────────────────────────────┘
                     │ forwardToNexus (fire-and-forget)
                     ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND NESTJS  (VPS/cloud)                │
│  Dashboard · Auth · Billing · Analytics (ClickHouse)   │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Cloudflare Worker — O que fica aqui

### Responsabilidade
**Caminho quente** — tudo que acontece em tempo real, no edge, por dentro do funil de vendas do cliente.

### O que o Worker faz

| Rota | Descrição |
|------|-----------|
| `GET /tracking/pixel.js` | Serve o script do cliente com configuração injetada |
| `GET /tracking/shopify-checkout.js` | Serve o pixel para Shopify Customer Events |
| `GET /scripts/ga.js` | Proxy do GA4 (bypassa ad-blockers) |
| `POST /g/collect` | Proxy de coleta GA4 |
| `POST /collect/event` | Recebe eventos do browser (pixel.js) |
| `POST /collect/webhook/:gateway` | Recebe webhooks dos gateways de pagamento |

### Lógica crítica que vive no Worker

- **Coleta de eventos browser** — PageView, ViewContent, Lead, AddToCart, Purchase
- **Identificação do usuário** — `nx_user` cookie (UUID persistente), salvo no D1
- **Identity store (D1)** — `user_store`: armazena fbp, fbc, ttp, UTMs, ip, ua, cart_token por `nx_user`
- **FDV Merge** — funde dados do browser (D1) com dados do webhook (gateway) antes do CAPI
- **Dispatch CAPI** — Meta, TikTok, GA4 MP, direto do edge sem passar pelo backend
- **Deduplicação de webhooks** — `INSERT OR IGNORE` em `webhook_raw` (UNIQUE por site+gateway+order_id)
- **Tier-3 attribution** — fallback por `cart_token` quando `nx_user` não está no webhook
- **PII normalization + SHA-256** — phone→E.164, state→2-char, country→2-char
- **Cron diário** — limpeza de dados antigos (D1 retention)

### Tecnologias do Worker

| Tecnologia | Uso | Substituível? |
|-----------|-----|---------------|
| **Cloudflare Workers** | Runtime edge | Não — é o coração do sistema |
| **D1 (SQLite)** | Identity store (`user_store`, `events`, `webhook_raw`) | Sim, mas não precisa |
| **KV (Cloudflare)** | Config dos clientes (ver seção multi-tenant) | Ver seção abaixo |
| **Wrangler** | Deploy / CLI | Não |

> **Redis, RabbitMQ, ClickHouse** → **Não existem no Worker.** Zero dependências externas.

---

## 2. Backend NestJS — O que fica aqui

### Responsabilidade
**Caminho frio** — gestão, autenticação, analytics e billing. Nunca no caminho crítico de conversão.

### Módulos ativos

| Módulo | Responsabilidade |
|--------|-----------------|
| `AuthModule` | JWT, login, registro, refresh token |
| `UsersModule` | CRUD de usuários, perfil |
| `ProjectsModule` | CRUD de projetos, geração de `pixel_id`, `ingest_api_key`, `workerUrl` |
| `TeamsModule` | Multi-usuário por conta (owner, admin, analyst, viewer) |
| `BillingModule` | Planos, limites, integração Stripe/pagamento |
| `AnalyticsModule` | Queries ClickHouse para dashboard (com cache Redis) |
| `IngestModule` | Recebe eventos do Worker via HTTP e grava no ClickHouse |
| `PixelEventsModule` | Debug de eventos por projeto |
| `AdminModule` | Painel interno |
| `ClickHouseModule` | Conexão com ClickHouse (analytics) |
| `RedisModule` | Cache L2 para queries analíticas (AnalyticsService) |
| `PrismaModule` | MySQL/PostgreSQL — dados transacionais |

### Módulos REMOVIDOS (não reinstalar)

| Módulo removido | Motivo |
|----------------|--------|
| `WebhooksModule` (cartpanda/shopify/ticto) | Responsabilidade movida para o Worker |
| `TrackerModule` | CAPI dispatch movido para o Worker |
| `QueueModule` (capi-queue, lead-cache) | RabbitMQ + fila desnecessários — Worker usa `ctx.waitUntil` |
| `platforms/meta`, `platforms/tiktok` | Movido para Worker |
| `RabbitModule` | Removido junto com QueueModule |

---

## 3. Redis — Usar ou não?

### Resposta: **Sim, mas apenas no Backend**

| Onde | Status | Por quê |
|------|--------|---------|
| **Worker** | ❌ Não usar | Workers têm KV nativo. Redis externo aumenta latência ~20-50ms sem motivo |
| **Backend** | ✅ Manter | Cache L2 para queries ClickHouse (30-60 min TTL), distributed lock entre réplicas |

### O que o Redis faz hoje (backend)
```
AnalyticsService (analytics.service.ts)
  └── L1 cache: in-process Map (por réplica)
  └── L2 cache: Redis (compartilhado entre réplicas)
       ├── Chave: analytics:dashboard:<pixel_ids>:<start>:<end>
       ├── TTL: 30 min (fresh) / 60 min (stale-while-revalidate)
       └── Distributed lock: SET NX EX 10 (evita thundering herd)
```

**Redis é opcional** — o código tem fallback gracioso se Redis estiver indisponível:
```typescript
if (this.redis.available) { ... }  // Degradação elegante → só L1 cache
```

### Recomendação
- **Produção com múltiplas réplicas**: Redis é essencial (evita N réplicas bombardeando ClickHouse simultaneamente)
- **Produção com 1 réplica**: Redis é opcional (L1 in-process é suficiente)
- **Redis Cloud** ou **Upstash** funcionam bem — não precisa ser auto-hospedado

---

## 4. ClickHouse — Usar ou não?

### Resposta: **Sim, mantido no Backend**

ClickHouse é o **banco analítico** — armazena todos os eventos para o dashboard de ROAS.

```
Worker → forwardToNexus() → Backend /api/ingest/event → ClickHouse
                            (fire-and-forget, não bloqueia resposta)
```

### Tabelas principais

| Tabela | Conteúdo |
|--------|----------|
| `events` | Todos os eventos (PageView, Lead, Purchase, ...) |
| `leads` | Perfil do usuário (UTMs, ip, ua — sem PII crítica) |
| `events_daily_revenue` | Materialized view — revenue por dia/pixel |
| `events_daily_payment` | Materialized view — revenue por gateway |

### Por que ClickHouse e não Postgres?
- Queries analíticas sobre milhões de eventos em < 100ms
- Materialized views agregam automaticamente (dashboard lê O(dias), não O(eventos))
- Postgres seria O(N) em `SELECT SUM(value) WHERE pixel_id IN (...)` com 10M+ linhas

---

## 5. RabbitMQ — Usar ou não?

### Resposta: **Não — removido definitivamente**

**Antes**: `Queue → RabbitMQ → Worker (consumer) → CAPI dispatch`
**Agora**: `Worker → ctx.waitUntil(async () => { Promise.allSettled([CAPI calls]) })`

`ctx.waitUntil()` é o RabbitMQ do Cloudflare Workers:
- Executa async após retornar resposta ao cliente
- Garantido pelo runtime (não perde jobs)
- Zero latência adicional, zero infraestrutura extra
- Limite: deve completar em 30s (mais que suficiente para CAPI)

> **Não há nenhum caso de uso atual que justifique reintroduzir RabbitMQ.**

---

## 6. Multi-tenancy — Como funciona

### O modelo: Um Worker para todos os clientes

Não existe um Worker por cliente. Há **um único Worker deployado** que serve todos os clientes. O isolamento é feito pelo `site_id` (= `pixel_id` do projeto).

```
Cliente A: pixel.js?pid=aaaaa-111  →  Worker detecta site_id=aaaaa-111  →  carrega config A
Cliente B: pixel.js?pid=bbbbb-222  →  Worker detecta site_id=bbbbb-222  →  carrega config B
```

### Como o `site_id` é detectado (detectSiteId)

```typescript
// Prioridade:
// 1. ?site_id=xxx  (query param explícito)
// 2. ?pid=xxx      (alias curto para pixel_id)
// 3. Host header   (se cliente tiver domínio próprio via CNAME)
```

### Onde a config de cada cliente é armazenada

**Situação atual**: `SITE_CONFIG` é uma var estática no `wrangler.toml` — funciona para deploy single-tenant, mas para multi-tenant precisa ser migrado para **KV**.

**Situação alvo (multi-tenant escalável)**:

```
Cloudflare KV  →  chave: site_config:<pixel_id>  →  valor: JSON (SiteConfig)
```

Quando um cliente cria/atualiza um projeto no backend:
```
Backend ProjectsService.update()
  └── PUT /api/projects/:id
       └── Atualiza MySQL (Prisma)
       └── Escreve no KV da Cloudflare via API REST
            chave: site_config:<pixel_id>
            valor: { platforms: {...}, nexus: {...}, ... }
```

No Worker, `getConfig()` passa a ler do KV:
```typescript
// Hoje (static var):
const config = JSON.parse(env.SITE_CONFIG);

// Multi-tenant com KV:
const raw = await env.SITE_CONFIG_KV.get(`site_config:${siteId}`);
const config = raw ? JSON.parse(raw) : {};
```

> **Ação necessária**: Migrar `getConfig()` para ler do KV. O KV tem latência ~1ms (edge cache), ideal para leitura por request.

---

## 7. Domínios dos Clientes — Como funciona

### Cenário 1: URL padrão do Worker (sem domínio próprio)

O cliente usa o domínio do Worker diretamente:

```html
<!-- Instalação no site do cliente -->
<script src="https://worker.nexus-roas.com/tracking/pixel.js?pid=PIXEL_ID"></script>

<!-- Webhook no gateway -->
POST https://worker.nexus-roas.com/collect/webhook/cartpanda
```

**Vantagem**: Zero configuração de DNS pelo cliente.

---

### Cenário 2: Domínio próprio do cliente (white-label / bypass ad-blocker)

O cliente quer servir o pixel do próprio domínio para evitar ad-blockers:

```
tracker.lojadocliente.com  →  CNAME  →  nexus-worker.nexus-roas.workers.dev
```

**Como configurar (no painel Cloudflare do Nexus ROAS):**

1. Cliente informa o domínio desejado: `tracker.lojadocliente.com`
2. Backend gera instruções de CNAME:
   - `tracker.lojadocliente.com CNAME nexus-worker.nexus-roas.workers.dev`
3. Cliente adiciona o CNAME no DNS da loja
4. No Worker, `detectSiteId()` lê o `host` header → retorna `tracker.lojadocliente.com`
5. **O `pixel_id` precisa ser mapeado ao domínio no KV**:
   ```
   KV chave: domain_map:tracker.lojadocliente.com  →  valor: PIXEL_ID
   ```

> **Importante**: O cliente **não precisa ter conta na Cloudflare**. Ele só adiciona um CNAME no DNS dele (Cloudflare, GoDaddy, Registro.br — qualquer um). O Worker é seu.

---

### Cenário 3: Custom domain via Cloudflare Routes (recomendado para SaaS)

Você adiciona o domínio dos clientes como **Custom Domain** no Worker, via Cloudflare API:

```
POST https://api.cloudflare.com/client/v4/zones/{zone_id}/workers/routes
{
  "pattern": "tracker.lojadocliente.com/*",
  "script": "nexus-worker"
}
```

Isso requer que o domínio `lojadocliente.com` esteja na **sua** conta Cloudflare (orange-clouded). Mais controle, mas mais fricção para onboarding.

**Recomendação**: Use o Cenário 1 (URL padrão) para começar. Ofereça o Cenário 2 (CNAME livre) como opção de customização sem exigir que o cliente entre na Cloudflare.

---

## 8. Fluxo Completo: Novo Cliente

```
1. Cliente se cadastra no painel Nexus ROAS
   └── Backend cria: User, Project, pixelId (UUID), ingestApiKey (UUID)
   └── Backend escreve config no Cloudflare KV:
        chave: site_config:<pixelId>
        valor: { nexus: { pixel_id, ingest_url, ingest_key }, platforms: {} }

2. Cliente instala o pixel no site
   └── <script src="https://worker.nexus-roas.com/tracking/pixel.js?pid=PIXEL_ID">
   └── Worker serve pixel.js com CFG injetado do KV

3. Cliente configura integrações (Meta, TikTok, GA4)
   └── Painel → salva tokens no banco
   └── Backend escreve no KV: platforms.meta.pixel_id, platforms.meta.access_token, ...

4. Cliente configura webhook no gateway
   └── CartPanda: POST https://worker.nexus-roas.com/collect/webhook/cartpanda
   └── Shopify:   POST https://worker.nexus-roas.com/collect/webhook/shopify
   └── (nenhuma autenticação especial necessária — isolamento por site_id)

5. Venda acontece
   └── Gateway → Worker webhook → FDV merge → CAPI dispatch (Meta/TikTok/GA4)
   └── Worker → forwardToNexus → Backend IngestModule → ClickHouse
   └── Dashboard atualiza (cache 30min)
```

---

## 9. Resumo de Decisões

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Runtime edge | Cloudflare Workers | Zero infra, edge global, <5ms |
| CAPI dispatch | No Worker (ctx.waitUntil) | Sem latência extra, sem fila |
| Identity store | D1 (SQLite Cloudflare) | Nativo, sem infra |
| Config multi-tenant | Cloudflare KV | Latência ~1ms por leitura |
| Analytics | ClickHouse no Backend | Queries analíticas em ms |
| Cache analytics | Redis no Backend | L2 cache, distributed lock |
| Filas | Removido (RabbitMQ) | ctx.waitUntil substitui |
| Worker por cliente | Não — um Worker global | Isolamento por site_id/KV |
| Domínio do cliente | CNAME → Worker | Cliente não precisa de Cloudflare |

---

## 10. Pendências Técnicas

| Item | Prioridade | Descrição |
|------|-----------|-----------|
| **KV multi-tenant** | Alta | Migrar `getConfig()` de `SITE_CONFIG` var → `KV.get(site_config:<id>)` |
| **Backend → KV sync** | Alta | `ProjectsService` deve escrever no KV ao criar/atualizar projeto |
| **Domain mapping no KV** | Média | `domain_map:<host>` → `pixel_id` para suporte a CNAME |
| **Worker download** | Média | Frontend ainda mostra "Download coming soon" em `ProjectDetail.tsx` |
| **prisma db push** | Alta | Campo `workerUrl` adicionado ao schema, aplicar em prod |
| **eduzz/perfectpay/payt parsers** | Média | Esqueletos com TODO — completar com payloads reais |
| **OPTIMIZE TABLE leads FINAL** | Baixa | ClickHouse compaction (executar fora de horário de pico) |
