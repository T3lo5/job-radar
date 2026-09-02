# Sprint 002 — Otimização de CV para ATS

**Data:** 2026-09-02  
**Objetivo:** permitir que o usuário gere uma versão otimizada do seu CV para uma vaga específica, usando apenas os dados reais do seu perfil, sem inventar informações.  
**Critério de conclusão:** usuário consegue selecionar uma vaga ou colar uma descrição, clicar em "Otimizar CV" e receber um PDF otimizado para ATS, baseado no seu perfil e CV original.

---

## Visão geral do fluxo

1. Usuário preenche o perfil com dados reais (skills, experiências, educação, certificações, projetos)
2. Usuário faz upload do CV base (PDF/DOCX)
3. Usuário seleciona uma vaga ou cola a descrição da vaga alvo
4. Sistema combina:
   - Dados do perfil (fonte da verdade)
   - CV base (texto extraído)
   - Descrição da vaga
5. IA otimiza o CV mantendo apenas dados reais do usuário
6. Sistema gera PDF otimizado

---

## Tarefas

### P0 — Fundamentos

- [ ] 1. Revisar e garantir que o `Profile` no Prisma tem todos os campos necessários para gerar CV
- [ ] 2. Revisar `CvOptimizer` (services/ai/cv-optimizer.ts) para garantir que usa dados reais do perfil
- [ ] 3. Garantir que `CvParser` extrai corretamente dados do PDF original
- [ ] 4. Verificar se `pdf-export.ts` gera PDFs corretamente

### P1 — Backend: endpoints e serviços

- [ ] 5. Criar `POST /api/cv/optimize` que recebe:
  - `resumeId` (opcional, usa CV default se não informado)
  - `jobDescription` (texto da vaga)
  - `jobId` (opcional, para buscar descrição de vaga existente)
- [ ] 6. Implementar serviço `CvOptimizationService` que:
  - Busca dados do perfil (source of truth)
  - Busca CV base (rawText)
  - Busca descrição da vaga (se jobId fornecido)
  - Chama `CvOptimizer` com todos os dados
  - Retorna texto otimizado + lista de alterações
- [ ] 7. Implementar geração de PDF otimizado:
  - Template de CV profissional
  - Usar `pdfkit` (já instalado)
  - Salvar como `ResumeVersion` no banco
- [ ] 8. Criar `GET /api/cv/versions/:resumeId` para listar versões de CV
- [ ] 9. Adicionar validações e error handling

### P2 — Frontend: interface

- [ ] 10. Criar página `cv-optimizer.tsx` ou seção no `job-detail.tsx`
- [ ] 11. Permitir selecionar vaga existente OU colar descrição manual
- [ ] 12. Mostrar preview do CV otimizado antes de gerar PDF
- [ ] 13. Listar versões anteriores de CV otimizado
- [ ] 14. Permitir download do PDF otimizado

### P3 — Melhorias de perfil

- [ ] 15. Garantir que todos os campos do perfil são editáveis:
  - Experiências profissionais
  - Projetos pessoais
  - Certificações
  - Idiomas
  - Educação
  - Skills com nível
- [ ] 16. Adicionar seção de "Dados para CV" no perfil
- [ ] 17. Permitir marcar um CV como "CV principal"

---

## Estrutura de arquivos

```
apps/api/src/
├── services/
│   ├── cv-optimization-service.ts  # NOVO - orquestra otimização
│   └── ai/
│       ├── cv-optimizer.ts          # existente - prompt e parse
│       └── cv-parser.ts             # existente - extrai dados do PDF
├── routes/
│   └── cv-optimizer.ts              # NOVO - endpoints de otimização
│   └── pdf-export.ts                # existente - geração de PDF
└── generated/prisma/schema.prisma    # verificar campos do perfil

apps/web/src/
├── pages/
│   ├── cv-optimizer.tsx             # NOVO - página de otimização
│   └── job-detail.tsx               # MODIFICAR - adicionar botão "Otimizar CV"
├── services/
│   └── api.ts                       # MODIFICAR - adicionar API client para CV optimizer
└── components/
    └── cv/                          # NOVO - componentes de CV
        ├── cv-preview.tsx
        ├── cv-form.tsx
        └── cv-versions.tsx
```

---

## Critérios de aceite

- [ ] Usuário consegue otimizar CV para uma vaga em até 3 cliques
- [ ] CV otimizado contém APENAS dados reais do usuário (sem invenções)
- [ ] PDF gerado é formatado profissionalmente
- [ ] Versões anteriores são mantidas para comparação
- [ ] Funciona offline para perfis já configurados (com IA provider ativo)

---

## Não entra no sprint

- [ ] Integração com LinkedIn para puxar vagas diretamente
- [ ] Sugestão automática de vagas para otimizar
- [ ] Múltiplos templates de CV
- [ ] Histórico de alterações detalhado (diff)

---

## Dependências externas

- IA provider configurado e ativo (OpenAI-compatible)
- `pdfkit` já instalado no projeto
- Perfil do usuário preenchido com dados reais
