# Changelog

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/). Versões em `Unreleased` viram release quando há marco para celebrar, não por calendário.

## [Unreleased]

### Corrigido

- Piso Node >= 22.19 (`undici@8` via jsdom exige; CI em Node 20 quebrava
  os testes web com `webidl.util.markAsUncloneable is not a function`)

## [0.1.0] - 2026-10-14

### Adicionado

- Painel de resultado da coleta/processamento (contagem, erros por fonte, cronômetro de progresso)
- Tela de Uso de IA em Configurações (custo por operação, 7/30/90 dias)
- Verificação programática da Regra de Ouro ("IA não inventa", com rejeição e aviso)
- Upload de CV com extrator reserva (`unpdf` + `pdf-parse`) e mensagem acionável
- Templates de issue (bug/feature) e de PR
- Manual completo no README; `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`

### Corrigido

- IDs de job do pipeline com `:` (BullMQ rejeita; `process-all` dava 500)
- CI gera o cliente Prisma e builda o `shared` antes do typecheck (clone
  fresco quebrava com ~70 erros em cascata); CI também roda em tags `v*`
- Busca do Indeed Brasil usava `/vagas` (404 sempre) em vez de `/jobs`
- Selo "Requer credenciais" indevido no LinkedIn público
- Edição de perfil: datas vazias davam 400; salário com ponto de milhar gravava errado; "aplicar CV" sobrescrevia título/resumo; skill duplicava por caixa
- Senioridade salva não aparecia selecionada (campos `seniority`/`seniorityList` divergidos)
- Descrição da candidatura abria em HTML cru em vez de leitura
- Tipos do `shared` divergidos dos enums do Prisma; `MatchBreakdown.other` removido

### Performance

- Coleta: ~800 queries → 3 por fonte (lote + `skipDuplicates`)
- Extração: 2 queries por skill → 3 no total (resolvedor em lote, sem duplicatas por caixa)
- Matching: sem leitura do catálogo inteiro (recorte derivado no motor)
- Analytics: 169ms → 20ms (agregação no banco, `?days` validado 1–365)

## Sprints anteriores (resumo)

- **F** — Regra de Ouro verificada; pipeline marca `FAILED` com log e repropaga; idempotência por `jobId` determinístico
- **E** — Timeouts em todos os fetches; shutdown gracioso; BullMQ com `REDIS_URL` completa; volume de uploads
- **D** — Integridade de dados (salário, remoto, skills C++/C#, classificação cloud, Google Jobs URL, filtro de país)
- **C** — Segurança + login real (scrypt, sessões opacas revogáveis, HttpOnly, wizard com criação de conta)
- **B** — Features quebradas (PDF, datas de educação, edição de provedor, cron, `trackedJobs`)
- **A** — Build de produção, drift schema↔migration, CI vermelho, cliente Prisma fora do git
