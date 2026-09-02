# ADR 0005: Configurações editáveis via UI (não via .env)

## Status

Aceito (2026-08-31, durante revisão pós-#03 a pedido do usuário)

## Contexto

Originalmente planejado no #06: variáveis como `AI_API_KEY`, `TELEGRAM_BOT_TOKEN`, crons e credenciais de fontes ficariam no `.env`. Isso obriga o usuário a editar texto em arquivo e reiniciar o app — fricção alta para um projeto pessoal "para usar", não "para desenvolver".

O usuário pediu que essas configurações sejam editáveis **via UI**, e o `.env` fique só com o mínimo crítico (connection strings, portas, NODE_ENV, chave mestra de criptografia).

## Decisão

Quatro escopos de configuração migram do `.env` para o banco, editáveis via UI:

1. **IA** (`ai.*`): provider, API key, model, prompt custom opcional
2. **Telegram** (`telegram.*`): bot token, chat ID
3. **Cron** (`cron.*`): horário de coleta, horário de relatório
4. **Fontes de vagas** (`sources.*.<credencial>`): chaves de API por fonte habilitada

O `.env` guarda apenas:

- `DATABASE_URL`, `REDIS_URL`
- `APP_PORT`, `APP_HOST`, `WEB_PORT`, `WEB_HOST`
- `NODE_ENV`, `LOG_LEVEL`
- `SETTINGS_ENCRYPTION_KEY` (chave mestra AES-256-GCM)
- Senhas do Postgres (`POSTGRES_PASSWORD` — obrigatório pelo `docker-compose`)

## Segurança

- Valores sensíveis (API keys, tokens) são **criptografados em repouso** com AES-256-GCM usando `SETTINGS_ENCRYPTION_KEY` do `.env`
- IV aleatório por valor; armazenado junto (`iv:tag:ciphertext`, base64)
- Chave mestra é a **única** coisa que o operador precisa proteger com cuidado — perda = re-configurar tudo pela UI
- Sem senha mestra por usuário (single-user, simplifica)

## Acesso

- **Wizard de primeiro boot**: se `settings.completed_at IS NULL`, frontend redireciona para `/setup`. Após salvar, marca `completed_at` e libera rotas
- **Tela Settings** (`/settings`): sempre acessível, edita valores existentes sem wizard
- Toda rota da API que precisa de config consulta via `SettingsService.get(scope)` que:
  - Mantém cache em memória (singleton no processo)
  - Persiste no Redis (chave `settings:<scope>`, TTL 30s) para consistência multi-instance
  - Invalida Redis + memória ao salvar via UI

## Consequências

- **Positivas**:
  - Onboarding trivial: clona, `docker compose up`, abre UI, configura
  - Mudanças de IA/Telegram/Cron não exigem restart
  - Compatível com multi-instance (cache Redis)
  - Valores sensíveis não ficam em texto plano no banco
- **Negativas**:
  - Toda config precisa de UI + endpoint + validação Zod
  - Operador ainda precisa proteger `SETTINGS_ENCRYPTION_KEY` no `.env` (mas é uma chave só)
  - Boot precisa carregar settings antes de aceitar requests (graceful: bloqueia `/api/*` exceto `/health` e `/api/setup` até `completed_at`)

## Compatibilidade

- Qualquer coisa que era `process.env.X` e virou config de banco precisa ser substituída por `settings.get('scope')`
- Tests/mocks precisam de helper para setar settings em memória

## Alternativas consideradas

- **`.env` texto plano**: rejeitado — fricção alta, expõe segredos no repositório se commitado
- **Criptografia com senha mestra do usuário (Q2 opção C)**: rejeitado — exige o usuário digitar senha a cada boot; UX ruim para sistema pessoal
- **Vault externo (HashiCorp Vault, Infisical)**: rejeitado — overengineering, requer infra extra
- **Manter IA/Telegram no .env, mover só Cron/Fontes**: rejeitado — quebra a consistência ("o que é configurável e o que não é?")

## Tickets impactados

- **#06** (env): reescrito para guardar só o mínimo crítico + `SETTINGS_ENCRYPTION_KEY`
- **#41** (NOVO): settings via UI — schema da tabela `settings`, criptografia, SettingsService, wizard `/setup`, página `/settings`, migração de valores que estavam planejados para o `.env`
- Tickets futuros que dependiam de env (#22 provider IA, #30 telegram, #33 cron, #14/15 fontes) passam a depender de #41 em vez de #06
