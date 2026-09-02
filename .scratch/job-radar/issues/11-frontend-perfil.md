# 11 — Página "Meu Perfil" no frontend

## Question

Tela com:

- Dados pessoais (nome, contato)
- Cargo desejado + senioridade
- Pretensão salarial (min/max)
- Idiomas (com nível)
- Formação + certificações + projetos (listas dinâmicas)
- Gerenciamento de skills: input com autocomplete (do banco), nível (1-5), anos de experiência
- Cargos desejados, localidades, modalidade, faixa salarial, techs prioritárias

react-hook-form + zod. TanStack Query para mutations.

## Type

task

## Status

done

## Resolution

**Página de Perfil** (`apps/web/src/pages/profile.tsx`) com:

**Formulários react-hook-form + zod:**
- Informações gerais: título, senioridade, localização, modalidade, salário, resumo
- Skills: adicionar com nome, nível (beginner→expert), anos de experiência
- Remover skill com botão ×

**Seções visualizáveis:**
- Skills com nível e anos
- Idiomas
- Educação (grau, campo, instituição)
- Certificações (nome, emissor, data)
- Projetos (nome, descrição, skills relacionadas)

**Estado:**
- Toggle entre visualização/edição
- Mutations com TanStack Query (update, addSkill, removeSkill)
- Invalidação de cache após mudanças

**Validação:**
- `pnpm typecheck` ✓
