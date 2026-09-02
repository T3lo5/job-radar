# Manual do Usuário — Job Radar

Bem-vindo ao **Job Radar**! 🎯

Este manual vai te ajudar a colocar o sistema para rodar no seu computador e aproveitar ao máximo todas as funcionalidades — mesmo que você não tenha muita experiência com programação.

---

## O que é o Job Radar?

O Job Radar é um assistente pessoal que:
- Busca vagas de tecnologia automaticamente em várias fontes
- Compara cada vaga com o seu perfil e calcula uma **nota de 0 a 100**
- Mostra o que você precisa melhorar para se encaixar melhor em cada vaga
- Otimiza o seu currículo com ajuda de IA
- Organiza suas candidaturas em um quadro estilo Kanban
- Pode enviar um resumo diário das melhores vagas no seu Telegram

Tudo isso roda no **seu computador**, os seus dados ficam com você, e o sistema é **livre e aberto** para a comunidade melhorar.

---

## Antes de começar

Você vai precisar instalar algumas ferramentas básicas. Não se assuste — é só uma vez:

| O que instalar | Para que serve | Como instalar |
|----------------|----------------|---------------|
| **Git** | Para baixar o projeto | https://git-scm.com/downloads |
| **Node.js 20+** | O motor que roda o sistema | https://nodejs.org/ |
| **pnpm** | Gerenciador de pacotes | https://pnpm.io/installation |
| **Docker + Docker Compose** | Banco de dados e cache (o sistema usa para guardar suas informações) | https://docs.docker.com/get-docker/ |
| **Editor de texto** (recomendado: VS Code) | Para editar arquivos de configuração | https://code.visualstudio.com/ |

> 💡 **Dica para usuários Windows:** recomendamos usar o [WSL2](https://learn.microsoft.com/pt-br/windows/wsl/install) para rodar os comandos de forma mais simples. Se você não sabe o que é WSL, pode tentar direto no Windows mesmo — se der erro, volte aqui e siga o guia do WSL.

---

## Passo 1 — Baixar o Job Radar

Abra o terminal (no Windows, use PowerShell ou o terminal do VS Code) e execute:

```bash
git clone https://github.com/T3lo5/job-radar.git
cd job-vacancy-tracker
```

Isso vai criar uma pasta chamada `job-radar` no seu computador com todos os arquivos do sistema.

---

## Passo 2 — Configuração inicial

### 2.1 — Gere uma chave secreta

O Job Radar protege suas configurações com uma chave de criptografia. Para gerá-la, execute no terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))'
```

Vai aparecer um texto longo no terminal. **Copie esse texto** — você vai usar ele no próximo passo.

### 2.2 — Crie o arquivo de configuração

Na pasta do projeto, copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Agora abra o arquivo `.env` no seu editor de texto (VS Code, Bloco de Notas, etc) e preencha as informações:

#### Variáveis obrigatórias (primeira vez)

| Variável | O que é | O que colocar |
|----------|---------|---------------|
| `SETTINGS_ENCRYPTION_KEY` | A chave secreta que você gerou acima | Cole o texto copiado |
| `DATABASE_URL` | Endereço do banco de dados | Use o valor padrão do `.env.example` se for rodar localmente |
| `REDIS_URL` | Endereço do Redis | Use o valor padrão do `.env.example` se for rodar localmente |

#### Variáveis opcionais (só se você quiser usar esses recursos)

| Variável | O que é | O que colocar |
|----------|---------|---------------|
| `TELEGRAM_BOT_TOKEN` | Token do bot do Telegram para receber resumos diários | Veja a seção "Configurar Telegram" abaixo |
| `TELEGRAM_CHAT_ID` | Seu chat ID no Telegram | Veja a seção "Configurar Telegram" abaixo |
| `OPENAI_API_KEY` | Chave da OpenAI (para IA) | Veja a seção "Configurar IA" abaixo |
| `ANTHROPIC_API_KEY` | Chave da Anthropic (para IA) | Veja a seção "Configurar IA" abaixo |

> **Importante:** Se você não configurar nenhuma chave de IA agora, o sistema vai funcionar normalmente, mas algumas funcionalidades (como otimização de CV e análise de vagas) vão estar desligadas até você configurar.

---

## Passo 3 — Iniciar o sistema

A forma mais simples de iniciar tudo é com o comando:

```bash
./dev-up.sh
```

Esse script faz tudo automaticamente:
1. Verifica se as dependências estão instaladas
2. Sobe o banco de dados (PostgreSQL) e o cache (Redis) via Docker
3. Cria as tabelas no banco
4. Popula com dados iniciais (skills básicas do mercado)
5. Inicia o sistema
6. Mostra os logs na tela

Você vai ver uma mensagem como:
```
========================================
  Job Radar is running!
========================================

  API:  http://localhost:3001
  Web:  http://localhost:5173
  Docs: http://localhost:3001/health
```

### Parar o sistema

Quando quiser parar, pressione `Ctrl+C` no terminal.

Para parar tudo incluindo o banco de dados:
```bash
docker compose down
```

### Outros comandos úteis

| Comando | Para que serve |
|---------|---------------|
| `./dev-up.sh` | Inicia tudo e mostra logs |
| `./dev-up.sh --reset` | Apaga o banco e recomeça do zero (CUIDADO!) |
| `./dev-up.sh --no-logs` | Inicia sem mostrar logs (rode em outro terminal: `docker compose logs -f`) |
| `./dev-down.sh` | Para o sistema mas mantém o banco rodando |
| `docker compose down` | Para tudo, incluindo banco e cache |

---

## Passo 4 — Acessar o sistema

Abra o seu navegador e acesse:

```
http://localhost:5173
```

Na **primeira vez**, o sistema vai mostrar uma tela de **setup inicial** (wizard). Siga os passos:

1. **Perfil profissional** — Preencha suas informações básicas
2. **Skills e idiomas** — Adicione suas habilidades e níveis
3. **Experiência e formação** — Adicone seus empregos anteriores, cursos, certificados
4. **Preferências** — Configure como você quer buscar vagas

Depois de concluir, você é levado direto para o **Dashboard**.

---

## Primeiro acesso — Configurações essenciais

Depois do setup inicial, você pode ajustar tudo em **Configurações** (ícone de engrenagem no menu).

### Configurar provedor de IA (opcional mas recomendado)

A IA é usada para:
- Analisar vagas e calcular o match score
- Otimizar seu currículo para uma vaga específica
- Gerar resumos de descrições de vagas

Para configurar:

1. Acesse **Configurações** → Aba **IA**
2. Clique em **+ Adicionar**
3. Preencha:
   - **Nome:** um nome para você identificar (ex: "Minha OpenAI")
   - **Base URL:** o endereço da API
     - OpenAI: `https://api.openai.com/v1`
     - Anthropic: `https://api.anthropic.com`
     - Outro provedor compatível com OpenAI: verifique a documentação do provedor
   - **API Key:** sua chave de API
   - **Modelo:** o modelo a usar (ex: `gpt-4o-mini`, `claude-3-5-sonnet-20240620`)
4. Clique em **Testar** para verificar se está funcionando
5. Clique em **Criar**

> 💡 Você pode adicionar vários provedores e alternar entre eles a qualquer momento.

### Configurar fontes de vagas

Por padrão, algumas fontes já estão ativadas. Para gerenciar:

1. Acesse **Configurações** → Aba **Fontes**
2. Você verá uma lista de fontes com uma descrição de cada uma
3. Use os botões **Ativar** / **Desativar** para ligar ou desligar fontes
4. Algumas fontes precisam de credenciais adicionais:

#### LinkedIn via Apify (opcional)
- Clique em **LinkedIn via Apify**
- Você precisa de uma conta no [Apify](https://apify.com/)
- Cole o token API no campo indicado
- Clique em **Salvar Token**

#### Adzuna (opcional)
- Clique em **Adzuna**
- Cadastre-se gratuitamente em https://developer.adzuna.com/signup
- Cole o `App ID` e `App Key` nos campos indicados
- Clique em **Salvar Credenciais**

> 💡 Você não precisa configurar todas as fontes. O sistema funciona com pelo menos uma fonte ativa.

### Configurar agendamento automático

Para o sistema buscar vagas automaticamente:

1. Acesse **Configurações** → Aba **Cron**
2. Veja os dois agendamentos:
   - **Coleta de Vagas:** com que frequência buscar novas vagas (padrão: todo dia às 6h)
   - **Relatório Diário:** com que frequência enviar resumo no Telegram (padrão: todo dia às 18h05)
3. Altere os horários se quiser e clique em **Salvar**

> **Formato dos horários:** `minuto hora dia-do-mês mês dia-da-semana`
> - `0 6 * * *` = Todo dia às 6h
> - `*/6 * * * *` = A cada 6 horas
> - `0 9 * * 1-5` = Dias úteis às 9h

### Configurar Telegram (opcional)

Para receber resumos diários das melhores vagas no Telegram:

1. Abra o Telegram e busque pelo **@BotFather**
2. Envie o comando `/newbot`
3. Siga as instruções para criar o bot
4. O BotFather vai te dar um **token** (parece com `123456:ABC-DEF...`)
5. Volte ao Job Radar → **Configurações** → Aba **IA** (sim, a mesma aba)
6. Na seção "Configurações do Sistema", cole o token no campo correspondente
7. Para descobrir o seu **chat ID**:
   - Envie uma mensagem para o seu bot
   - Acesse `https://api.telegram.org/bot<SEU_TOKEN>/getUpdates`
   - Procure por `"chat":{"id":123456789` — esse número é o seu chat ID
8. Cole o chat ID no campo correspondente

---

## Usando o sistema no dia a dia

### Dashboard
A página inicial mostra:
- Quantas vagas você tem no sistema
- Quantas candidaturas estão em andamento
- As vagas com maior match score
- Vagas coletadas recentemente

### Vagas
- Clique em **Vagas** no menu
- Use os filtros para buscar por palavra-chave, modalidade, fonte, etc.
- Veja o **match score** (nota de 0 a 100) em cada vaga
- Clique em uma vaga para ver detalhes:
  - Descrição completa
  - Score breakdown (quais skills você tem, quais faltam)
  - Ações: avaliar match, adicionar à candidatura, otimizar CV

### Candidaturas (Kanban)
- Clique em **Candidaturas**
- Arraste os cards entre colunas para atualizar o status:
  - 🔵 Encontrada → 🟡 Interessante → 🟢 Aplicada → 🟠 Entrevista → 🟢🏆 Oferta ou 🔴 Rejeitada
- Clique em um card para ver detalhes e adicionar notas, contatos, salário

### Perfil
- Clique em **Perfil**
- Preencha todas as seções:
  - **Informações gerais:** título, senioridade, localização, modalidade
  - **Skills:** adicione tecnologias e seu nível
  - **Idiomas:** idiomas e nível
  - **Educação:** cursos, faculdades
  - **Certificados:** certificações
  - **Projetos:** projetos pessoais
  - **Experiência:** empregos anteriores
- Faça upload do seu **currículo** (PDF, DOC, DOCX ou TXT)

> 💡 Quanto mais completo estiver seu perfil, mais preciso será o match score.

### Otimizar CV
- Acesse **Otimizar CV**
- Selecione uma vaga (ou cole a descrição manualmente)
- Clique em **Otimizar**
- O sistema gera uma versão do seu currículo adaptada para a vaga
- Faça download do PDF

> **Atenção:** a IA só usa informações que já estão no seu perfil e currículo. Ela não inventa dados.

### Analytics
- Clique em **Analytics**
- Veja estatísticas: vagas coletadas, candidaturas, taxa de match, skills mais requisitadas

---

## Atualizando o sistema

Quando sair uma versão nova:

```bash
git pull
pnpm install
pnpm db:push
```

Se você modificou algo no código, as alterações serão mantidas. O `git pull` baixa as melhorias da comunidade.

---

## Licença e comunidade

O Job Radar é **software livre** licenciado sob a **GNU General Public License v3.0 (GPL-3)**.

Isso significa que:
- Você pode usar, modificar e distribuir este software livremente
- Qualquer modificação ou trabalho derivado deve ser distribuído sob a **mesma licença**
- O código fonte deve estar disponível para os usuários
- Créditos devem ser mantidos

Em outras palavras: se você melhorar o Job Radar e compartilhar essa versão, ela também tem que ser GPL-3 para que outras pessoas possam se beneficiar da sua melhoria. Isso garante que o projeto continue sendo um bem da comunidade.

---

## Problemas comuns

### A porta 3001 ou 5173 já está em uso

Feche o outro programa que está usando essa porta, ou altere no arquivo `.env`:

```env
PORT=3001
VITE_API_URL=http://localhost:3001
```

### Banco de dados não conecta

Verifique se o Docker está rodando:

```bash
docker compose ps
```

Se não estiver:

```bash
docker compose up -d
```

### Vagas não aparecem

Verifique se as fontes de vaga estão habilitadas em **Configurações > Fontes**.

### Erro ao gerar PDF / otimizar CV

Verifique se o provedor de IA está configurado em **Configurações > IA**.

### Chave de API não funciona

Verifique se a chave foi colada corretamente e se o provedor está ativo nas configurações.

---

## Suporte

Se você encontrar problemas:
1. Verifique a seção "Problemas comuns" acima
2. Consulte a documentação em `CONTEXT.md`
3. Abra uma issue no repositório do projeto
