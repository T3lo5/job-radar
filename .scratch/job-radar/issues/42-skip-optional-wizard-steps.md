# 42 — UX de passos opcionais no wizard de setup

## Question

Conforme item "Not yet specified" do `map.md` (depende de #41):

> UX de "skipped" no wizard (passos 2 e 4 são opcionais — usuário pode voltar depois) — depende de #41

O wizard de setup (`/setup`) tem 5 passos: Conta → Perfil → IA → Cron → Concluir. Hoje todos são apresentados como obrigatórios sequenciais. Os passos 2 (Perfil) e 4 (Cron) deveriam ser opcionais: o usuário pode pular e configurar depois em `/settings`.

Decisões a tomar:

- **Botão "Pular" em todos os passos**: exceto o passo 0 (Conta, que é obrigatório para criar sessão) e o passo 4 (Concluir). O botão "Pular" avança direto para o último passo ou marca o setup como concluído com valores defaults?
- **Estados dos passos na navegação**: indicar visualmente quais passos são opcionais (ex: "(opcional)" no título do botão do passo)
- **Voltar depois**: se o usuário pular passos opcionais, o setup ainda deve ser marcado como completo (`completed_at` preenchido), permitindo acesso ao resto do app. Os valores pulados ficam em defaults e podem ser editados em `/settings`.
- **Validação**: o passo de Conta continua obrigatório (email + senha). Os demais não bloqueiam o `POST /api/setup/complete`.

## Blocked by

41 (Settings via UI frontend completo)

## Type

task

## Status

complete

## Resolution

**Passos opcionais no wizard (`/setup`):**
- Passo 1 (Perfil) e passo 3 (Cron) marcados como `optional: true`
- Título da navegação e do CardHeader mostra "(opcional)" nesses passos
- Botão "Pular" individual aparece nos passos opcionais (avança para o próximo)
- Botão "Pular" geral (pula tudo) mantido apenas em passos não-opcionais após a conta
- O `POST /api/setup/complete` funciona com valores defaults quando passos opcionais são pulados
- O passo 0 (Conta) continua obrigatório (cria sessão)
- `pnpm typecheck` ✓, `pnpm lint` ✓ (0 erros), `pnpm test` ✓ (103 passando)
