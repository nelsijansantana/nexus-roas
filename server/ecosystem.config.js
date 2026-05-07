/**
 * PM2 Cluster Mode — Nexus ROAS Backend
 *
 * Utiliza os 2 vCPUs da VPS KVM 2 (Hostinger).
 * Cada instância tem seu próprio event loop, então requests são distribuídos
 * em round-robin — dobra a capacidade de processing sem custo adicional.
 *
 * ⚠️  IMPORTANTE: as variáveis de ambiente abaixo são exemplos.
 *     Configure as reais no painel da Hostinger ou via arquivo .env no servidor.
 *
 * Comandos:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --env production   (zero-downtime reload)
 *   pm2 logs nexus-roas
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'nexus-roas',
      script: 'dist/main.js',

      // Cluster mode: 1 processo por vCPU
      // 'max' detecta automaticamente o número de cores
      instances: 'max',
      exec_mode: 'cluster',

      // Reinício automático se uso de memória ultrapassar 1.5GB por instância
      max_memory_restart: '1500M',

      // Aguarda conexões em aberto antes de desligar (graceful shutdown)
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 10000,

      // Reinício exponencial para evitar restart loops
      exp_backoff_restart_delay: 1000,
      max_restarts: 10,

      // Logs
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Configurar as demais variáveis no .env do servidor:
        // DATABASE_URL, CLICKHOUSE_HOST, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD,
        // CLICKHOUSE_DB, JWT_SECRET, API_URL, etc.
      },
    },
  ],
};
