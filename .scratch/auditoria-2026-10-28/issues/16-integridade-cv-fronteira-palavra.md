# 16 — Integridade de CV por fronteira de palavra

Status: resolved
Sprint: 1
Prioridade: P1
Área: api
Esforço: baixo
Origem: [auditoria §4.4](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

A "Regra de Ouro" do produto (`CONTEXT.md`: a IA não inventa experiência) é garantida apenas pelo prompt. A checagem em código usa `String.includes`, então "Go" passa porque "Google" contém "go", "Java" passa porque "JavaScript" contém "java", e "R" passa em qualquer texto com a letra r. A promessa central não está implementada.

## Evidência

- `apps/api/src/services/cv-integrity.ts:52-66` — comentário diz "fronteira de palavra", código usa `knownTerms.includes(normalized)`.
- `CONTEXT.md` — promessa de não inventar skills.
- Casos reproduzíveis: `Go`/`Google`, `Java`/`JavaScript`, `R`/qualquer texto.

## Correção

1. Tokenizar o texto (Unicode-aware) e comparar termos por igualdade de token, não por substring.
2. Usar o catálogo de skills + aliases como fonte da verdade (`packages/shared` ou seed de skills), com normalização de caixa, hífen e pontuação.
3. Para termos com pontuação (`Node.js`, `C++`, `C#`, `.NET`, `CI/CD`), normalizar para uma forma canônica antes de comparar.
4. Retornar evidência por termo: onde foi encontrado e qual alias casou.
5. Expor o resultado na UI do CV ("termos verificados", "termos não encontrados").

## Critérios de aceite

- [x] "Go" não é rastreado em texto que só contém "Google".
- [x] "Java" não é rastreado em texto que só contém "JavaScript".
- [x] "R" não é rastreado em texto genérico.
- [x] "Node.js", "Node", "C++", "C#", ".NET" e "CI/CD" funcionam com seus aliases.
- [x] Testes cobrem os três falsos positivos e os casos compostos.

## Testes

- Tabela de casos em `cv-integrity.test.ts`: termo, texto, esperado.
- Teste de propriedade: nenhum termo de 1–2 letras casa por substring.

## Comments

- 2026-10-28 — Comparação trocada de `includes` para token + alias.
  - `tokenize` usa regex Unicode de letras/dígitos depois de remover acentos; `C++`, `C#` e `.NET` viram um token só (`cplusplus`, `csharp`, `dotnet`), e `CI/CD`/`CI-CD` são cobertos pelo grupo de alias.
  - Grupos de equivalência explícitos (`ALIAS_GROUPS`) cobrem Node.js/Node/NodeJS, React/React.js, C#/CSharp/C-Sharp, C++/Cpp/CPlusPlus, .NET/dotnet/ASP.NET, CI/CD/CICD/continuous integration, além de Postgres, K8s, AWS e GCP. Aliases genéricos foram deliberadamente deixados de fora (ex.: "next"), porque reabririam o falso positivo que o ticket corrige.
  - A checagem procura a sequência de tokens contígua, então "full-stack" casa com "Full Stack" e "Go" não casa com "Google"; termos de 1 caractere continuam rejeitados.
  - `IntegrityResult` ganhou `keywordEvidence`/`skillEvidence` (termo, alias que casou e índice da fonte). A resposta de `/api/cv/optimize` passou a devolver `keywordsDropped` e `keywordEvidence`, e a tela do CV separa "Termos verificados" de "Termos não encontrados (removidos)".
  - Testes: `cv-integrity.test.ts` cresceu de 10 para 43 casos, com tabela de falsos positivos, tabela de compostos/aliases e teste de termos de 1–2 letras.
  - Verificação: API typecheck=0 lint=0 test=314; web typecheck=0 lint=0 test=84 build=0.
