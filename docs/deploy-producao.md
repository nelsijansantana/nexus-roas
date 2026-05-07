# Deploy em Produção

---

# Para o cliente

O cliente roda um único comando no servidor dele e o sistema sobe completo, direto em produção:

```bash
curl -sSL https://github.com/nelsijansantana/nexus-roas/releases/latest/download/bootstrap.sh | sudo bash
```

O script baixa o pacote da versão mais recente e executa o instalador automaticamente. Não existe staging para o cliente — vai direto para produção.

### Requisitos do servidor

| | Recomendado | Mínimo |
|---|---|---|
| **OS** | Ubuntu 22.04 LTS | Ubuntu 20.04 LTS |
| **CPU** | 2 vCPU | 2 vCPU |
| **RAM** | 4 GB | 2 GB |
| **Disco** | 40 GB SSD | 20 GB SSD |

> Testado em Ubuntu 22.04. Outras distribuições Linux podem funcionar, mas não são oficialmente suportadas.

---

# Para você (desenvolvedor)

## Visão geral

O projeto tem duas partes independentes para subir:

```
┌─────────────────────────┐     ┌──────────────────────────────────┐
│   Cloudflare Worker     │     │        Servidor (Docker)         │
│   (rastreamento edge)   │     │  backend + frontend + bancos     │
│                         │     │                                  │
│   make worker           │     │  .\publish.ps1 → make deploy     │
└─────────────────────────┘     └──────────────────────────────────┘
```

---

## Lançar uma nova versão (fluxo completo)

```
1. Desenvolver e testar localmente
2. git push origin main
3. .\publish.ps1 -Version staging    → build e push imagem staging
4. make deploy-staging               → sobe no servidor de staging
5. Validar em app.hackertracker.com.br
6. git tag v2.0.x && git push origin v2.0.x
```

O GitHub Actions faz o resto automaticamente ao detectar a tag:
- Build das imagens e push para GHCR com a versão `2.0.x`
- Empacota o instalador e publica a release no GitHub
- Deploy no seu servidor de produção via SSH

---

## Atualizar só o Worker (sem mexer no backend/frontend)

```bash
# Staging
make worker-staging

# Produção
make worker
```

Se tiver migrations no D1:
```bash
cd worker
wrangler d1 migrations apply nexus-db --remote
```

---

## Referência rápida

```bash
make status                    # saúde de todos os serviços
make logs                      # logs do backend em tempo real
make logs-frontend             # logs do frontend
make update VERSION=2.0.6      # atualiza só as imagens (rolling update)
make rollback                  # reverte o último deploy do backend
make shell-backend             # abre shell dentro do container
```
