# Script para Build e Push das imagens para o GHCR (GitHub Container Registry)
# Nexus ROAS
#
# USO:
#   .\publish.ps1 -Version 2.0.2
#
# Pré-requisito: autenticar no GHCR uma vez:
#   echo $env:GITHUB_TOKEN | docker login ghcr.io -u <seu-usuario> --password-stdin

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,

    [string]$Owner = "nelsijansantana",

    [switch]$NoLatest
)

$REGISTRY     = "ghcr.io"
$SERVER_IMAGE = "$REGISTRY/$Owner/nexus-server:$Version"
$CLIENT_IMAGE = "$REGISTRY/$Owner/nexus-client:$Version"
$SERVER_LATEST = "$REGISTRY/$Owner/nexus-server:latest"
$CLIENT_LATEST = "$REGISTRY/$Owner/nexus-client:latest"

Write-Host "Nexus ROAS v$Version → $REGISTRY/$Owner" -ForegroundColor Cyan

# ── Build Server ──────────────────────────────────────────────────────────────
Write-Host "`nBuilding server..." -ForegroundColor Yellow
docker build --no-cache --platform linux/amd64 -t $SERVER_IMAGE ./server
if ($LASTEXITCODE -ne 0) { Write-Host "ERRO: build do server falhou." -ForegroundColor Red; exit 1 }

# ── Build Client ──────────────────────────────────────────────────────────────
Write-Host "`nBuilding client..." -ForegroundColor Yellow
docker build --no-cache --platform linux/amd64 -t $CLIENT_IMAGE ./client
if ($LASTEXITCODE -ne 0) { Write-Host "ERRO: build do client falhou." -ForegroundColor Red; exit 1 }

# ── Tag latest ─────────────────────────────────────────────────────────────────
if (-not $NoLatest -and $Version -ne "staging") {
    Write-Host "`nTagging :latest..." -ForegroundColor Yellow
    docker tag $SERVER_IMAGE $SERVER_LATEST
    docker tag $CLIENT_IMAGE $CLIENT_LATEST
}

# ── Push ──────────────────────────────────────────────────────────────────────
Write-Host "`nPushing para GHCR..." -ForegroundColor Green
docker push $SERVER_IMAGE
if ($LASTEXITCODE -ne 0) { Write-Host "ERRO: push do server falhou." -ForegroundColor Red; exit 1 }
docker push $CLIENT_IMAGE
if ($LASTEXITCODE -ne 0) { Write-Host "ERRO: push do client falhou." -ForegroundColor Red; exit 1 }

if (-not $NoLatest -and $Version -ne "staging") {
    docker push $SERVER_LATEST
    docker push $CLIENT_LATEST
}

Write-Host "`nConcluido!" -ForegroundColor Cyan
Write-Host "  $SERVER_IMAGE"
Write-Host "  $CLIENT_IMAGE"
if (-not $NoLatest -and $Version -ne "staging") {
    Write-Host "  $SERVER_LATEST"
    Write-Host "  $CLIENT_LATEST"
}
