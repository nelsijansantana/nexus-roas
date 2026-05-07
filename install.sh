#!/usr/bin/env bash
# Nexus ROAS — Instalador automático
# Uso: sudo bash install.sh
set -euo pipefail

# ── Cores ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

LOG_FILE="/var/log/nexus-install.log"

# Garantir que o arquivo de log exista e seja gravável o quanto antes
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
touch "$LOG_FILE" 2>/dev/null || LOG_FILE="/tmp/nexus-install.log"

_log_raw() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE" 2>/dev/null || true; }

log()  { local msg="$*"; echo -e "${CYAN}[nexus]${NC} ${msg}"; _log_raw "INFO  ${msg}"; }
ok()   { local msg="$*"; echo -e "${GREEN}✔${NC}  ${msg}";     _log_raw "OK    ${msg}"; }
warn() { local msg="$*"; echo -e "${YELLOW}⚠${NC}  ${msg}";   _log_raw "WARN  ${msg}"; }
die()  {
  local msg="$*"
  echo -e "\n${RED}✘  ${msg}${NC}\n" >&2
  _log_raw "ERROR ${msg}"
  echo -e "${YELLOW}Log completo: ${LOG_FILE}${NC}\n" >&2
  exit 1
}
step() { local msg="[$1/7] $2"; echo -e "\n${BOLD}${CYAN}[$1/7]${NC} ${BOLD}$2${NC}"; _log_raw "STEP  ${msg}"; }

prompt() {
  local msg="$1" default="${2:-}" val
  if [[ -n "$default" ]]; then
    read -rp "$(echo -e "${YELLOW}?${NC} ${msg} [${default}]: ")" val
    echo "${val:-$default}"
  else
    read -rp "$(echo -e "${YELLOW}?${NC} ${msg}: ")" val
    while [[ -z "$val" ]]; do
      echo -e "${RED}  Campo obrigatório.${NC}"
      read -rp "$(echo -e "${YELLOW}?${NC} ${msg}: ")" val
    done
    echo "$val"
  fi
}

prompt_secret() {
  local msg="$1" val
  read -rsp "$(echo -e "${YELLOW}?${NC} ${msg}: ")" val; echo
  while [[ -z "$val" ]]; do
    echo -e "${RED}  Campo obrigatório.${NC}"
    read -rsp "$(echo -e "${YELLOW}?${NC} ${msg}: ")" val; echo
  done
  echo "$val"
}

gen_pass()   { openssl rand -hex 24; }
gen_secret() { openssl rand -hex 32; }

# ── Root check ────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die "Execute como root: sudo bash install.sh"

# ── apt non-interactive mode ──────────────────────────────────────────────────
# Prevents dpkg conffile prompts (e.g. sshd_config upgrade) from hanging the
# install on a TTY-attached SSH session. Keeps existing config files on conflict.
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
APT_OPTS=(-y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold")

# ── INSTALL_DIR — funciona com curl | bash (BASH_SOURCE pode ser /dev/stdin) ──
if [[ -n "${BASH_SOURCE[0]:-}" ]] && [[ -f "${BASH_SOURCE[0]}" ]]; then
  INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  INSTALL_DIR="/opt/nexus-roas"
fi

_log_raw "INFO  install.sh iniciado — INSTALL_DIR=${INSTALL_DIR}"

# ═════════════════════════════════════════════════════════════════════════════
# Modo não-interativo
# Se as quatro variáveis obrigatórias já estiverem no ambiente, pula todos os
# prompts. Isso é necessário para o remote_install.py e fluxos CI/CD.
# ═════════════════════════════════════════════════════════════════════════════
_NONINTERACTIVE=false
if [[ -n "${APP_DOMAIN:-}"     ]] && \
   [[ -n "${ADMIN_EMAIL:-}"    ]] && \
   [[ -n "${CF_ACCOUNT_ID:-}"  ]] && \
   [[ -n "${CF_API_TOKEN:-}"   ]]; then
  _NONINTERACTIVE=true
  _log_raw "INFO  Modo não-interativo ativado"
fi

# Gerar senhas independentemente do modo
POSTGRES_PASSWORD=$(gen_pass)
CLICKHOUSE_PASSWORD=$(gen_pass)
RABBITMQ_PASS=$(gen_pass)
JWT_SECRET=$(gen_secret)

# ── Banner ────────────────────────────────────────────────────────────────────
clear
echo -e "${BOLD}${CYAN}"
echo "  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗  ██████╗  ██████╗  █████╗ ███████╗"
echo "  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝  ██╔══██╗██╔═══██╗██╔══██╗██╔════╝"
echo "  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗  ██████╔╝██║   ██║███████║███████╗"
echo "  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║  ██╔══██╗██║   ██║██╔══██║╚════██║"
echo "  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║  ██║  ██║╚██████╔╝██║  ██║███████║"
echo "  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝"
echo -e "${NC}"
echo "  Instalador  |  Tempo estimado: 5–10 minutos"
echo ""

if [[ "$_NONINTERACTIVE" == "true" ]]; then
  echo -e "  ${CYAN}Modo não-interativo${NC} — variáveis detectadas no ambiente."
  echo ""
fi

# ═════════════════════════════════════════════════════════════════════════════
# 1 — Configuração
# ═════════════════════════════════════════════════════════════════════════════
step 1 "Configuração"

if [[ "$_NONINTERACTIVE" == "true" ]]; then
  # Variáveis obrigatórias já estão no ambiente.
  # Definir defaults para variáveis opcionais caso não fornecidas.
  LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-$ADMIN_EMAIL}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(gen_pass)}"
  GHCR_PULL_TOKEN="${GHCR_PULL_TOKEN:-}"

  log "Configuração carregada do ambiente:"
  log "  APP_DOMAIN        = ${APP_DOMAIN}"
  log "  ADMIN_EMAIL       = ${ADMIN_EMAIL}"
  log "  LETSENCRYPT_EMAIL = ${LETSENCRYPT_EMAIL}"
  log "  CF_ACCOUNT_ID     = ${CF_ACCOUNT_ID}"
  log "  GHCR_PULL_TOKEN   = ${GHCR_PULL_TOKEN:+(definido)}"
  ok "Configuração não-interativa confirmada."
else
  # ── 1. Domínio ────────────────────────────────────────────────────────────
  echo ""
  echo -e "  ${BOLD}Domínio do painel${NC}"
  echo "  O endereço onde o Nexus ROAS será acessado."
  echo "  Certifique-se de que o DNS já aponta para este servidor."
  echo "  Exemplo: app.meusite.com"
  echo ""
  APP_DOMAIN=$(prompt "Domínio")

  # ── 2. E-mail SSL ─────────────────────────────────────────────────────────
  echo ""
  echo -e "  ${BOLD}E-mail para certificado SSL${NC}"
  echo "  Usado apenas para emitir o certificado HTTPS gratuito (Let's Encrypt)."
  echo ""
  LETSENCRYPT_EMAIL=$(prompt "E-mail SSL")

  # ── 3. Administrador ──────────────────────────────────────────────────────
  echo ""
  echo -e "  ${BOLD}Conta de administrador${NC}"
  echo "  Será a conta principal de acesso ao painel."
  echo ""
  ADMIN_EMAIL=$(prompt "E-mail do administrador")
  ADMIN_PASSWORD=$(prompt_secret "Senha do administrador")

  # ── 4. Licença ────────────────────────────────────────────────────────────
  echo ""
  echo -e "  ${BOLD}Token de licença${NC}"
  echo "  Enviado por e-mail após a compra. Formato: NXS-XXXX-XXXX-XXXX"
  echo "  Caso ainda não tenha, pressione Enter para continuar sem token."
  echo ""
  read -rsp "$(echo -e "${YELLOW}?${NC} Token de licença: ")" GHCR_PULL_TOKEN; echo

  # ── 5. Cloudflare Account ID ──────────────────────────────────────────────
  echo ""
  echo -e "  ${BOLD}Cloudflare Account ID${NC}"
  echo "  Onde encontrar: dash.cloudflare.com → Workers & Pages → barra lateral direita"
  echo ""
  CF_ACCOUNT_ID=$(prompt "Account ID")

  # ── 6. Cloudflare API Token ───────────────────────────────────────────────
  echo ""
  echo -e "  ${BOLD}Cloudflare API Token${NC}"
  echo "  Onde criar: dash.cloudflare.com/profile/api-tokens → Create Token"
  echo "  Permissões necessárias: Workers Scripts, Workers KV, D1, Queues (todas Edit)"
  echo ""
  CF_API_TOKEN=$(prompt_secret "API Token")

  # ── Confirmação ───────────────────────────────────────────────────────────
  while true; do
    clear
    echo -e "${BOLD}${CYAN}"
    echo "  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗  ██████╗  ██████╗  █████╗ ███████╗"
    echo "  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝  ██╔══██╗██╔═══██╗██╔══██╗██╔════╝"
    echo "  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗  ██████╔╝██║   ██║███████║███████╗"
    echo "  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║  ██╔══██╗██║   ██║██╔══██║╚════██║"
    echo "  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║  ██║  ██║╚██████╔╝██║  ██║███████║"
    echo "  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝"
    echo -e "${NC}"

    echo -e "  ${BOLD}Resumo da configuração${NC}"
    echo ""
    echo -e "  Domínio do painel  ${CYAN}https://${APP_DOMAIN}${NC}"
    echo -e "  E-mail SSL         ${CYAN}${LETSENCRYPT_EMAIL}${NC}"
    echo -e "  Administrador      ${CYAN}${ADMIN_EMAIL}${NC}"
    echo -e "  Senha admin        ${CYAN}(definida)${NC}"
    if [[ -n "$GHCR_PULL_TOKEN" ]]; then
      echo -e "  Token de licença   ${CYAN}(definido)${NC}"
    else
      echo -e "  Token de licença   ${YELLOW}(não fornecido — imagens públicas)${NC}"
    fi
    echo -e "  Cloudflare ID      ${CYAN}${CF_ACCOUNT_ID}${NC}"
    echo -e "  Cloudflare Token   ${CYAN}(definido)${NC}"
    echo ""
    echo -e "  Senhas dos bancos serão geradas automaticamente."
    echo ""

    read -rp "$(echo -e "${YELLOW}?${NC} Tudo certo? (s = iniciar instalação / n = corrigir): ")" CONFIRM
    case "${CONFIRM,,}" in
      s|sim|y|yes) break ;;
      n|nao|não|no)
        echo ""
        echo "  O que deseja corrigir?"
        echo "  1) Domínio"
        echo "  2) E-mail SSL"
        echo "  3) E-mail do administrador"
        echo "  4) Senha do administrador"
        echo "  5) Token de licença"
        echo "  6) Cloudflare Account ID"
        echo "  7) Cloudflare API Token"
        echo ""
        read -rp "$(echo -e "${YELLOW}?${NC} Número do campo: ")" FIELD
        case "$FIELD" in
          1) APP_DOMAIN=$(prompt "Novo domínio") ;;
          2) LETSENCRYPT_EMAIL=$(prompt "Novo e-mail SSL") ;;
          3) ADMIN_EMAIL=$(prompt "Novo e-mail do administrador") ;;
          4) ADMIN_PASSWORD=$(prompt_secret "Nova senha do administrador") ;;
          5) read -rsp "$(echo -e "${YELLOW}?${NC} Novo token de licença: ")" GHCR_PULL_TOKEN; echo ;;
          6) CF_ACCOUNT_ID=$(prompt "Novo Cloudflare Account ID") ;;
          7) CF_API_TOKEN=$(prompt_secret "Novo Cloudflare API Token") ;;
          *) warn "Opção inválida." ;;
        esac
        ;;
      *) warn "Digite 's' para confirmar ou 'n' para corrigir." ;;
    esac
  done
fi

ok "Configuração confirmada. Iniciando instalação..."
_log_raw "INFO  Configuração confirmada: APP_DOMAIN=${APP_DOMAIN} ADMIN_EMAIL=${ADMIN_EMAIL}"

# ═════════════════════════════════════════════════════════════════════════════
# 2 — Segurança do servidor
# ═════════════════════════════════════════════════════════════════════════════
step 2 "Protegendo o servidor"

log "Atualizando pacotes do sistema..."
apt-get update -qq
apt-get upgrade "${APT_OPTS[@]}" -qq
ok "Sistema atualizado."

# Swap — cria 2GB se RAM < 4GB e swap não existe
TOTAL_RAM=$(awk '/MemTotal/ { print $2 }' /proc/meminfo)
SWAP_TOTAL=$(awk '/SwapTotal/ { print $2 }' /proc/meminfo 2>/dev/null || echo 0)
if [[ $TOTAL_RAM -lt 4000000 ]] && [[ ${SWAP_TOTAL:-0} -eq 0 ]]; then
  log "RAM < 4GB detectada e sem swap. Criando swap de 2GB..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "Swap de 2GB criado."
else
  _log_raw "INFO  Swap pulado: RAM=${TOTAL_RAM}kB SwapTotal=${SWAP_TOTAL:-0}kB"
fi

# Firewall — só portas necessárias abertas
log "Configurando firewall..."
apt-get install "${APT_OPTS[@]}" ufw >/dev/null
ufw --force reset    >/dev/null
ufw default deny incoming  >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp  comment 'SSH'   >/dev/null
ufw allow 80/tcp  comment 'HTTP'  >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw --force enable >/dev/null
ok "Firewall ativo — portas abertas: 22 (SSH), 80 (HTTP), 443 (HTTPS)."

# Fail2ban — bloqueia IPs após tentativas de força bruta
log "Instalando Fail2ban..."
apt-get install "${APT_OPTS[@]}" fail2ban >/dev/null
systemctl enable --now fail2ban >/dev/null
ok "Fail2ban ativo — SSH protegido contra força bruta."

# Atualizações automáticas de segurança
log "Configurando atualizações automáticas de segurança..."
apt-get install "${APT_OPTS[@]}" unattended-upgrades >/dev/null
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'APTEOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
APTEOF
ok "Patches de segurança serão aplicados automaticamente."

# ═════════════════════════════════════════════════════════════════════════════
# 3 — Pré-requisitos
# ═════════════════════════════════════════════════════════════════════════════
step 3 "Instalando pré-requisitos"

apt-get update -qq

if ! command -v docker &>/dev/null; then
  log "Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  ok "Docker instalado."
else
  ok "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1) já presente."
fi

if ! command -v node &>/dev/null; then
  log "Instalando Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install "${APT_OPTS[@]}" nodejs >/dev/null
  ok "Node.js instalado."
else
  ok "Node.js $(node --version) já presente."
fi

if ! command -v wrangler &>/dev/null; then
  log "Instalando Wrangler CLI..."
  npm install -g wrangler --silent
  ok "Wrangler instalado."
else
  ok "Wrangler $(wrangler --version 2>&1 | head -1) já presente."
fi

if ! command -v jq &>/dev/null; then
  apt-get install "${APT_OPTS[@]}" jq >/dev/null
fi

# ═════════════════════════════════════════════════════════════════════════════
# 4 — Cloudflare: D1, KV, Queue e Worker
# ═════════════════════════════════════════════════════════════════════════════
step 4 "Configurando Cloudflare Worker"

export CLOUDFLARE_API_TOKEN="$CF_API_TOKEN"
export CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID"

cf_api() {
  curl -sf "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}$1" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "${@:2}"
}

# Helper: extrai campo JSON via python3 (mais confiável que jq em alguns VPS)
_json_field() {
  # _json_field <json_string> <field_path_as_python_expr>
  # Ex: _json_field "$JSON" "['result']['uuid']"
  python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    val = d$2
    print(val if val else '')
except Exception:
    print('')
" <<< "$1"
}

# D1 database
log "Criando banco D1..."
D1_RESP=$(cf_api "/d1/database" -X POST -d '{"name":"nexus-db"}' 2>/dev/null || echo '{}')
D1_ID=$(python3 -c "
import sys, json
try:
    d = json.loads('''${D1_RESP}''')
    print(d.get('result', {}).get('uuid') or '')
except Exception:
    print('')
" 2>/dev/null || echo "")

if [[ -z "$D1_ID" ]]; then
  D1_LIST=$(cf_api "/d1/database?name=nexus-db" 2>/dev/null || echo '{}')
  D1_ID=$(python3 -c "
import sys, json
try:
    d = json.loads('''${D1_LIST}''')
    results = d.get('result', [])
    print(results[0].get('uuid') if results else '')
except Exception:
    print('')
" 2>/dev/null || echo "")
fi
[[ -z "$D1_ID" ]] && die "Não foi possível criar o banco D1. Verifique as permissões do API Token."
ok "D1 → ${D1_ID}"

# KV namespace
log "Criando namespace KV..."
KV_RESP=$(cf_api "/storage/kv/namespaces" -X POST -d '{"title":"nexus-SITE_CONFIG_KV"}' 2>/dev/null || echo '{}')
KV_ID=$(python3 -c "
import sys, json
try:
    d = json.loads('''${KV_RESP}''')
    print(d.get('result', {}).get('id') or '')
except Exception:
    print('')
" 2>/dev/null || echo "")

if [[ -z "$KV_ID" ]]; then
  KV_LIST=$(cf_api "/storage/kv/namespaces" 2>/dev/null || echo '{}')
  KV_ID=$(python3 -c "
import sys, json
try:
    d = json.loads('''${KV_LIST}''')
    results = d.get('result', [])
    for r in results:
        if r.get('title') == 'nexus-SITE_CONFIG_KV':
            print(r.get('id', ''))
            break
except Exception:
    pass
" 2>/dev/null || echo "")
fi
[[ -z "$KV_ID" ]] && die "Não foi possível criar o namespace KV. Verifique as permissões do API Token."
ok "KV → ${KV_ID}"

# Queue
log "Criando fila de persistência..."
cf_api "/queues" -X POST -d '{"queue_name":"nexus-persistence"}' >/dev/null 2>&1 || \
  warn "Fila nexus-persistence já existe (ok)."
ok "Queue pronta."

# Gerar wrangler.toml a partir do template
log "Gerando wrangler.toml..."
cd "${INSTALL_DIR}/worker"
npm install --silent

sed \
  -e "s/__D1_DATABASE_ID__/${D1_ID}/g" \
  -e "s/__KV_NAMESPACE_ID__/${KV_ID}/g" \
  wrangler.toml.template > wrangler.toml

# Deploy do Worker — tenta --no-bundle primeiro, cai em deploy padrão
log "Fazendo deploy do Worker..."
DEPLOY_OUT=""
if DEPLOY_OUT=$(wrangler deploy --no-bundle 2>&1); then
  _log_raw "INFO  wrangler deploy --no-bundle OK"
else
  warn "Deploy com --no-bundle falhou, tentando modo padrão..."
  DEPLOY_OUT=$(wrangler deploy 2>&1)
  _log_raw "INFO  wrangler deploy (fallback) OK"
fi

WORKER_URL=$(echo "$DEPLOY_OUT" | grep -oP 'https://[^\s]+workers\.dev' | head -1 || echo "")

if [[ -z "$WORKER_URL" ]]; then
  SUBDOMAIN_RESP=$(cf_api "/workers/subdomain" 2>/dev/null || echo '{}')
  SUBDOMAIN=$(python3 -c "
import sys, json
try:
    d = json.loads('''${SUBDOMAIN_RESP}''')
    print(d.get('result', {}).get('subdomain') or '')
except Exception:
    print('')
" 2>/dev/null || echo "")
  WORKER_URL="https://nexus-worker.${SUBDOMAIN}.workers.dev"
fi

# Migrations D1
log "Aplicando migrations D1..."
wrangler d1 migrations apply nexus-db --remote

ok "Worker deployado → ${WORKER_URL}"
cd "${INSTALL_DIR}"

# ═════════════════════════════════════════════════════════════════════════════
# 5 — Gerar .env.prod
# ═════════════════════════════════════════════════════════════════════════════
step 5 "Gerando configuração"

cat > "${INSTALL_DIR}/.env.prod" <<EOF
APP_DOMAIN=${APP_DOMAIN}
MQ_DOMAIN=mq.${APP_DOMAIN}
LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL}
GITHUB_OWNER=nelsijansantana
IMAGE_VERSION=__INJECTED_BY_LICENSE__
POSTGRES_USER=nexus_user
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=nexus_roas_db
CLICKHOUSE_USER=tracker
CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD}
CLICKHOUSE_DB=nexus_roas
RABBITMQ_USER=nexus
RABBITMQ_PASS=${RABBITMQ_PASS}
JWT_SECRET=${JWT_SECRET}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
WORKER_URL=${WORKER_URL}
CF_ACCOUNT_ID=${CF_ACCOUNT_ID}
CF_KV_NAMESPACE_ID=${KV_ID}
CF_API_TOKEN=${CF_API_TOKEN}
EOF

# IMAGE_VERSION: o placeholder é substituído pelo release.yml em produção.
# Durante a instalação manual, usa o GHCR_PULL_TOKEN para autenticar e puxa
# "latest"; em modo CI/CD a imagem real já terá sido injetada.
IMAGE_VERSION="latest"
sed -i "s|__INJECTED_BY_LICENSE__|${IMAGE_VERSION}|" "${INSTALL_DIR}/.env.prod"

ok ".env.prod gerado."

# ═════════════════════════════════════════════════════════════════════════════
# 6 — Docker: Swarm + Traefik + Stack
# ═════════════════════════════════════════════════════════════════════════════
step 6 "Subindo a aplicação"

# ── Autenticação GHCR ─────────────────────────────────────────────────────────
if [[ -n "${GHCR_PULL_TOKEN}" ]]; then
  log "Autenticando no registro de imagens..."
  echo "${GHCR_PULL_TOKEN}" | docker login ghcr.io -u nelsijansantana --password-stdin
  ok "Autenticado no GHCR."
else
  log "Sem token de licença — tentando imagens públicas."
fi

# ── Swarm ─────────────────────────────────────────────────────────────────────
log "Inicializando Docker Swarm..."
if ! docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -q active; then
  docker swarm init
  ok "Swarm inicializado."
else
  ok "Swarm já ativo."
fi

# ── Rede overlay ──────────────────────────────────────────────────────────────
log "Criando rede overlay..."
docker network ls --format '{{.Name}}' | grep -q '^traefik_public$' || \
  docker network create --driver overlay --attachable traefik_public

# ── Pull de imagens — com fallback para build local ───────────────────────────
SERVER_IMAGE="ghcr.io/nelsijansantana/nexus-server:${IMAGE_VERSION}"
CLIENT_IMAGE="ghcr.io/nelsijansantana/nexus-client:${IMAGE_VERSION}"

_IMAGES_OK=true
log "Baixando imagens Docker (${IMAGE_VERSION})..."

if docker pull "${SERVER_IMAGE}" >> "$LOG_FILE" 2>&1; then
  ok "Imagem server baixada: ${SERVER_IMAGE}"
else
  warn "Falha ao baixar ${SERVER_IMAGE}."
  _IMAGES_OK=false
fi

if docker pull "${CLIENT_IMAGE}" >> "$LOG_FILE" 2>&1; then
  ok "Imagem client baixada: ${CLIENT_IMAGE}"
else
  warn "Falha ao baixar ${CLIENT_IMAGE}."
  _IMAGES_OK=false
fi

if [[ "$_IMAGES_OK" == "false" ]]; then
  warn "Uma ou mais imagens não puderam ser baixadas do GHCR."
  warn "Iniciando build local a partir do código-fonte..."
  warn "ATENÇÃO: O build pode levar de 10 a 15 minutos."
  _log_raw "WARN  Iniciando build local das imagens"

  BUILD_SRC="/tmp/nexus-src"
  if [[ -d "$BUILD_SRC" ]]; then
    rm -rf "$BUILD_SRC"
  fi

  log "Clonando repositório para build..."
  git clone --depth 1 https://github.com/nelsijansantana/nexus-roas.git "$BUILD_SRC" \
    >> "$LOG_FILE" 2>&1 || die "Falha ao clonar repositório para build local."

  # Copiar server/ e client/ para INSTALL_DIR se não existirem
  if [[ ! -d "${INSTALL_DIR}/server" ]]; then
    log "Copiando server/ do repositório clonado..."
    cp -r "${BUILD_SRC}/server" "${INSTALL_DIR}/server"
  fi
  if [[ ! -d "${INSTALL_DIR}/client" ]]; then
    log "Copiando client/ do repositório clonado..."
    cp -r "${BUILD_SRC}/client" "${INSTALL_DIR}/client"
  fi

  log "Construindo imagem do servidor (pode levar vários minutos)..."
  docker build -t "${SERVER_IMAGE}" "${INSTALL_DIR}/server" >> "$LOG_FILE" 2>&1 \
    || die "Falha no build da imagem do servidor. Verifique ${LOG_FILE}."
  ok "Imagem server construída localmente."

  log "Construindo imagem do cliente (pode levar vários minutos)..."
  docker build -t "${CLIENT_IMAGE}" "${INSTALL_DIR}/client" >> "$LOG_FILE" 2>&1 \
    || die "Falha no build da imagem do cliente. Verifique ${LOG_FILE}."
  ok "Imagem client construída localmente."

  rm -rf "$BUILD_SRC"
fi

# ── Traefik ───────────────────────────────────────────────────────────────────
log "Deployando Traefik (proxy + SSL)..."
bash -c "set -a && . ${INSTALL_DIR}/.env.prod && set +a && \
  docker stack deploy -c ${INSTALL_DIR}/docker-compose.traefik.yml traefik"

log "Aguardando Traefik iniciar..."
sleep 8

# ── Stack principal ────────────────────────────────────────────────────────────
log "Deployando Nexus ROAS..."
bash -c "set -a && . ${INSTALL_DIR}/.env.prod && set +a && \
  docker stack deploy -c ${INSTALL_DIR}/docker-compose.prod.yml nexus-prod"

# ═════════════════════════════════════════════════════════════════════════════
# 7 — Pronto
# ═════════════════════════════════════════════════════════════════════════════
step 7 "Concluído"

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║    Nexus ROAS instalado com sucesso!        ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Painel:${NC}   https://${APP_DOMAIN}"
echo -e "  ${BOLD}Worker:${NC}   ${WORKER_URL}"
echo -e "  ${BOLD}Login:${NC}    ${ADMIN_EMAIL}"
echo ""
echo -e "  ${YELLOW}Aguarde 1–2 minutos para todos os serviços iniciarem.${NC}"
echo -e "  ${YELLOW}O certificado SSL pode levar até 5 minutos.${NC}"
echo ""
echo -e "  Verificar status:  ${CYAN}docker service ls${NC}"
echo -e "  Ver logs:          ${CYAN}docker service logs -f nexus-prod_backend${NC}"
echo -e "  Log da instalação: ${CYAN}${LOG_FILE}${NC}"
echo ""

_log_raw "INFO  Instalação concluída com sucesso."
