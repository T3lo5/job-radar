# 36 — Code splitting e virtualização

Status: ready-for-agent
Sprint: 3
Prioridade: P2
Área: web
Esforço: médio
Origem: [auditoria §5.23](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O bundle é um chunk único de **1.118 MB** (327 KB gzip), com 10 páginas carregadas eagerly. Em conexão móvel, o primeiro paint inclui telas que o usuário talvez nunca abra. Listas longas renderizam todos os itens.

## Evidência

- `apps/web/src/App.tsx:6-16` — imports eager das 10 páginas.
- `pnpm build` — chunk único de 1,1 MB.
- Listas de vagas/candidaturas sem virtualização.

## Correção

1. `React.lazy` + `Suspense` por rota.
2. `manualChunks` para vendor (react, radix, query, charts) e separar editor/markdown.
3. Virtualizar listas longas (Kanban por coluna, lista de vagas) com `@tanstack/react-virtual`.
4. Pré-carregar a rota provável no hover/foco do link.
5. Medir com `rollup-plugin-visualizer` e registrar orçamento de bundle no CI.

## Critérios de aceite

- [ ] Bundle inicial gzip < 200 KB.
- [ ] Nenhuma página fora da rota inicial entra no chunk principal.
- [ ] Lista com 1.000 itens mantém scroll fluido (sem renderizar 1.000 nós).
- [ ] Navegação entre rotas não recarrega o app.
- [ ] Orçamento de bundle documentado e verificado no CI.

## Testes

- Relatório de build com chunks separados.
- Teste de que a rota lazy renderiza após `Suspense`.

## Comments
