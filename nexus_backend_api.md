# Nexus ROAS — Backend API Documentation

> **Base URL (Produção):** `https://app.hackertracker.com.br`  
> **Framework:** NestJS (Node.js) · **Auth:** JWT Bearer Token (7 dias)  
> **Banco de Dados:** PostgreSQL (Prisma ORM) + ClickHouse (eventos/leads)

---

## Índice

1. [Arquitetura Geral](#1-arquitetura-geral)
2. [Autenticação](#2-autenticação)
3. [Módulo Projects](#3-módulo-projects)
4. [Módulo Tracking (Pixel)](#4-módulo-tracking-pixel)
5. [Módulo Analytics](#5-módulo-analytics)
6. [Módulo Webhooks — Cartpanda](#6-módulo-webhooks--cartpanda)
7. [Integrações Externas](#7-integrações-externas)
8. [Estrutura de Dados](#8-estrutura-de-dados)
9. [Erros Padrão](#9-erros-padrão)
10. [Guia de Integração para Frontend](#10-guia-de-integração-para-frontend)

---

## 1. Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cliente (Loja / Frontend)                    │
│                  <script> pixel.js </script>                     │
└─────────────────┬───────────────────────────┬───────────────────┘
                  │ POST /tracking/v1/events   │ PUT /tracking/v1/lead
                  ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NestJS Backend (Nexus ROAS)                   │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────┐  │
│  │   Auth   │  │ Projects │  │ Analytics │  │   Webhooks    │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────────┘  │
│                              ┌─────────────────────────────────┐ │
│                              │       TrackerService            │ │
│                              │  (Lead upsert + Event insert)   │ │
│                              └──────┬────────────┬────────────┘ │
│                                     │            │              │
│                              ┌──────▼──┐  ┌──────▼──┐          │
│                              │  Meta   │  │ TikTok  │          │
│                              │  CAPI   │  │  CAPI   │          │
│                              └─────────┘  └─────────┘          │
└──────────────────┬──────────────────┬──────────────────────────┘
                   │                  │
          ┌────────▼──┐      ┌────────▼──────┐
          │ PostgreSQL │      │   ClickHouse  │
          │  (Prisma)  │      │ leads/events  │
          │ Users      │      │ (analytics)   │
          │ Projects   │      └───────────────┘
          └────────────┘
```

### Dois Bancos de Dados

| Banco | Tecnologia | Uso | ORM |
|---|---|---|---|
| **PostgreSQL** | Relacional | Usuários, Projetos (configuração SaaS) | Prisma |
| **ClickHouse** | Colunar (OLAP) | Leads e Events (tracking em tempo real) | Client HTTP direto |

### Fluxo de um Evento de Rastreamento

1. Pixel client-side dispara `POST /tracking/v1/events`
2. Backend busca o **Project** no PostgreSQL pelo `pixelId`
3. Backend faz upsert do **Lead** no ClickHouse (merge com dados anteriores)
4. Backend insere o **Event** no ClickHouse
5. Backend dispara **Meta CAPI** e **TikTok CAPI** em paralelo (fire-and-forget)
6. Backend retorna `lead` e `event` ids para o cliente fazer deduplicação browser-side

---

## 2. Autenticação

**Base Path:** `/api/v1/auth`

Todos os endpoints protegidos exigem o header:
```
Authorization: Bearer <token>
```

O token tem validade de **7 dias**. Não há refresh token — o usuário deve fazer login novamente após expirar.

---

### `POST /api/v1/auth/login`

Autentica um usuário existente.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "senha123"
}
```

**Response 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-do-usuario",
    "email": "user@example.com",
    "name": "Nome Completo"
  }
}
```

**Erros:**
- `401 Unauthorized` — Email ou senha inválidos

---

### `POST /api/v1/auth/register`

Cria uma nova conta de usuário.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "senha123",
  "name": "Nome Completo"
}
```

**Response 201:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-do-usuario",
    "email": "user@example.com",
    "name": "Nome Completo"
  }
}
```

**Erros:**
- `409 Conflict` — Email já está em uso

---

### `GET /api/v1/auth/me`

Retorna os dados do usuário autenticado.

**Headers:** `Authorization: Bearer <token>`

**Response 200:**
```json
{
  "id": "uuid-do-usuario",
  "email": "user@example.com",
  "name": "Nome Completo"
}
```

**Erros:**
- `401 Unauthorized` — Token inválido ou expirado

---

## 3. Módulo Projects

**Base Path:** `/api/v1/projects`  
**Autenticação:** Obrigatória (todos os endpoints)

Um **Project** representa um cliente/pixel. Cada projeto tem um `pixelId` único (UUID gerado automaticamente) que é usado no pixel de rastreamento e nos webhooks. Os projetos são isolados por usuário (multi-tenant).

---

### `POST /api/v1/projects`

Cria um novo projeto.

**Request Body:**
```json
{
  "name": "Rosa Selvagem",
  "domain": "rosaselvagemoficial.com.br",
  "pixelFacebookId": "1234567890",
  "tokenFacebookApi": "EAAxxxxxx...",
  "tikTokPixelId": "CTXXXXXX",
  "tokenTikTokApi": "xxxxxxx",
  "testEventCode": "TEST12345",
  "testEventCodeTikTok": "TIKTEST001"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `name` | string | ✅ | Nome do projeto/cliente |
| `domain` | string | ❌ | Domínio da loja (informativo) |
| `pixelFacebookId` | string | ❌ | ID do pixel Meta Ads |
| `tokenFacebookApi` | string | ❌ | Access Token Meta Conversions API |
| `tikTokPixelId` | string | ❌ | ID do pixel TikTok Ads |
| `tokenTikTokApi` | string | ❌ | Access Token TikTok Events API |
| `testEventCode` | string | ❌ | Código de teste Meta Events Manager |
| `testEventCodeTikTok` | string | ❌ | Código de teste TikTok Events Manager |

**Response 201:**
```json
{
  "project": {
    "id": "proj-uuid",
    "pixelId": "pixel-uuid",
    "name": "Rosa Selvagem",
    "domain": "rosaselvagemoficial.com.br",
    "isActive": true,
    "pixelFacebookId": "1234567890",
    "tikTokPixelId": "CTXXXXXX",
    "testEventCode": "TEST12345",
    "testEventCodeTikTok": "TIKTEST001",
    "hasFacebookToken": true,
    "hasTikTokToken": true,
    "createdAt": "2026-04-11T00:00:00.000Z",
    "updatedAt": "2026-04-11T00:00:00.000Z"
  },
  "installScript": "<!-- Nexus Pixel Installation --> <script>window.nxPixelId = \"pixel-uuid\";</script> <script async defer src=\"https://app.hackertracker.com.br/tracking/v1/pixel.js\"></script>",
  "checkoutScript": "// Script completo inline para Shopify Custom Pixel..."
}
```

> ⚠️ **Os tokens nunca são retornados** — apenas `hasFacebookToken: true/false` e `hasTikTokToken: true/false` para segurança.

---

### `GET /api/v1/projects`

Lista todos os projetos do usuário autenticado.

**Response 200:**
```json
[
  {
    "id": "proj-uuid",
    "pixelId": "pixel-uuid",
    "name": "Rosa Selvagem",
    "domain": "rosaselvagemoficial.com.br",
    "isActive": true,
    "pixelFacebookId": "1234567890",
    "tikTokPixelId": "CTXXXXXX",
    "testEventCode": null,
    "testEventCodeTikTok": null,
    "hasFacebookToken": true,
    "hasTikTokToken": true,
    "createdAt": "2026-04-11T00:00:00.000Z"
  }
]
```

> 💡 **Auto-claim:** Se o usuário não tiver projetos, o sistema verifica se existem projetos "órfãos" (cujo dono foi deletado) e os atribui automaticamente ao usuário.

---

### `GET /api/v1/projects/:id`

Retorna os detalhes de um projeto específico, incluindo os scripts de instalação.

**Response 200:** Mesmo formato do `POST /api/v1/projects` (com `installScript` e `checkoutScript`).

**Erros:**
- `404 Not Found` — Projeto não encontrado

---

### `PATCH /api/v1/projects/:id`

Atualiza campos de um projeto. Todos os campos são opcionais.

**Request Body:** Qualquer subset dos campos do `POST /api/v1/projects`.

```json
{
  "name": "Novo Nome",
  "pixelFacebookId": "novo-pixel-id",
  "isActive": false
}
```

**Response 200:** Mesmo formato do `POST /api/v1/projects`.

---

### `DELETE /api/v1/projects/:id`

Remove um projeto permanentemente.

**Response 200:**
```json
{
  "deleted": true,
  "id": "proj-uuid"
}
```

---

## 4. Módulo Tracking (Pixel)

**Base Path:** `/tracking/v1`  
**Autenticação:** Nenhuma (público — chamado diretamente pelos pixels)  
**CORS:** `Access-Control-Allow-Origin: *`

---

### `GET /tracking/v1/pixel.js`

Retorna o script JavaScript do pixel de rastreamento para ser carregado nas lojas.

**Uso na loja (HTML):**
```html
<script>window.nxPixelId = "SEU-PIXEL-ID";</script>
<script async defer src="https://app.hackertracker.com.br/tracking/v1/pixel.js"></script>
```

**Response:** `application/javascript` — Script compilado do pixel.  
**Cache:** 5 minutos (`Cache-Control: public, max-age=300`)

O pixel client-side:
- Coleta `fbc`, `fbp`, `ttclid`, `ttp`, UTMs e IP
- Dispara eventos via `DataLayer` (formato GA4) ou diretamente
- Faz upsert do lead e envia eventos para `/tracking/v1/events`
- Deduplica eventos com Meta Pixel e TikTok Pixel browser-side via `event_id` compartilhado

---

### `GET /tracking/v1/checkout-pixel.js?pid=PIXEL_ID`

Retorna o script de rastreamento para o **Shopify Custom Pixel** (checkout sandbox). É um script inline, não carregado via `<script src>`.

**Query Params:**
| Param | Obrigatório | Descrição |
|---|---|---|
| `pid` | ✅ | O `pixelId` do projeto |

**Uso:** Colar o conteúdo retornado diretamente no campo de Pixel Customizado do Shopify.

**Response:** `application/javascript` com `PIXEL_ID` e `API_BASE` já injetados.

---

### `POST /tracking/v1/events`

**Endpoint principal do pixel.** Recebe eventos de rastreamento do client-side.

**Request Body:**
```json
{
  "type": "ViewContent",
  "eventId": "uuid-gerado-pelo-cliente",
  "source": "web",
  "lead": {
    "pixelId": "pixel-uuid",
    "_id": "lead-uuid-se-ja-existir",
    "email": "usuario@email.com",
    "phone": "+5511999998888",
    "firstName": "João",
    "lastName": "Silva",
    "ip": "177.0.0.1",
    "userAgent": "Mozilla/5.0...",
    "fbc": "_fbc_xxxxx",
    "fbp": "_fbp_xxxxx",
    "ttclid": "AbCdEfGh",
    "ttp": "xxxxx",
    "gclid": "xxxxxx",
    "city": "São Paulo",
    "region": "SP",
    "country": "BR",
    "postal": "01310-100",
    "parameters": "utm_source=facebook&utm_medium=cpc"
  },
  "event": {
    "sourceUrl": "https://minha-loja.com/produto",
    "pageTitle": "Produto - Rosa Selvagem",
    "referrer": "https://facebook.com"
  },
  "customData": {
    "value": 97.00,
    "currency": "BRL",
    "content_type": "product",
    "content_ids": ["10870541"],
    "contents": [
      { "id": "10870541", "quantity": 1 }
    ],
    "num_items": 1
  }
}
```

**Tipos de Evento (`type`):**
| Evento | Descrição |
|---|---|
| `PageView` | Visualização de página |
| `ViewContent` | Visualização de produto |
| `AddToCart` | Adição ao carrinho |
| `InitiateCheckout` | Início do checkout |
| `Purchase` | ⚠️ **Bloqueado via web** — Apenas via Webhook |
| `Lead` | Captura de lead / formulário |
| `Search` | Busca |

> ⚠️ **`Purchase` via web é bloqueado.** Se `type = "Purchase"` e `source !== "webhook"`, o evento é rejeitado com `{ ignored: true }`. Purchases só são processados via Webhooks do gateway de pagamento.

**Response 200:**
```json
{
  "event": {
    "_id": "event-uuid"
  },
  "lead": {
    "_id": "lead-uuid",
    "pixelId": "pixel-uuid",
    "email": "usuario@email.com",
    "phone": "+5511999998888",
    "firstName": "João",
    "lastName": "Silva",
    "fbc": "_fbc_xxxxx",
    "fbp": "_fbp_xxxxx",
    "gclid": null,
    "ttclid": null,
    "ttp": null,
    "ip": "177.0.0.1",
    "ipv6": null,
    "metaPixelIds": ["1234567890"],
    "tikTokPixelIds": ["CTXXXXXX"],
    "parameters": "utm_source=facebook&utm_medium=cpc",
    "updatedAt": "2026-04-11T08:00:00.000Z"
  },
  "sendWebEvents": true
}
```

**Lógica de Lead (Upsert):**
1. Se `lead._id` fornecido → busca lead exato no ClickHouse
2. Se não encontrado → busca lead mais recente do mesmo `pixelId` nos últimos **30 minutos** (fallback para Shopify checkout)
3. Mescla dados novos com dados existentes (enriquecimento progressivo)
4. Salva no ClickHouse via INSERT (ReplacingMergeTree)

---

### `PUT /tracking/v1/lead`

Atualiza campos de um lead existente. Usado pelo pixel quando o `fbp` cookie é definido de forma assíncrona pelo `fbevents.js` do Meta.

**Request Body:**
```json
{
  "_id": "lead-uuid",
  "fbp": "_fbp_novo_valor",
  "email": "email@atualizado.com",
  "phone": "+5511000000000"
}
```

**Response 200:**
```json
{ "success": true }
```

---

## 5. Módulo Analytics

**Base Path:** `/api/v1/analytics`  
**Autenticação:** Obrigatória

---

### `GET /api/v1/analytics/dashboard`

Retorna métricas agregadas de receita e conversões do ClickHouse, com isolamento por usuário (multi-tenant).

**Query Params:**
| Param | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `projectId` | string | ❌ | Filtrar por projeto específico (valida ownership) |
| `startDate` | string | ❌ | Data de início (ISO 8601 ou `YYYY-MM-DD`) |
| `endDate` | string | ❌ | Data de fim (ISO 8601 ou `YYYY-MM-DD`) |

**Exemplos:**
```
GET /api/v1/analytics/dashboard
GET /api/v1/analytics/dashboard?startDate=2026-04-01&endDate=2026-04-11
GET /api/v1/analytics/dashboard?projectId=proj-uuid&startDate=2026-04-01
```

**Response 200:**
```json
{
  "grossRevenue": 1547.80,
  "purchaseCount": 22,
  "paymentMethods": [
    {
      "method": "pagarme-v5",
      "totalRevenue": 1200.00,
      "count": 15
    },
    {
      "method": "pix",
      "totalRevenue": 347.80,
      "count": 7
    }
  ]
}
```

| Campo | Descrição |
|---|---|
| `grossRevenue` | Receita bruta total de eventos `Purchase` |
| `purchaseCount` | Número total de `Purchase` events |
| `paymentMethods` | Breakdown por método de pagamento (extraído do campo `custom_data.payment_gateway`) |

> 📌 Os dados vêm do ClickHouse, tabela `events`, filtrando apenas `event_type = 'Purchase'`. Apenas purchases vindos de webhooks Cartpanda terão `value > 0`.

---

## 6. Módulo Webhooks — Cartpanda

**Base Path:** `/webhooks/cartpanda`  
**Autenticação:** Nenhuma (validação via `pixelId` na URL)

---

### `POST /webhooks/cartpanda/:pixelId`

Recebe notificações de pagamento da plataforma Cartpanda. Processa eventos `order.paid` como eventos `Purchase` no sistema.

**URL de configuração na Cartpanda:**
```
https://app.hackertracker.com.br/webhooks/cartpanda/SEU-PIXEL-ID
```

**Exemplo:** `https://app.hackertracker.com.br/webhooks/cartpanda/bdadc5af-4bad-4cb9-9df8-d4f8e4fd3bca`

**Payload Cartpanda (simplificado):**
```json
{
  "event": "order.paid",
  "order": {
    "id": 48458581,
    "email": "cliente@email.com",
    "phone": "+5564992556670",
    "total_price": "77.60",
    "currency": "BRL",
    "browser_ip": "138.97.3.179",
    "user_agent": "Mozilla/5.0...",
    "cart_token": "81b7d4c3-6099-4caa-a605-f10d52d7bdf6",
    "customer": {
      "first_name": "Fernanda",
      "last_name": "Alves Rufino De Sousa"
    },
    "address": {
      "city": "Pontalina",
      "province_code": "GO",
      "country_code": "BR"
    },
    "line_items": [
      {
        "product_id": 10870541,
        "quantity": 1
      }
    ],
    "transactions": [
      { "gateway": "pagarme-v5" }
    ],
    "checkout_params": {
      "src": "LEAD-UUID-DO-PIXEL"
    },
    "tracking_parameters": [
      { "parameter_name": "utm_source", "parameter_value": "ig" }
    ]
  }
}
```

**Eventos aceitos** (como sinônimos de `Purchase`):
- `order.paid` ✅ (principal)
- `order_paid`
- `paid`
- `approved`
- `order.approved`
- `purchase`

**Lógica de Lead Attribution (por prioridade):**

| Prioridade | Fonte | Campo Cartpanda |
|---|---|---|
| 1ª | `checkout_params.src` | Parâmetro `src` passado na URL de checkout |
| 2ª | `checkout_params.sck` | Parâmetro alternativo `sck` |
| 3ª | `tracking_parameters` | Array com `parameter_name = "src"` ou `"sck"` |
| 4ª | `cart_token` | UUID único do carrinho (fallback) |

**Response 200:**
```json
{ "received": true }
```

> ⚠️ O sistema sempre responde `200` para a Cartpanda, mesmo em caso de erros internos, para evitar reentregas desnecessárias.

---

## 7. Integrações Externas

### 7.1 Meta Conversions API (CAPI)

**Endpoint Meta:** `POST https://graph.facebook.com/v21.0/{PIXEL_ID}/events`

**Quando é disparado:** Todo evento processado pelo `TrackerService` se o projeto tiver `pixelFacebookId` e `tokenFacebookApi` configurados.

**User Data enviado (todos hashed em SHA-256):**
| Campo | Descrição |
|---|---|
| `em` | Email normalizado (lowercase, trim) |
| `ph` | Telefone normalizado (com código do país `55`) |
| `fn` | Primeiro nome (lowercase, sem acentos) |
| `ln` | Sobrenome (lowercase, sem acentos) |
| `ct` | Cidade (lowercase, sem acentos) |
| `st` | Estado (2 chars lowercase) |
| `country` | País (lowercase) |
| `external_id` | Lead UUID hashed |
| `client_ip_address` | IP do visitante (não hashed) |
| `client_user_agent` | User Agent (não hashed) |
| `fbc` | Facebook Click ID cookie |
| `fbp` | Facebook Browser Pixel cookie |

**Deduplicação:** O mesmo `event_id` é enviado para o Meta CAPI server-side e para o `fbq('track', evento, {}, { eventID })` client-side. O Meta usa o `event_id` para deduplicar automaticamente.

**Test Event Code:** Se o projeto tiver `testEventCode` configurado, é incluído no payload para validação no Meta Events Manager sem afetar dados reais.

---

### 7.2 TikTok Events API (CAPI)

**Quando é disparado:** Todo evento processado se o projeto tiver `tikTokPixelId` e `tokenTikTokApi` configurados.

**User Data PII (hashed em SHA-256):** email, telefone, IP, User Agent.  
**Parâmetros TikTok:** `ttclid` (TikTok Click ID) e `ttp` (TikTok cookie).

**Test Event Code:** Suportado via `testEventCodeTikTok` no projeto.

---

## 8. Estrutura de Dados

### 8.1 Tabela `leads` (ClickHouse)

Motor: **ReplacingMergeTree** com chave de ordenação por `id`. Escritas múltiplas no mesmo `id` são mescladas automaticamente, mantendo a versão mais recente.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | String | UUID do lead (chave primária) |
| `pixel_id` | String | UUID do projeto |
| `email` | String | Email (plain text, não hashed) |
| `phone` | String | Telefone |
| `first_name` | String | Primeiro nome |
| `last_name` | String | Sobrenome |
| `ip` | String | IPv4 |
| `ipv6` | String | IPv6 |
| `user_agent` | String | User Agent string |
| `fbc` | String | Facebook Click ID |
| `fbp` | String | Facebook Browser ID |
| `gclid` | String | Google Click ID |
| `gbraid` | String | Google GBRAID |
| `wbraid` | String | Google WBRAID |
| `ttclid` | String | TikTok Click ID |
| `ttp` | String | TikTok Pixel cookie |
| `parameters` | String | Query string completa (UTMs, etc.) |
| `city` | String | Cidade |
| `state` | String | Estado (ex: SP) |
| `country` | String | País (ex: BR) |
| `zipcode` | String | CEP |
| `meta_pixel_ids` | Array(String) | Pixels Meta associados |
| `tiktok_pixel_ids` | Array(String) | Pixels TikTok associados |
| `external_id` | String | Igual ao `id` (para Meta) |
| `updated_at` | UInt32 | Unix timestamp da última atualização |

### 8.2 Tabela `events` (ClickHouse)

Motor: **MergeTree** com `event_time` como chave de partição.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | String | UUID do evento (usado para deduplicação) |
| `lead_id` | String | UUID do lead relacionado |
| `pixel_id` | String | UUID do projeto |
| `event_type` | String | Tipo do evento (ex: ViewContent, Purchase) |
| `source_url` | String | URL da página onde ocorreu |
| `page_title` | String | Título da página |
| `referrer` | String | URL referenciadora |
| `ip` | String | IP do visitante |
| `user_agent` | String | User Agent |
| `fbc` | String | Facebook Click ID |
| `fbp` | String | Facebook Browser ID |
| `value` | Float64 | Valor monetário (0 para eventos sem valor) |
| `currency` | String | Moeda (ex: BRL) |
| `content_type` | String | Tipo de conteúdo (ex: product) |
| `custom_data` | String | JSON com dados customizados completos |
| `event_time` | UInt32 | Unix timestamp do evento |

### 8.3 Tabela `users` (PostgreSQL)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | Identificador único |
| `email` | String (único) | Email do usuário |
| `name` | String | Nome completo |
| `password` | String | Hash bcrypt (salt=10) |
| `createdAt` | DateTime | Data de criação |
| `updatedAt` | DateTime | Última atualização |

### 8.4 Tabela `projects` (PostgreSQL)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | Identificador único |
| `pixelId` | UUID | ID público do pixel (único) |
| `name` | String | Nome do projeto |
| `domain` | String? | Domínio da loja |
| `userId` | UUID | Dono do projeto (FK users) |
| `isActive` | Boolean | Projeto ativo/inativo |
| `pixelFacebookId` | String? | ID Pixel Meta Ads |
| `tokenFacebookApi` | String? | Token Meta CAPI (secreto) |
| `tikTokPixelId` | String? | ID Pixel TikTok |
| `tokenTikTokApi` | String? | Token TikTok CAPI (secreto) |
| `testEventCode` | String? | Código teste Meta |
| `testEventCodeTikTok` | String? | Código teste TikTok |
| `createdAt` | DateTime | Data de criação |
| `updatedAt` | DateTime | Última atualização |

---

## 9. Erros Padrão

| Status | Significado | Quando ocorre |
|---|---|---|
| `200` | OK | Sucesso |
| `201` | Created | Recurso criado com sucesso |
| `400` | Bad Request | Payload inválido / validação falhou |
| `401` | Unauthorized | Token ausente, inválido ou expirado |
| `404` | Not Found | Recurso não encontrado |
| `409` | Conflict | Conflito (ex: email duplicado) |
| `500` | Internal Server Error | Erro inesperado no servidor |

**Formato de erro:**
```json
{
  "statusCode": 401,
  "message": "Token inválido ou expirado",
  "error": "Unauthorized"
}
```

---

## 10. Guia de Integração para Frontend

### 10.1 Fluxo de Autenticação

```javascript
// 1. Login
const response = await fetch('https://app.hackertracker.com.br/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@email.com', password: 'senha' })
});
const { token, user } = await response.json();

// 2. Armazenar token (localStorage ou cookie httpOnly)
localStorage.setItem('nexus_token', token);

// 3. Usar nas requisições autenticadas
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

### 10.2 Criar e Gerenciar Projetos

```javascript
const BASE = 'https://app.hackertracker.com.br';
const token = localStorage.getItem('nexus_token');
const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

// Criar projeto
const project = await fetch(`${BASE}/api/v1/projects`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    name: 'Minha Loja',
    domain: 'minhaloja.com.br',
    pixelFacebookId: '1234567890',
    tokenFacebookApi: 'EAA...'
  })
}).then(r => r.json());

// O pixelId para usar nos webhooks e scripts:
console.log(project.project.pixelId);
// O script de instalação pronto:
console.log(project.installScript);
```

### 10.3 Dashboard de Analytics

```javascript
// Últimos 30 dias
const start = new Date();
start.setDate(start.getDate() - 30);

const metrics = await fetch(
  `${BASE}/api/v1/analytics/dashboard?startDate=${start.toISOString()}&endDate=${new Date().toISOString()}`,
  { headers }
).then(r => r.json());

// metrics.grossRevenue → número
// metrics.purchaseCount → número  
// metrics.paymentMethods → array [{ method, totalRevenue, count }]
```

### 10.4 Configurar Webhook Cartpanda

Para cada projeto, configure no painel da Cartpanda:

```
URL do Webhook: https://app.hackertracker.com.br/webhooks/cartpanda/{pixelId}
Evento: order.paid
```

O sistema irá:
1. Receber o payload da Cartpanda
2. Executar `GET /api/v1/projects` internamente para validar o projeto
3. Criar um lead (ou herdar sessão existente do pixel)
4. Disparar Purchase para Meta CAPI e TikTok CAPI
5. Salvar no ClickHouse para o Analytics Dashboard

### 10.5 Headers Comuns

```javascript
// Requisições autenticadas
{
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json'
}

// Requisições do pixel (públicas, sem auth)
{
  'Content-Type': 'application/json'
}
```

---

## Sumário de Endpoints

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | ❌ | Login |
| `POST` | `/api/v1/auth/register` | ❌ | Cadastro |
| `GET` | `/api/v1/auth/me` | ✅ | Dados do usuário |
| `POST` | `/api/v1/projects` | ✅ | Criar projeto |
| `GET` | `/api/v1/projects` | ✅ | Listar projetos |
| `GET` | `/api/v1/projects/:id` | ✅ | Buscar projeto |
| `PATCH` | `/api/v1/projects/:id` | ✅ | Atualizar projeto |
| `DELETE` | `/api/v1/projects/:id` | ✅ | Deletar projeto |
| `GET` | `/tracking/v1/pixel.js` | ❌ | Script pixel |
| `GET` | `/tracking/v1/checkout-pixel.js?pid=` | ❌ | Script checkout |
| `POST` | `/tracking/v1/events` | ❌ | Rastrear evento |
| `PUT` | `/tracking/v1/lead` | ❌ | Atualizar lead |
| `GET` | `/api/v1/analytics/dashboard` | ✅ | Métricas |
| `POST` | `/webhooks/cartpanda/:pixelId` | ❌ | Webhook Cartpanda |
