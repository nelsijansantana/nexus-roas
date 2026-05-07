# Deploy Guide

## Ambientes

| | Produção | Staging |
|---|---|---|
| **URL** | `app.<seu-domínio>` | `app.<seu-domínio-staging>` |
| **Worker** | `nexus-worker.<account>.workers.dev` | `nexus-worker-staging.<account>.workers.dev` |
| **D1** | `nexus-db` | `nexus-db-staging` |
| **KV** | (ver Cloudflare dashboard) | (ver Cloudflare dashboard) |
| **Stack Docker** | `nexus-prod` | `nexus-staging` |
| **Tag de imagem** | `1.0.x` | `staging` |

---

## Quando usar cada ambiente

**Use staging quando:**
- Qualquer mudança no backend (NestJS) ou frontend antes de ir a produção
- Testar novos gateways de pagamento
- Testar integração CartPanda/Shopify end-to-end
- Validar migrations de banco de dados
- Qualquer dúvida — staging primeiro, produção depois

**Vá direto para produção apenas quando:**
- Mudança exclusiva no Worker (edge — sem backend/frontend)
- Hotfix urgente já validado em staging
- Atualização de segredos/tokens no KV

---

## Worker (Cloudflare)

### Staging
```bash
cd nexus-worker
npm run deploy -- --env staging
```

### Produção
```bash
cd nexus-worker
npm run deploy
```

### Migrations D1

```bash
# Staging
wrangler d1 migrations apply nexus-db-staging --remote --env staging

# Produção
wrangler d1 migrations apply nexus-db --remote
```

### Secrets do Worker

```bash
# Staging
wrangler secret put DEBUG_TOKEN --env staging

# Produção
wrangler secret put DEBUG_TOKEN
```

---

## Backend + Frontend (Docker Swarm)

### Buildar e publicar imagens

```powershell
# Staging
.\publish.ps1 -Version staging

# Produção — bumpar a versão
.\publish.ps1 -Version 1.0.0
```

### Deploy staging
```bash
docker stack deploy -c docker-compose.staging.yml nexus-staging
```

### Deploy produção
```bash
# 1. Atualizar a tag da imagem no docker-compose.prod.yml
# 2. Deploy
docker stack deploy -c docker-compose.prod.yml nexus-prod
```

### Atualizar apenas o backend sem recriar tudo

```bash
# Staging
docker service update --image ghcr.io/nelsijansantana/nexus-server:staging nexus-staging_backend-staging

# Produção
docker service update --image ghcr.io/<owner>/nexus-server:1.0.0 nexus-prod_backend
```

### Ver logs

```bash
docker service logs -f nexus-staging_backend-staging
docker service logs -f nexus-prod_backend
```

---

## Fluxo completo de uma mudança

```
1. Alterar código localmente
2. npm run deploy -- --env staging       # worker
   + docker build/push :staging          # backend/frontend se necessário
   + docker stack deploy staging         # idem
3. Testar no domínio de staging
4. Se OK → npm run deploy               # worker prod
            docker build/push :1.0.x    # backend/frontend prod
            docker stack deploy prod
```

---

## KV Config — ler/atualizar projeto manualmente

O backend sincroniza o KV automaticamente ao salvar um projeto no painel.
Para operações manuais via curl:

```bash
# Ler config de um projeto
curl "https://api.cloudflare.com/client/v4/accounts/<CF_ACCOUNT_ID>/storage/kv/namespaces/<KV_ID>/values/site_config:<PIXEL_ID>" \
  -H "Authorization: Bearer <CF_API_TOKEN>"

# Escrever config
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/<CF_ACCOUNT_ID>/storage/kv/namespaces/<KV_ID>/values/site_config:<PIXEL_ID>" \
  -H "Authorization: Bearer <CF_API_TOKEN>" \
  -H "Content-Type: text/plain" \
  -d '{ ...json... }'
```
