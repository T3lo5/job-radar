# 31 — Kit da candidatura

Status: ready-for-agent
Sprint: 2
Prioridade: P1
Área: fullstack
Esforço: médio
Origem: [auditoria §7.4](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

Para aplicar hoje, o usuário navega entre quatro telas: vagas, detalhe, perfil e candidaturas. CV otimizado, carta, keywords, contato, status, follow-up e ATS usado vivem em lugares diferentes e não existe anexo por candidatura nem export.

## Evidência

- `apps/web/src/pages/job-detail.tsx` — CV, carta e keyword gap separados do Kanban.
- `apps/web/src/pages/applications.tsx` — status e ATS usados sem vínculo com os artefatos.
- `apps/web/src/pages/profile.tsx` — perfil em outra rota.
- Nenhum endpoint de anexo por candidatura.

## Correção

1. Tela/aba "Kit" por vaga, consolidando: CV otimizado, carta, keywords faltantes, contato do recrutador, status, follow-up e ATS usado.
2. Anexos por candidatura (carta, portfólio, outros) com upload e remoção; reutilizar o storage de CVs.
3. Export da candidatura em CSV/JSON (incluindo artefatos e histórico).
4. Deep link para o kit a partir da lista, do Kanban e do detalhe.
5. Estados de carregamento/erro por bloco, sem bloquear a tela inteira.

## Critérios de aceite

- [ ] O usuário aplica sem sair da tela do kit.
- [ ] Anexo enviado aparece na candidatura e pode ser removido.
- [ ] Export gera CSV/JSON com todos os campos do kit.
- [ ] Cada bloco tem loading e erro independentes.
- [ ] Nenhum dado é duplicado entre perfil e kit (referência, não cópia).

## Testes

- Teste de integração: criar candidatura → anexar → exportar → conferir conteúdo.
- Teste de componente: bloco com erro não derruba os demais.

## Comments
