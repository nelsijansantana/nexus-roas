#!/usr/bin/env bash
# Nexus ROAS — Bootstrap
# Uso: curl -sSL https://github.com/nelsijansantana/nexus-roas/releases/latest/download/bootstrap.sh | sudo bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}Nexus ROAS — Baixando instalador...${NC}"

[[ $EUID -ne 0 ]] && echo -e "${RED}Execute como root: curl ... | sudo bash${NC}" && exit 1

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

curl -sSL "https://github.com/nelsijansantana/nexus-roas/releases/latest/download/nexus-roas.tar.gz" \
  | tar xz -C "$TMPDIR"

echo -e "${GREEN}Pacote baixado. Iniciando instalação...${NC}"
echo ""

exec bash "$TMPDIR/nexus-roas/install.sh"
