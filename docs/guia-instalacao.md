# Guia de Instalação — Nexus ROAS

## Antes de começar

Você vai precisar de três coisas:

| O que | Por quê | Onde conseguir |
|---|---|---|
| Um servidor VPS | Para hospedar a aplicação | DigitalOcean, Hetzner, Vultr |
| Um domínio | Para acessar o painel | Registro.br, GoDaddy, Namecheap |
| Uma conta Cloudflare | Para o rastreamento funcionar | cloudflare.com (grátis) |

---

## Passo 1 — Escolha e configure o servidor

### Qual servidor escolher

Recomendamos a **Hetzner** pelo custo-benefício:

- Acesse [hetzner.com](https://hetzner.com)
- Crie uma conta e faça login
- Clique em **New Server**
- Escolha as configurações:
  - **Location:** Falkenstein ou Nuremberg
  - **Image:** Ubuntu 22.04
  - **Type:** CX22 (2 vCPU, 4 GB RAM) — suficiente para começar
  - **SSH Key:** adicione sua chave SSH, ou anote a senha root que aparecerá
- Clique em **Create & Buy Now**

Anote o **IP do servidor** — você vai precisar dele nos próximos passos.

---

## Passo 2 — Aponte o domínio para o servidor

Você precisa criar dois registros DNS no painel do seu domínio:

| Tipo | Nome | Valor |
|---|---|---|
| A | `app` | IP do seu servidor |
| A | `mq` | IP do seu servidor |

**Exemplo:** se o seu domínio é `meusite.com`, os registros ficam assim:
- `app.meusite.com` → IP do servidor
- `mq.meusite.com` → IP do servidor

> Os registros DNS podem levar até 10 minutos para propagar. Você pode verificar em [dnschecker.org](https://dnschecker.org).

---

## Passo 3 — Configure a Cloudflare

A Cloudflare é usada para o rastreamento de eventos funcionar em tempo real. A conta é **gratuita**.

Siga o **Guia Cloudflare** (arquivo `guia-cloudflare.md`) para:
1. Criar sua conta
2. Obter o Account ID
3. Criar o API Token

Guarde essas informações — você vai precisar delas na instalação.

---

## Passo 4 — Conecte ao servidor

Abra o terminal do seu computador e conecte ao servidor via SSH:

```bash
ssh root@SEU_IP_AQUI
```

Se for a primeira vez, confirme digitando `yes` quando perguntado.

---

## Passo 5 — Execute o instalador

Ainda no terminal (conectado ao servidor), rode os comandos abaixo:

```bash
# Baixar o Nexus ROAS
git clone https://github.com/nelsijansantana/nexus-roas
cd nexus-roas

# Iniciar a instalação
sudo bash install.sh
```

O instalador vai fazer perguntas uma por uma. Veja o que cada uma significa:

---

### Domínio do painel
```
? Domínio do painel (ex: app.meusite.com):
```
Digite o subdomínio que você configurou no Passo 2.
**Exemplo:** `app.meusite.com`

---

### E-mail para certificado SSL
```
? E-mail para certificado SSL:
```
Seu e-mail. Ele é usado apenas para emitir o certificado HTTPS gratuito.
**Exemplo:** `voce@gmail.com`

---

### E-mail do administrador
```
? E-mail do administrador:
```
O e-mail que você usará para fazer login no painel.
**Exemplo:** `admin@meusite.com`

---

### Senha do administrador
```
? Senha do administrador:
```
Crie uma senha forte. Ela não será exibida na tela enquanto você digita — isso é normal.

---

### Token de licença
```
? Token de licença (recebido por e-mail):
```
O token que chegou no seu e-mail após a compra.
**Exemplo:** `NXS-XXXX-XXXX-XXXX`

---

### Cloudflare Account ID
```
? Cloudflare Account ID:
```
Veja onde encontrar isso no **Guia Cloudflare**.
**Exemplo:** `CF_ACCOUNT_ID_REDACTED`

---

### Cloudflare API Token
```
? Cloudflare API Token:
```
O token criado no **Guia Cloudflare**. Não será exibido na tela enquanto você digita.

---

## Passo 6 — Aguarde a instalação

O instalador vai trabalhar sozinho por alguns minutos. Você verá o progresso:

```
[1/6] Configuração ..................... ✔
[2/6] Instalando pré-requisitos ........ ✔
[3/6] Configurando Cloudflare Worker ... ✔
[4/6] Gerando configuração ............. ✔
[5/6] Subindo a aplicação .............. ✔
[6/6] Concluído

╔══════════════════════════════════════════════╗
║    Nexus ROAS instalado com sucesso! 🎉     ║
╚══════════════════════════════════════════════╝

  Painel:   https://app.meusite.com
  Login:    admin@meusite.com
```

Aguarde **1 a 2 minutos** após a conclusão e acesse o painel no navegador.

> **Certificado SSL:** na primeira abertura, o navegador pode mostrar um aviso de segurança por alguns minutos enquanto o certificado é emitido. Isso é normal — aguarde até 5 minutos e recarregue a página.

---

## Verificando se está tudo funcionando

No terminal do servidor, você pode verificar o status dos serviços:

```bash
# Ver se todos os serviços estão rodando
docker service ls

# Ver os logs do backend
docker service logs -f nexus-prod_backend
```

Todos os serviços devem mostrar `1/1` ou `3/3` na coluna de réplicas.

---

## Solução de problemas

### O painel não abre após a instalação

1. Verifique se o domínio está apontando para o servidor:
   ```bash
   ping app.meusite.com
   ```
   O IP exibido deve ser o do seu servidor.

2. Verifique se os serviços estão rodando:
   ```bash
   docker service ls
   ```

3. Verifique os logs para mensagens de erro:
   ```bash
   docker service logs nexus-prod_backend
   ```

---

### Erro "certificado inválido"

Aguarde até 5 minutos e recarregue a página. Se persistir:

```bash
docker service logs traefik_traefik
```

Procure por mensagens sobre o domínio informado.

---

### Preciso reinstalar

Execute novamente:

```bash
sudo bash install.sh
```

O instalador detecta o que já existe e pula as etapas já concluídas.

---

## Próximos passos

Após acessar o painel:

1. **Crie seu primeiro projeto** — clique em "Novo Projeto" e informe o domínio da sua loja
2. **Adicione os pixels** — Meta, TikTok ou GA4 nas configurações do projeto
3. **Instale o script de rastreamento** — copie o código gerado e cole no `<head>` da sua loja
