# Guia Cloudflare — Nexus ROAS

A Cloudflare é usada pelo Nexus ROAS para processar os eventos de rastreamento em tempo real, na borda da internet. A conta é **totalmente gratuita** — você não precisa contratar nenhum plano pago.

---

## Parte 1 — Criar a conta

1. Acesse [cloudflare.com](https://cloudflare.com)
2. Clique em **Sign Up** (canto superior direito)
3. Preencha seu e-mail e crie uma senha
4. Confirme o e-mail que chegará na sua caixa de entrada
5. Ao entrar pela primeira vez, a Cloudflare vai perguntar se você quer adicionar um domínio — **pule essa etapa** clicando em "Skip" ou "Later"

Você está no **Dashboard da Cloudflare**. Continue para o próximo passo.

---

## Parte 2 — Encontrar o Account ID

O Account ID identifica a sua conta. Você vai precisar dele durante a instalação.

1. No Dashboard, olhe para a **barra lateral esquerda** e clique em **Workers & Pages**
2. Na página que abrir, olhe para a **barra lateral direita** — você verá uma seção chamada **Account ID**
3. Copie o valor exibido

```
Exemplo: CF_ACCOUNT_ID_REDACTED
```

> Se não encontrar no menu, acesse diretamente: `dash.cloudflare.com` → clique no seu nome de usuário no canto superior direito → **Account Home** → a barra lateral direita mostra o Account ID.

---

## Parte 3 — Criar o API Token

O API Token permite que o instalador crie automaticamente os recursos necessários na sua conta. Você só precisa fazer isso uma vez.

### 3.1 — Abrir a página de tokens

1. Clique no ícone do seu **perfil** (canto superior direito do Dashboard)
2. Selecione **My Profile**
3. No menu que aparece à esquerda, clique em **API Tokens**
4. Clique no botão **Create Token**

---

### 3.2 — Criar o token do zero

Na página seguinte, role até o final e clique em **Create Custom Token** (Criar token personalizado).

---

### 3.3 — Configurar o token

Preencha o formulário como descrito abaixo:

**Token name (Nome do token):**
```
Nexus ROAS Install
```

**Permissions (Permissões):**

Você precisa adicionar **5 permissões**. Para cada uma, clique em **Add more** e selecione:

| Account | Recurso | Acesso |
|---|---|---|
| Account | Workers Scripts | Edit |
| Account | Workers KV Storage | Edit |
| Account | D1 | Edit |
| Account | Queues | Edit |
| Account | Workers Routes | Edit |

Como adicionar cada uma:
1. No primeiro campo (tipo), selecione **Account**
2. No segundo campo (recurso), selecione o nome listado acima
3. No terceiro campo (acesso), selecione **Edit**
4. Clique em **+ Add more** para adicionar a próxima

---

**Account Resources (Recursos de conta):**

- No campo abaixo das permissões, certifique-se de que está selecionado:
  - **Include** → **All accounts** (ou selecione sua conta específica)

---

**Client IP Address Filtering (Filtragem por IP):**

Deixe em branco — não é necessário.

---

**TTL (Validade):**

Deixe em branco para o token não expirar, ou defina uma data futura.

---

### 3.4 — Criar e copiar o token

1. Clique em **Continue to summary** (Continuar para resumo)
2. Revise as permissões na tela de confirmação
3. Clique em **Create Token**
4. O token será exibido **uma única vez** na tela

```
Exemplo: AbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcd
```

> **Importante:** Copie e guarde o token agora em um lugar seguro. A Cloudflare não mostra o token novamente após você fechar essa página.

---

## Resumo — O que você deve ter anotado

Ao final deste guia, você deve ter em mãos:

| Informação | Onde encontrar | Exemplo |
|---|---|---|
| **Account ID** | Workers & Pages → barra lateral direita | `CF_ACCOUNT_ID_REDACTED` |
| **API Token** | My Profile → API Tokens → Create Token | `AbCdEfGhIjKl...` |

Com esses dois valores, volte ao instalador e continue a instalação.

---

## Dúvidas frequentes

### "Preciso adicionar meu domínio na Cloudflare?"

Não. O Nexus ROAS usa o Workers.dev da Cloudflare, que não exige que você transfira seu domínio. Você pode usar a Cloudflare só para o rastreamento, sem mexer no DNS do seu domínio principal.

---

### "Vou ser cobrado por alguma coisa?"

O plano gratuito da Cloudflare inclui:
- **100.000 requisições/dia** no Workers
- **5 GB de armazenamento** no D1
- **1 GB de armazenamento** no KV

Para lojas com alto volume de pedidos, pode ser necessário o plano Workers Paid ($5/mês). O instalador avisará se você estiver próximo do limite.

---

### "O token que criei não está funcionando"

Verifique se todas as 5 permissões foram adicionadas corretamente. Uma permissão faltando impede a criação dos recursos durante a instalação. Você pode excluir o token e criar um novo seguindo os passos acima.
