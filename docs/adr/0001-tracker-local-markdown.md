# ADR 0001: Tracker local em markdown

## Status

Aceito (2026-08-31)

## Contexto

Para usar os skills `wayfinder`, `triage`, `to-spec`, `to-tickets` etc., é preciso definir onde vivem as "issues" deste repositório. Opções:

1. **GitHub Issues** (via `gh` CLI) — padrão da indústria, mas exige GitHub remote configurado e `gh` autenticado
2. **GitLab Issues** (via `glab`) — similar, mas em GitLab
3. **Local markdown** — issues são arquivos em `.scratch/<feature>/issues/NN-<slug>.md`
4. **Jira/Linear** — ferramentas externas

## Decisão

Tracker **local markdown** sob `.scratch/job-radar/`.

## Razões

- Repositório ainda sem `git remote` configurado
- É um sistema pessoal — não há necessidade de colaboração externa
- Funciona offline
- Tickets versionados junto com o código (git history)
- Zero dependências externas (não precisa de `gh`, `glab`, ou API keys de trackers)
- Os skills do matt-pocock foram desenhados para funcionar com qualquer um dos 3 primeiros

## Consequências

- Tickets são arquivos markdown. Sem UI web nativa — abrir pelo editor ou pelo git
- Não há notificações automáticas de mudanças em tickets
- "Compartilhar" um ticket = compartilhar um arquivo .md
- Se um dia virar projeto open source ou multi-colaborador, será preciso migrar para GitHub Issues (boa migração: cada `.md` vira um issue body)
