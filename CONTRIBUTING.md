# Contributing to Job Radar

Obrigado por considerar contribuir! 🎉

## Como Contribuir

### Reportando Bugs

1. Verifique se já não existe uma [issue](../../issues) para o bug
2. Use o template **Bug report** (ele pede o essencial):
   - O que você esperava vs o que aconteceu
   - Onde (página/ação) e como reproduzir
   - Texto exato de toasts/erros e, se houver, o trecho do log da API
   - Navegador, OS, e se roda via `./dev-up.sh` ou Docker
3. Para bug visual, um print vale mais que mil palavras

### Sugerindo Features

1. Abra uma issue com o template **Feature request**
2. Descreva o problema que a feature resolve (antes da solução)
3. Explique a solução proposta e o impacto em compatibilidade

### Pull Requests

#### Antes de começar

```bash
# 1. Fork o repo
# 2. Clone seu fork
git clone https://github.com/SEU-USUARIO/job-radar.git
cd job-radar

# 3. Crie branch descritiva
git checkout -b feat/minha-funcionalidade
# ou
git checkout -b fix/corrigir-bug-xyz
```

#### Banco de teste (obrigatório para testes de integração)

```bash
docker compose up -d postgres
docker compose exec -T postgres psql -U jobradar -d postgres -c "CREATE DATABASE jobradar_test"
DATABASE_URL=postgresql://jobradar:jobradar@localhost:5432/jobradar_test \
  pnpm --filter @job-radar/api exec prisma migrate deploy
```

Sem isso, os testes de integração falham em vez de pular — de propósito: pular seria verde sem verificar nada.

#### Padrões de código (rode ANTES de commit)

```bash
pnpm format        # Prettier (o CI cobra --check)
pnpm lint          # ESLint, zero erros
pnpm typecheck     # TS estrito nos 3 workspaces
pnpm test          # 324 testes devem passar
pnpm build         # build + smoke test do artefato
```

#### Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat: adiciona filtro por senioridade nas vagas
fix: corrige 404 da busca do Indeed Brasil
docs: atualiza README com deploy Docker
refactor: extrai resolvedor de skills da extração
test: adiciona teste de regressão para data vazia
perf: agrega analytics no banco em vez de JS
chore: atualiza dependências
```

Boas práticas deste repo (aprendidas do jeito difícil):

- **Meça antes de otimizar** — dois "gargalos" viraram não-problema após medição; o ganho real veio de outro lugar
- **Teste que passa com o bug é decoração** — quebre o código de propósito e confirme que o teste falha
- **Não invente número** — contagem desconhecida se reporta como contagem, nunca como chute rateado
- **Comentário conta o porquê**, não o quê — especialmente premissas que sustentam um recorte e armadilhas que o teste trava

#### Checklist do PR

- [ ] Testes passam (`pnpm test`)
- [ ] TypeScript sem erros (`pnpm typecheck`)
- [ ] Lint limpo (`pnpm lint`) e format ok
- [ ] Commits seguem Conventional Commits
- [ ] Teste de regressão para o bug corrigido (que falha sem o fix)
- [ ] Documentação atualizada se mudou comportamento visível (README)
- [ ] CHANGELOG.md atualizado (seção Unreleased)
- [ ] Sem segredos no código (`.env`, chaves, tokens, cookies do LinkedIn)

### Estrutura de Branches

| Branch       | Propósito                                  |
| ------------ | ------------------------------------------ |
| `main`       | Produção (protegida, CI verde obrigatório) |
| `feat/*`     | Novas features                             |
| `fix/*`      | Correções de bug                           |
| `docs/*`     | Documentação                               |
| `refactor/*` | Refatoração sem mudar comportamento        |
| `test/*`     | Só testes                                  |
| `chore/*`    | Manutenção                                 |

### Revisão de Código

- Mínimo 1 aprovação para merge
- CI deve passar (lint, typecheck, format, build, testes com Postgres)
- Resolva todos os comentários antes do merge

---

## Setup de Desenvolvimento

```bash
./dev-up.sh            # tudo: infra + migrate + seed + API + Web
./dev-up.sh --no-logs  # sem seguir logs
pnpm dev               # alternativa: API + Web em paralelo
```

- Web: http://localhost:5173 · API: http://localhost:3001 · Health: http://localhost:3001/health
- O script limpa watchers órfãos do projeto sozinho (adeus `EADDRINUSE`)
- **Nunca** use `--reset` num banco com dados que importam — ele apaga tudo

---

## Adicionando uma fonte de vaga

1. Crie o arquivo em `apps/api/src/sources/` implementando `JobSource` (`@job-radar/shared`)
2. Registre em `apps/api/src/sources/index.ts`
3. Teste a URL montada com curl antes ("ela existe?" antes de "ela responde?")
4. Adicione teste da URL/parâmetros com `fetchWithTimeout` mockado (ver `indeed.test.ts`)
5. Se precisar de credencial, siga o padrão Apify/Adzuna (settings criptografados + campos na UI)

---

## Áreas que Precisam de Ajuda

- 🌐 **i18n** — PT-BR/EN no frontend
- ♿ **Acessibilidade** — WCAG nas páginas e no Kanban
- 🧪 **Testes de componente** — `@testing-library/react` (hoje só lógica pura tem teste no web)
- 📦 **Empacotamento fácil** — instaladores para usuários não técnicos (Electron/Tauri)
- 🔌 **Fontes** — mais boards com teste de URL
- 🌙 **Tema escuro** — respeitar `prefers-color-scheme`

---

## Código de Conduta

Este projeto segue o [Contributor Covenant](https://www.contributor-covenant.org/). Veja [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Licença

Toda contribuição é redistribuída sob **GPL-3.0** (ver [`LICENSE`](LICENSE)). Ao contribuir, você concorda com isso.

## Dúvidas?

- Abra uma [issue](../../issues/new/choose) com o template de feature/pergunta
- Docs técnicas: `CONTEXT.md`, `docs/adr/`, `AGENTS.md`

Obrigado por contribuir! 🚀
