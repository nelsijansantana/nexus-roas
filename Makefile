# ═══════════════════════════════════════════════════════════════════════════════
# Nexus ROAS — Makefile
#
# Quick reference:
#   make setup              First-time production setup wizard
#   make setup-staging      First-time staging setup wizard
#   make deploy             Deploy (or update) production stack
#   make deploy-staging     Deploy (or update) staging stack
#   make update VERSION=X   Rolling update backend + frontend images
#   make build VERSION=X    Build & push images to Docker Hub
#   make worker             Deploy Cloudflare Worker (production)
#   make worker-staging     Deploy Cloudflare Worker (staging)
#   make logs               Tail production logs
#   make status             Show service health
#   make rollback           Roll back last backend update
# ═══════════════════════════════════════════════════════════════════════════════

PROD_ENV    ?= .env.prod
STAGING_ENV ?= .env.staging
PROD_STACK  ?= nexus-prod
STG_STACK   ?= nexus-staging
VERSION     ?= latest

# Load production env if it exists (for direct variable access in this file)
-include $(PROD_ENV)
export

.PHONY: help setup setup-staging setup-infra \
        deploy deploy-staging update update-staging \
        build worker worker-staging \
        logs logs-staging status rollback shell-backend

## ── Default target ────────────────────────────────────────────────────────────

help: ## Show this help
	@echo ""
	@echo "  Nexus ROAS — deployment commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""

## ── First-time setup ──────────────────────────────────────────────────────────

setup: ## Interactive first-time setup wizard (production)
	@bash setup.sh

setup-staging: ## Interactive first-time setup wizard (staging)
	@bash setup.sh --staging

setup-infra: ## Init Swarm + create overlay network + deploy Traefik only
	@echo "→  Checking Docker Swarm..."
	@docker info --format '{{.Swarm.LocalNodeState}}' | grep -q active || docker swarm init
	@docker network ls --format '{{.Name}}' | grep -q '^traefik_public$$' || \
	  docker network create --driver overlay --attachable traefik_public
	@echo "→  Deploying Traefik..."
	@bash -c "set -a && . $(PROD_ENV) && set +a && \
	  docker stack deploy -c docker-compose.traefik.yml traefik"
	@echo "✔  Infrastructure ready"

## ── Build & publish ───────────────────────────────────────────────────────────

build: ## Build and push server + client images to GHCR (requires VERSION=x.x.x)
	@test -n "$(VERSION)" || (echo "Usage: make build VERSION=2.0.6" && exit 1)
	@test "$(VERSION)" != "latest" || (echo "Specify a real version: make build VERSION=2.0.6" && exit 1)
	@echo "→  Building server ghcr.io/$(GITHUB_OWNER)/nexus-server:$(VERSION)..."
	docker build --platform linux/amd64 -t ghcr.io/$(GITHUB_OWNER)/nexus-server:$(VERSION) ./server
	@echo "→  Building client ghcr.io/$(GITHUB_OWNER)/nexus-client:$(VERSION)..."
	docker build --platform linux/amd64 -t ghcr.io/$(GITHUB_OWNER)/nexus-client:$(VERSION) ./client
	@echo "→  Pushing images to ghcr.io..."
	docker push ghcr.io/$(GITHUB_OWNER)/nexus-server:$(VERSION)
	docker push ghcr.io/$(GITHUB_OWNER)/nexus-client:$(VERSION)
	@echo "✔  Published $(VERSION)"

## ── Deploy ────────────────────────────────────────────────────────────────────

deploy: ## Deploy or update production stack (full redeploy)
	@test -f $(PROD_ENV) || (echo "✘  $(PROD_ENV) not found. Run: make setup" && exit 1)
	@echo "→  Deploying $(PROD_STACK)..."
	@bash -c "set -a && . $(PROD_ENV) && set +a && \
	  docker stack deploy -c docker-compose.prod.yml $(PROD_STACK)"
	@echo "✔  $(PROD_STACK) deployed"

deploy-staging: ## Deploy or update staging stack
	@test -f $(STAGING_ENV) || (echo "✘  $(STAGING_ENV) not found. Run: make setup-staging" && exit 1)
	@echo "→  Deploying $(STG_STACK)..."
	@bash -c "set -a && . $(STAGING_ENV) && set +a && \
	  docker stack deploy -c docker-compose.staging.yml $(STG_STACK)"
	@echo "✔  $(STG_STACK) deployed"

## ── Rolling updates ───────────────────────────────────────────────────────────

update: ## Rolling update server + client (requires VERSION=x.x.x)
	@test -n "$(VERSION)" || (echo "Usage: make update VERSION=2.0.6" && exit 1)
	@test "$(VERSION)" != "latest" || (echo "Specify a real version: make update VERSION=2.0.6" && exit 1)
	@echo "→  Updating $(PROD_STACK) to $(VERSION)..."
	docker service update \
	  --image ghcr.io/$(GITHUB_OWNER)/nexus-server:$(VERSION) \
	  --update-order start-first \
	  $(PROD_STACK)_backend
	docker service update \
	  --image ghcr.io/$(GITHUB_OWNER)/nexus-client:$(VERSION) \
	  $(PROD_STACK)_frontend
	@echo "✔  Updated to $(VERSION)"

update-staging: ## Rolling update staging (requires VERSION=x.x.x or use 'staging' tag)
	@test -n "$(VERSION)" || (echo "Usage: make update-staging VERSION=staging" && exit 1)
	docker service update \
	  --image ghcr.io/$(GITHUB_OWNER)/nexus-server:$(VERSION) \
	  --update-order start-first \
	  $(STG_STACK)_backend-staging
	docker service update \
	  --image ghcr.io/$(GITHUB_OWNER)/nexus-client:$(VERSION) \
	  $(STG_STACK)_frontend-staging
	@echo "✔  Staging updated to $(VERSION)"

rollback: ## Roll back the last backend update (production)
	@echo "→  Rolling back backend..."
	docker service rollback $(PROD_STACK)_backend
	@echo "✔  Rollback complete"

## ── Cloudflare Worker ─────────────────────────────────────────────────────────

worker: ## Build and deploy Cloudflare Worker (production)
	cd worker && npm install && npm run deploy

worker-staging: ## Build and deploy Cloudflare Worker (staging)
	cd worker && npm install && npm run deploy -- --env staging

## ── Observability ─────────────────────────────────────────────────────────────

logs: ## Tail production logs (Ctrl+C to stop)
	docker service logs -f --tail 100 $(PROD_STACK)_backend

logs-frontend: ## Tail frontend logs
	docker service logs -f --tail 50 $(PROD_STACK)_frontend

logs-staging: ## Tail staging backend logs
	docker service logs -f --tail 100 $(STG_STACK)_backend-staging

status: ## Show all service health and replica counts
	@echo ""
	@echo "  Production stack ($(PROD_STACK)):"
	@docker service ls --filter label=com.docker.stack.namespace=$(PROD_STACK) \
	  --format "  {{.Name}}\t{{.Replicas}}\t{{.Image}}" 2>/dev/null | \
	  awk '{printf "  %-45s %-12s %s\n", $$1, $$2, $$3}' || echo "  (not deployed)"
	@echo ""
	@echo "  Staging stack ($(STG_STACK)):"
	@docker service ls --filter label=com.docker.stack.namespace=$(STG_STACK) \
	  --format "  {{.Name}}\t{{.Replicas}}\t{{.Image}}" 2>/dev/null | \
	  awk '{printf "  %-45s %-12s %s\n", $$1, $$2, $$3}' || echo "  (not deployed)"
	@echo ""

shell-backend: ## Open a shell in a running backend container
	@CONTAINER=$$(docker ps --filter name=$(PROD_STACK)_backend --format '{{.ID}}' | head -1); \
	test -n "$$CONTAINER" || (echo "No backend container running" && exit 1); \
	docker exec -it $$CONTAINER sh

## ── Cleanup ───────────────────────────────────────────────────────────────────

down: ## Remove production stack (keeps volumes)
	@echo "⚠  This will stop all production services. Data volumes are preserved."
	@read -p "  Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ] || exit 1
	docker stack rm $(PROD_STACK)

down-staging: ## Remove staging stack
	docker stack rm $(STG_STACK)
