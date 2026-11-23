# 27 — Correções de fontes e normalização

Status: resolved
Sprint: 1
Prioridade: P2
Área: api
Esforço: médio
Origem: [auditoria §5.4–5.7, 5.29](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

Cinco defeitos de coleta/normalização geram dados errados ou risco de segurança:

1. Salário da Adzuna Brasil sai como USD.
2. Localização "Cambridge"/"Brisbane" casa com o filtro Brasil por `includes('br')`.
3. LinkedIn monta URL com `join('%20')`, quebrando com `&`, `#` e acento.
4. Apify manda token na query string e aceita `baseUrl` arbitrário.
5. `jsdom` é importado sem estar declarado em `dependencies`.

## Evidência

- `apps/api/src/sources/adzuna.ts:103` + `apps/api/src/sources/normalizer.ts:148` — moeda.
- `apps/api/src/utils/location-filter.ts:296-300` — `includes('br')`.
- `apps/api/src/sources/linkedin.ts:25,33` — `join('%20')`.
- `apps/api/src/sources/reddit.ts:46-54` — token na query e `baseUrl` livre.
- `apps/api/src/sources/normalizer.ts:3` — `jsdom` sem dependência declarada.

## Correção

1. Passar `currency: 'BRL'` para `country=br` e normalizar o valor no normalizer.
2. Comparar localização por tokens/país, não por substring; adicionar casos "Cambridge", "Brisbane", "Brasília".
3. Usar `new URL()` + `searchParams.set` no LinkedIn.
4. Apify: header `Authorization: Bearer` e allowlist de host.
5. Declarar `jsdom` em `dependencies` (ou remover o import).

## Critérios de aceite

- [x] Vaga brasileira da Adzuna é salva em BRL.
- [x] "Cambridge, UK" não passa no filtro Brasil; "Campinas, BR" passa.
- [x] Busca no LinkedIn com `&` e acento preserva os termos.
- [x] Token do Apify não aparece em log/URL.
- [x] `jsdom` resolvido sem depender de transitiva.

## Testes

- Fixtures de resposta por fonte com os casos acima.
- Teste de URL do LinkedIn com caracteres especiais.

## Comments

- 2026-10-28 — Correções de fontes e normalização.
  - **Adzuna/BRL**: `fetchAdzuna` passa `currency: 'BRL'` (o país da busca é fixo em `br`). `normalizeJobFields` ganhou `currency` opcional, aceita só código ISO de 3 letras e ele vence o símbolo do texto; sem ele, `"8000-12000"` continuava caindo no default USD. O parse de salário passou a acontecer uma vez só (antes era chamado três vezes).
  - **Filtro de localização**: `createLocationFilter` deixou de usar `preferred.includes('br')` e a comparação da lista virou `locationTokens`/`matchesLocation`. Códigos de país/estado de até 3 letras só casam como token inteiro; nomes longos seguem por substring. Resultado: "Cambridge, UK" e "Brisbane" não passam mais como Brasil; "Campinas, BR" e "Brasília" passam. Siglas de estado (`sp`, `rj`, `mg`…) entraram na lista para preservar "Híbrido - SP" sem depender do "br" dentro de "hibrido".
  - **LinkedIn**: a URL é montada com `new URL()` + `searchParams`, então `&`, `#` e acento ficam dentro do valor `keywords` em vez de quebrar a query. Um termo como `react&location=Ukraine` não injeta parâmetro.
  - **Apify**: token vai em `Authorization: Bearer`, nunca na query. `resolveApifyBaseUrl` aceita apenas `https://api.apify.com/...`, rejeita credenciais embutidas e descarta query/hash da configuração (que poderiam carregar token). `baseUrl` inválida falha com aviso genérico, sem ecoar o valor — e sem fazer a requisição.
  - **jsdom**: o import direto saiu. `isomorphic-dompurify` já entrega o DOMPurify ligado ao jsdom/DOM; não há mais dependência de transitiva para o código compilar em runtime.
  - Testes: `adzuna.test.ts` (3) com fixture de resposta brasileira afirmando BRL; `linkedin.test.ts` (3) cobre `&`, `#`, acento e injeção de parâmetro; `reddit.test.ts` (7) garante token só no header, allowlist de host, descarte de query e recusa de http/host estranho; `normalizer.test.ts` (+3) cobre moeda explícita, precedência e ausência de salário; `location-filter.test.ts` (+5) cobre Cambridge/Brisbane/Campinas/Brasília, preferência "Cambridge, UK" e fallback por descrição.
  - Verificação: API typecheck=0 lint=0 (105 warnings já existentes) test=438; web typecheck=0 lint=0 test=96 build=0; shared lint=0 test=23.
