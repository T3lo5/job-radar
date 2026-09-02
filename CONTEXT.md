# CONTEXT.md

Glossário de termos do domínio do Job Radar. Skills (`grill-with-docs`, `domain-modeling`) usam este arquivo para alinhar vocabulário.

## Conceitos centrais

- **Vaga (Job)**: Oportunidade de emprego coletada de uma fonte. Estado canônico: `raw` → `extracting` → `matching` → `analyzing` → `done` (ou `failed`).
- **Fonte (JobSource)**: Adapter que busca vagas em uma plataforma externa (Adzuna, RemoteOK, etc.). Implementa a interface `JobSource`.
- **Perfil (Profile)**: Representação estruturada do candidato. Fonte da verdade para matching.
- **Match**: Resultado de comparar uma vaga com o perfil. Produz score 0-100 e breakdown por critério.
- **Score de aderência (Match Score)**: Número 0-100 que indica quão bem o perfil se encaixa na vaga. Calculado pelo matching engine.
- **Análise IA (AI Analysis)**: Output estruturado do LLM para uma vaga + perfil: resumo, pontos fortes, gaps, riscos, recomendação.
- **Orquestrador de Pipeline (PipelineOrchestrator)**: Coordena a transformação de uma vaga pelo estágio `raw` → `done`. Executa steps sequenciais: extração (extraction) → matching → análise (analysis). Cada step é injetável e possui fallback que não requer IA.
- **Candidatura (Application)**: Quando o usuário decide aplicar para uma vaga. Tem ciclo de vida próprio (status). Geralmente inicia em `interessante` (quando o usuário marca interesse) e avança até `aplicada`, `entrevista`, `oferta` ou `rejeitada`.
- **Evento de candidatura (ApplicationEvent)**: Registro imutável de uma mudança de status de candidatura (`fromStatus` → `toStatus` com `note` opcional). Forma um histórico auditável.
- **CV Otimizado (Resume Version)**: Versão do CV adaptada para uma vaga específica. Nunca pode conter informações não presentes no CV original.
- **Gap**: Skill ou requisito da vaga que o candidato não possui. Nunca deve ser mascarado.

## Skills e Senioridade

- **Senioridade**: Nível profissional. Valores canônicos: `estagiário`, `júnior`, `pleno`, `sênior`, `especialista`, `lead`. Inferida do perfil/vaga.
- **Skill**: Tecnologia ou competência. Catálogo global em `skills`. Pode ser mapeada com sinônimos (ex: "Node" → "Node.js").
- **Match exato**: Skill do candidato idêntica à pedida (após normalização de sinônimos).
- **Match parcial**: Skill relacionada (ex: "React" para vaga pedindo "React Native"). Contribui com peso reduzido.
- **Match ausente**: Skill da vaga que o candidato não tem. Conta como gap.

## Faixas de Match

- 🔥 **Excelente** (90-100): altíssima compatibilidade
- 🟢 **Muito boa** (80-89)
- 🟡 **Boa** (70-79)
- 🟠 **Possível** (60-69)
- 🔴 **Baixa** (<60)

## Estados de Candidatura

- 🔵 **Encontrada** (default)
- 🟡 **Interessante**
- 🟣 **CV preparado**
- 🟢 **Aplicada**
- 🟠 **Entrevista**
- 🔴 **Rejeitada**
- 🟢🏆 **Oferta**
- ⚫ **Arquivada**

## Regra de Ouro: A IA não inventa

A IA **nunca** pode:

- Inventar experiência profissional
- Inventar tecnologias que o candidato não tem
- Inventar empregos
- Inventar formação ou certificações
- Alterar datas profissionalmente relevantes
- Adicionar skills ao CV otimizado que não estavam no CV original

A IA **pode**:

- Reorganizar informações verdadeiras
- Melhorar redação
- Destacar experiências existentes
- Adaptar keywords
- Sugerir melhorias estruturais

## Configuração (Settings)

- **Setting (Configuração)**: valor configurável do sistema, organizado por **escopo** (`ai`, `telegram`, `cron`, `sources`)
- **Setting Secret**: valor sensível (API key, token) que é **criptografado em repouso** com AES-256-GCM usando a chave mestra `SETTINGS_ENCRYPTION_KEY` do `.env`
- **SettingsScope**: agrupamento lógico. Quatro escopos canônicos:
  - `ai`: provider, API key, model, prompt custom opcional
  - `telegram`: bot token, chat ID
  - `cron`: horário de coleta (`jobCollectionCron`), horário de relatório (`dailyReportCron`)
  - `sources.<sourceId>`: credenciais por fonte habilitada (ex: `sources.adzuna.appId`)
- **SettingsService**: ponto único de leitura. Cache em memória + Redis (TTL 30s) para multi-instance; invalida ao salvar via UI
- **Wizard de primeiro boot (`/setup`)**: aparece quando `settings.completed_at IS NULL`; após salvar, marca timestamp e libera o resto do app
- **Tela de Settings (`/settings`)**: sempre acessível para editar valores existentes
- **Settings Completion Gate**: middleware que bloqueia `/api/*` (exceto `/health` e `/api/setup`) até `completed_at` estar setado

### O que fica no `.env` vs no banco

- **`.env`** (crítico, imutável sem restart): `DATABASE_URL`, `REDIS_URL`, portas, `NODE_ENV`, `LOG_LEVEL`, `SETTINGS_ENCRYPTION_KEY`, `POSTGRES_PASSWORD`
- **Banco** (editável pela UI, hot-reload): tudo de IA, Telegram, Cron, credenciais de fontes

## Termos evitados

- "Match perfeito" → use "Match excelente (≥90)" (nada é perfeito)
- "Possui" sem evidência → use "atende" ou "atende parcialmente"
- "Variável de ambiente" quando se trata de setting editável → use "configuração" / "setting"
- "API key no env" → use "setting secret de IA" (deveria estar no banco)
