# Sprint 001 — Expansão de fontes + descrições na UI

**Data:** 2026-09-02  
**Objetivo:** deixar explícito, para o usuário, o foco de cada fonte, e aumentar cobertura de vagas sem depender só de scraping frágil.  
**Critério de conclusão:** ao abrir `Configurações > Fontes`, cada fonte mostra nome + descrição + toggle liga/desliga sem 404; novas fontes retornam dados normalizados no mesmo formato das existentes; falha em uma fonte não quebra a coleta das outras.

---

## Tarefas

### P0

- [ ] 1. Adicionar campo `description` na interface `JobSource`
- [ ] 2. Popular `description` em todas as fontes existentes
- [ ] 3. Atualizar endpoint `/api/admin/sources` para retornar `description`
- [ ] 4. Atualizar UI de Fontes para exibir `description`
- [ ] 5. Implementar `AdzunaSource` (API oficial, free tier 1k calls/mês)

### P1

- [ ] 6. Implementar `JobicySource` (API pública sem auth, remoto/tech)
- [ ] 7. Implementar `WeWorkRemotelySource` (RSS público)

### P2 / follow-up

- [ ] 8. Cadastrar novas fontes no array `SOURCE_IDS` do admin (feito junto com P0/P1)
- [ ] 9. Ajustar normalizador para campos específicos de cada fonte
- [ ] 10. Teste manual: coletar, desativar/ativar cada fonte na UI
- [ ] 11. (opcional) Teste automatizado para cada nova fonte

### Não entra no sprint

- [ ] Gupy, Programathor, Catho, Glassdoor — scrapers frágeis; só entram depois que as APIs estáveis estiverem rodando.

---

## Execução

### Task 1 — `description` na interface

**Arquivo:** `packages/shared/src/types/job-source.ts`

```ts
export interface JobSource {
  id: string;
  name: string;
  description: string;
  fetch(query: SourceQuery): Promise<NormalizedJob[]>;
}
```

### Task 2 — Popular `description` em todas as fontes

**Arquivo:** `apps/api/src/sources/index.ts`

```ts
class LinkedInSource implements JobSource {
  id = 'linkedin';
  name = 'LinkedIn';
  description = 'Busca em páginas públicas do LinkedIn Jobs via scraping guest. Cobertura limitada a ~100 vagas por query e sujeita a bloqueios.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchLinkedIn(query);
  }
}
```

Repetir padrão para todas as fontes registradas.

### Task 3 — Endpoint retorna `description`

**Arquivo:** `apps/api/src/routes/admin.ts`

Atualizar o mapeamento em `GET /api/admin/sources` para incluir `description`.

### Task 4 — UI exibe `description`

**Arquivo:** `apps/web/src/pages/settings.tsx`

Na listagem de fontes, exibir `source.description` como texto secundário abaixo de `source.name`.

### Task 5 — `AdzunaSource`

**Arquivo:** `apps/api/src/sources/adzuna.ts`

- Registrar em `apps/api/src/sources/index.ts`
- Adicionar `'adzuna'` em `SOURCE_IDS`
- Usar `developer.adzuna.com` com `app_id` e `app_key` via env/settings
- Mapear campos: title, company, description, location, salary_min/max, redirect_url

### Task 6 — `JobicySource`

**Arquivo:** `apps/api/src/sources/jobicy.ts`

- Registrar em `apps/api/src/sources/index.ts`
- Adicionar `'jobicy'` em `SOURCE_IDS`
- Usar `https://jobicy.com/api/v2/remote-jobs` (sem auth)
- Mapear campos: jobTitle, companyName, jobDescription, jobGeo, jobLevel, salaryMin/salaryMax

### Task 7 — `WeWorkRemotelySource`

**Arquivo:** `apps/api/src/sources/weworkremotely.ts`

- Registrar em `apps/api/src/sources/index.ts`
- Adicionar `'weworkremotely'` em `SOURCE_IDS`
- Usar RSS público `https://weworkremotely.com/remote-jobs.rss` ou categorias específicas
- Mapear campos: title, company, description, location, pubDate

---

## Notas

- Fontes novas devem seguir o contrato `JobSource` e retornar `NormalizedJob[]`.
- Erros em fetch devem ser capturados pelo orquestrador (`collectFromSource`) para não derrubar a coleta inteira.
- Taxas de limite/429 devem ser respeitadas com delays/backoff quando aplicável.
