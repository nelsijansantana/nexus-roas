#!/bin/sh

echo "Iniciando Nexus ROAS Tracker API..."

# ─── Baseline automático ─────────────────────────────────────────────────────
# Se o banco foi gerenciado anteriormente por "prisma db push", ele não possui a
# tabela _prisma_migrations. O "migrate deploy" rejeita com P3005.
#
# Estratégia (executada apenas uma vez na transição db push → migrate):
#   1. Baseline de TODAS as migrações — nenhum SQL é executado; apenas registros
#      são inseridos em _prisma_migrations.
#   2. Executa o SQL de TODAS as migrações via "prisma db execute" — aplica
#      as mudanças reais que o db push pode não ter (ex: webhook_account_id).
#
# Nas próximas subidas, _prisma_migrations já existe → este bloco nunca é acionado.
# ─────────────────────────────────────────────────────────────────────────────

echo "Verificando histórico de migrações..."
FIRST_RUN_OUTPUT=$(npx prisma migrate deploy 2>&1)
FIRST_EXIT=$?

echo "$FIRST_RUN_OUTPUT"

if [ $FIRST_EXIT -ne 0 ] && echo "$FIRST_RUN_OUTPUT" | grep -q "P3005"; then
  echo ""
  echo "⚠️  Banco sem histórico de migrações (era gerenciado por db push)."
  echo "    Realizando baseline de todas as migrações..."

  # Filtra apenas diretórios que começam com números (pastas de migração)
  MIGRATIONS=$(ls -1 prisma/migrations | grep -E '^[0-9]+_' | sort)

  for migration in $MIGRATIONS; do
    echo "  ✓ baseline: $migration"
    npx prisma migrate resolve --applied "$migration" 2>&1 || true
    
    # Executa o SQL individualmente para garantir que colunas faltantes sejam criadas.
    # O baseline acima apenas registra, não executa o SQL.
    SQL="prisma/migrations/$migration/migration.sql"
    if [ -f "$SQL" ]; then
      echo "    Aplicando SQL: $migration"
      npx prisma db execute --file="$SQL" --schema=prisma/schema.prisma 2>&1 || true
    fi
  done

  echo ""
  echo "Baseline concluído."
fi

# ─── Deploy (com retry para race condition entre réplicas) ────────────────────
MAX_RETRIES=10
COUNT=0
SUCCESS=false

while [ $COUNT -lt $MAX_RETRIES ]; do
  if npx prisma migrate deploy 2>&1; then
    SUCCESS=true
    break
  fi
  COUNT=$((COUNT + 1))
  echo "migrate deploy falhou. Tentando novamente em 5 segundos... ($COUNT/$MAX_RETRIES)"
  sleep 5
done

if [ "$SUCCESS" = false ]; then
  echo "❌ Erro: Não foi possível aplicar as migrações após $MAX_RETRIES tentativas."
  exit 1
fi

echo "✅ Migrações sincronizadas."

# ─── Reparo idempotente ───────────────────────────────────────────────────────
# Garante que webhook_account_id e account_webhooks existem, mesmo que o
# baseline tenha marcado a migration como aplicada sem executar o SQL.
echo "Aplicando reparo idempotente (webhook_account_id)..."
if npx prisma db execute --file="prisma/repair_webhook.sql" --schema=prisma/schema.prisma 2>&1; then
  echo "✅ Reparo concluído com sucesso."
else
  echo "⚠️  Aviso: Reparo idempotente finalizou com observações (ver logs acima)."
fi

echo "Iniciando o servidor..."
exec node dist/main.js
