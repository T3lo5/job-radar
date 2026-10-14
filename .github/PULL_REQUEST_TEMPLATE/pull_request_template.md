## O que muda e por quê

<!-- 1-3 frases. O "porquê" importa mais que o "o quê". -->

## Como foi verificado

<!-- Comandos e resultados. Ex.: suíte 3x estável, medição antes/depois, teste que falha sem o fix. -->

-
-

## Checklist

- [ ] `pnpm typecheck` limpo nos 3 workspaces
- [ ] `pnpm lint` sem erros e format ok
- [ ] `pnpm test` verde (inclui banco de teste p/ integração — ver CONTRIBUTING.md)
- [ ] `pnpm build` com smoke test passando
- [ ] Commits em Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `perf:`, `chore:`)
- [ ] Teste de regressão que **falha sem o fix** (para bugfix)
- [ ] README atualizado (se mudou comportamento visível)
- [ ] CHANGELOG.md atualizado (seção Unreleased)
- [ ] Sem segredos (`.env`, chaves, tokens, cookies)
