# 10 — Atualizar DOMPurify

Status: resolved
Sprint: 0
Prioridade: P0
Área: web
Esforço: baixo
Origem: [auditoria §3.6](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

A versão de DOMPurify usada via `isomorphic-dompurify` está em faixa com bypass de `SAFE_FOR_TEMPLATES` e de hook em `IN_PLACE`. O projeto sanitiza HTML de descrições de vaga, conteúdo de terceiros — exatamente o cenário do bypass.

## Evidência

- `apps/web/package.json` / `apps/api/package.json` — `isomorphic-dompurify` resolvendo `dompurify@3.4.15`.
- `pnpm audit` — corrigido em `3.4.17+`.
- Uso de sanitização em descrições de vaga e conteúdo renderizado.

## Correção

1. Subir `isomorphic-dompurify`/`dompurify` para `>= 3.4.17`.
2. Verificar se o código usa `SAFE_FOR_TEMPLATES` ou `IN_PLACE`; se sim, revisar a necessidade.
3. Confirmar que a config de sanitização continua permitindo apenas as tags esperadas.

## Critérios de aceite

- [x] `pnpm why dompurify` mostra `>= 3.4.17` em todos os workspaces.
- [x] Sanitização de descrição de vaga continua funcionando (negrito, listas, links seguros).
- [x] Payloads de teste com `<script>`, `onerror` e template injection são neutralizados.
- [x] `pnpm audit` não reporta mais os advisories do DOMPurify.

## Testes

- Testes unitários de sanitização com payloads maliciosos conhecidos.
- Regressão visual leve: descrição com HTML válido continua renderizada.

## Comments

- 2026-10-28 — Atualizado: `dompurify@3.4.17` no web e `isomorphic-dompurify@4.6.0` na API, ambos resolvendo `dompurify@3.4.17` no lockfile.
  - O código não usa `SAFE_FOR_TEMPLATES` nem `IN_PLACE`; a config segue com allowlist de tags/atributos.
  - `apps/web/src/lib/sanitize.test.ts` (25 testes) cobre `<script>`, `onerror`, `javascript:`, `data-*`, `style`, payloads em camadas e preservação de HTML legítimo.
  - `pnpm audit` não aponta mais advisory direto de DOMPurify/isomorphic-dompurify.
