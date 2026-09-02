# 14 — Interface JobSource e primeira fonte

## Question

Definir interface TypeScript:

```ts
interface JobSource {
  id: string
  name: string
  fetch(query: SourceQuery): Promise<RawJob[]>
  normalize(raw: RawJob): NormalizedJob
}
```

`RawJob` é o que a fonte retorna (varia). `NormalizedJob` é o formato canônico (title, company, description, location, remote, salary, url, source, publishedAt).

**Primeira fonte a implementar**: decidir entre:

- **Adzuna API** (free tier, boa cobertura BR + mundial, fácil)
- **RemoteOK** (JSON público, sem auth, foco em remoto)
- **LinkedIn scrape** (instável, contra TOS, evitar para MVP)
- **Indeed via RapidAPI** (paga)

Recomendo **Adzuna** se quer cobertura geral, **RemoteOK** se quer começar só com remoto.

## Type

grilling

## Status

done

## Resolution

**Interface JobSource** definida em `@job-radar/shared`:
```ts
interface JobSource {
  id: string
  name: string
  fetch(query: SourceQuery): Promise<NormalizedJob[]>
}
```

**Tipos compartilhados** (`packages/shared/src/types/job-source.ts`):
- `NormalizedJob` — formato canônico (title, company, description, location, remote, salary, url, externalId, publishedAt, tags)
- `SourceQuery` — keywords, location, remoteOnly, limit
- `RemoteMode` — 'on_site' | 'hybrid' | 'remote' | 'unknown'

**Primeira fonte: RemoteOK** (sem auth, JSON público, foco em remoto):
- `apps/api/src/sources/remote-ok.ts` — fetch + normalize + parse salary
- `apps/api/src/sources/index.ts` — registry de sources com `getSource`, `getAllSources`, `collectFromSource`, `collectFromAllSources`
- Tratamento de erro por fonte (não derruba pipeline)
- Salary parsing para formato RemoteOK

**Decisões:**
- RemoteOK escolhida como primeira fonte (zero config, sem credenciais)
- Adzuna pode ser adicionada depois como segunda fonte (requer credenciais via settings)
- Native `fetch` (Node 20+) — sem deps extras para HTTP client

**Validação:**
- `pnpm typecheck` ✓
- `pnpm --filter @job-radar/shared build` ✓
