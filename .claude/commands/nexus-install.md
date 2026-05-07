# Nexus ROAS — Agente de Instalação

<instructions>
When the user invokes /nexus-install, act as an automated installation agent for Nexus ROAS.

## What you need from the user
Collect these pieces of information one by one (in Portuguese):

1. **IP do VPS** — endereço IPv4 público do servidor
2. **Senha SSH** — avise que também é possível usar chave SSH (nesse caso, configure a chave no servidor antes)
3. **Domínio da aplicação** — ex: app.cliente.com. Lembre o usuário que o DNS já deve estar apontando para o IP do VPS antes de instalar
4. **E-mail do admin** — será o login principal do painel Nexus ROAS
5. **Cloudflare Account ID** — encontrado em dash.cloudflare.com → lado direito de qualquer página → "Account ID"
6. **Cloudflare API Token** — criar em dash.cloudflare.com/profile/api-tokens → Create Token (Custom Token). Permissões necessárias:
   - Workers Scripts: Edit
   - Workers KV Storage: Edit
   - D1: Edit
   - Workers Routes: Edit
   - Account Settings: Read

## How to proceed

1. Assim que tiver todas as informações, instrua o usuário a rodar:

```bash
python scripts/remote_install.py
```

O script é interativo e solicitará cada valor um por um. Oriente o usuário a responder os prompts conforme aparecerem.

2. Monitore a saída em tempo real com o usuário. Fique atento a erros comuns:

### Erros comuns e soluções

**`client version 1.24` ou erros de API version no Traefik**
- Causa: incompatibilidade com Traefik v3
- Solução: verificar se `docker-compose.traefik.yml` usa imagem `traefik:v2.11` e não `traefik:v3`

**`unauthorized` ao fazer docker pull**
- Causa: imagens GHCR ainda não foram publicadas no registry
- Ação: o fallback de build local deve ser acionado automaticamente; se não acontecer, verificar o `install.sh`

**`Invalid API Token` ou `403` do Cloudflare**
- Causa: token com permissões insuficientes ou digitado errado
- Solução: criar novo token com permissões Workers Scripts/KV/D1/Routes (Edit) + Account Settings (Read)

**Porta 80 ou 443 bloqueada**
- Causa: firewall do provedor de VPS (separado do UFW interno)
- Solução: acessar painel do provedor (Hetzner, DigitalOcean, etc.) e abrir as portas 80 e 443 no security group / firewall externo

**`Permission denied` em `/opt/nexus-roas`**
- Causa: usuário SSH sem privilégios de root
- Solução: garantir que o usuário SSH seja root ou tenha sudo sem senha

## Critérios de sucesso

A instalação foi bem-sucedida quando:
- Todos os 7 serviços Docker mostram `REPLICAS x/x` (não `0/x`) ao rodar `docker service ls`
- `curl -k https://<domínio>/api/v1/auth/login` retorna um JSON (mesmo que seja erro 401)
- O login com e-mail e senha de admin funciona no painel

## Notas adicionais

- Responda sempre em português ao usuário
- Se o usuário travar em algum passo, peça o trecho de log exato e diagnostique
- Após sucesso, oriente o usuário a salvar as credenciais em local seguro (gerenciador de senhas)
</instructions>
