# KV Config — Guia de operação

## O que é o KV

O Cloudflare KV (`SITE_CONFIG_KV`) é o armazenamento de configuração multi-tenant do worker.
Cada projeto tem uma entrada com a chave `site_config:<pixel_id>` contendo um JSON com tokens,
pixel IDs e demais configurações de plataforma.

O worker lê esse JSON a cada requisição para saber para onde enviar os eventos CAPI.
**Se o KV estiver vazio ou desatualizado, nenhum evento chega às plataformas.**

---

## Estrutura da config

```json
{
  "pixel_id": "<project-uuid>",
  "nexus": {
    "pixel_id": "<project-uuid>",
    "ingest_url": "https://app.nexusroas.com.br/api/ingest/event",
    "ingest_key": "<ingest-key>"
  },
  "platforms": {
    "meta": {
      "pixel_id": "1234567890",
      "access_token": "EAAU...",
      "test_event_code": "TEST12345",   // opcional — só para testes no Events Manager
      "pixel_ids_mirror": []            // opcional — pixels adicionais
    },
    "tiktok": {
      "pixel_id": "ABC123",
      "access_token": "abc123...",
      "test_event_code": "TEST13357"    // opcional — só para testes no TikTok
    },
    "ga4": {
      "measurement_id": "G-XXXXXXXX",
      "api_secret": "xxxxxxxx"
    },
    "google_ads": {
      "conversion_id": "AW-123456789",
      "conversion_label_contact": "xxxxx",
      "conversion_label_lead": "xxxxx",
      "channel": "server"              // "server" | "browser"
    }
  },
  "debug": false
}
```

---

## Quando atualizar o KV

| Situação | Ação |
|----------|------|
| Criou ou editou um projeto no painel | O backend faz isso automaticamente via `_syncKV` |
| Adicionou/trocou pixel ID ou token | Atualizar manualmente (ou editar o projeto no painel) |
| Ativou test_event_code para debug | Atualizar manualmente |
| CAPI parou de funcionar sem motivo aparente | Verificar se o KV ainda tem a config (`kv key get`) |
| Trocou a imagem Docker do backend por uma versão antiga | Verificar se `_syncKV` existe naquela versão |

---

## Por que atualizar manualmente às vezes

O backend (NestJS) grava no KV automaticamente em `projects.service.ts → _syncKV` toda vez
que um projeto é criado ou editado. Mas o KV pode ficar desatualizado se:

- A imagem Docker em produção for antiga (anterior à implementação do `_syncKV`)
- A sincronização falhar silenciosamente (sem retry)
- Você inserir dados diretamente no banco sem passar pela API

---

## Como ler o KV atual

```bash
npx wrangler kv key get "site_config:<pixel_id>" \
  --namespace-id fc8ca3f6edfd4435b578c206edb1f715 \
  --text
```

---

## Como atualizar o KV (Windows PowerShell)

**Passo 1 — salvar o JSON em arquivo:**

```powershell
$json = '{ ... cole o JSON completo aqui ... }'
$json | Out-File -FilePath "$env:TEMP\kv-config.json" -Encoding utf8 -NoNewline
```

> Sempre use `Out-File` com `-NoNewline`. O PowerShell adiciona BOM/newline se você usar
> `Set-Content` ou redirecionamento `>`, o que corrompe o JSON.

**Passo 2 — enviar para o KV:**

```bash
npx wrangler kv key put "site_config:<pixel_id>" \
  --path "$env:TEMP\kv-config.json" \
  --namespace-id fc8ca3f6edfd4435b578c206edb1f715
```

> **Nunca passe o JSON diretamente como argumento no PowerShell** — ele remove as aspas duplas
> de dentro da string, gravando JSON inválido sem erros visíveis.

---

## Como atualizar o KV (Linux / Mac / bash)

```bash
cat > /tmp/kv-config.json << 'EOF'
{ ... cole o JSON completo aqui ... }
EOF

npx wrangler kv key put "site_config:<pixel_id>" \
  --path /tmp/kv-config.json \
  --namespace-id fc8ca3f6edfd4435b578c206edb1f715
```

---

## Como deletar uma entrada

```bash
npx wrangler kv key delete "site_config:<pixel_id>" \
  --namespace-id fc8ca3f6edfd4435b578c206edb1f715
```

---

## Diagnóstico rápido via /debug

Após qualquer mudança no KV, confirme que o worker carregou corretamente:

```
GET https://nexus-worker.nexusroas.workers.dev/debug?site_id=<pixel_id>&token=<debug_token>
```

Campos críticos a verificar:
- `kv_has_config: true` — a chave existe no KV
- `config_loaded.has_meta: true` — pixel ID do Meta presente
- `config_loaded.meta_has_token: true` — access token presente
- Idem para `has_tiktok`, `has_ga4`

---

## Variáveis de ambiente relacionadas

| Var | Onde definir | Uso |
|-----|-------------|-----|
| `SITE_CONFIG_KV` | wrangler.toml (binding) | Namespace do KV |
| `CF_ACCOUNT_ID` | `.env` do backend | Para o backend gravar no KV |
| `CF_KV_NAMESPACE_ID` | `.env` do backend | `fc8ca3f6edfd4435b578c206edb1f715` |
| `CF_API_TOKEN` | `.env` do backend | Token com permissão KV:Write |
| `DEBUG_TOKEN` | `wrangler secret put` | Protege `/debug` e `/logs` |
