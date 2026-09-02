# repaint — Builder-Tool Distillation (Stitch / Bolt / v0 / Claude → one skill + one agent)

**Date:** 2026-06-23
**Status:** Design approved (scope C). Implementation pending `/plan`.
**Owner:** Lucas Santana
**Affects:** `SKILL.md`, `references/context-anchors.md`, `evals/`, the `repaint-builder` agent.

---

## 1. Goal

Study how the leading AI UI-builders (Google **Stitch**, StackBlitz **Bolt**, Vercel **v0**, **Claude Artifacts / Claude Design**) turn a prompt into UI, and fold their *portable* mechanisms into the existing **repaint** skill + `repaint-builder` agent — without any SaaS backend, hosted preview, Figma API, or fine-tuned model.

**Decision:** Scope **C** — implement all three distilled additions (design-spec lock + variants, registry read + token-lock, compile-clean contract + lint).

**Non-goal:** A new standalone product. repaint already *is* a self-contained UI-generation skill; this evolves it.

## 2. Key insight

All four tools share one spine:

> **ground → spec → generate → guarantee-runnable → iterate**

repaint already implements this spine (`research → token-spec gate → scaffold → build → slop-audit → browser-verify`). So the work is **not** a rebuild — it is **three sharpenings** at the points where the commercial tools are stronger than repaint today.

### What each tool contributes (filtered to the three chosen capabilities)

| Tool | Transferable core | Maps to capability |
|---|---|---|
| **Stitch** | Design-first: structured spec + **variants** before code; `DESIGN.md` grounding; multi-screen consistency lock. (Stitch's own design-first *canvas/JSON/Figma* layer is **not** ported — code-first is correct for an IDE skill.) | Design-then-code |
| **v0** | **Registry grounding** — inject *real* component/token context into the prompt *before* generation (not post-hoc); post-generation autofixer for imports/icons/TS. | Non-generic quality + compile-clean |
| **Claude Artifacts** | **Compile-clean contract** — import allowlist, inline assets, no build step, default-export/zero-props ⇒ *guaranteed runnable*. | Compile-clean |
| **Bolt** | run → read real errors → self-correct loop. **Already native** to `repaint-builder` (real shell + Playwright) — not rebuilt, only fed by the new lint. | (skipped — see §5) |

## 3. The design — three additions

Each addition states: source, what repaint does today, what is new, where it lives (skill vs agent), and acceptance criteria.

### Addition 1 — Design-spec lock + variants  *(design-then-code)*

- **Source:** Stitch (design-first + variants), v0 (intent → structure).
- **Today:** repaint produces a token spec inside Phase 1, but it is internal, single-direction, and not a stop-and-approve checkpoint.
- **New:** Phase 1 emits a compact, **reviewable** design spec — register + brand anchor + token table + layout intent + **2–3 named variant directions** (drawn from `references/context-anchors.md` §B). The skill **pauses for approval** before any code is written. Otherwise stay code-first (no Figma/JSON canvas).
- **Skill:** new explicit gate — *"Design-spec lock: present spec + variants, await selection."*
- **Agent:** `repaint-builder` receives the *locked* spec and builds only that direction.
- **Acceptance:** for a build prompt, output includes a spec block + ≥2 distinct variant directions before code; code matches the selected variant's tokens.

### Addition 2 — Registry read + token-lock  *(non-generic quality, multi-surface consistency)*

- **Source:** v0 registry pattern (inject real tokens before generation), Stitch `DESIGN.md` grounding + multi-screen consistency, Claude Design tokens.
- **Today:** repaint defers to design systems loosely via eval guards and reads `context-anchors.md`; it already ships fixtures `evals/files/DESIGN.md` + `evals/files/components.json`. But there is no explicit "load the project's design system as a registry and **lock** those tokens across every surface in the session."
- **New:** an explicit **registry loader** — if the project has `DESIGN.md` / design-tokens / `components.json` / a Tailwind config, those tokens **override** repaint's defaults (reference-grounding *before* generation), plus a **session token-lock** so a later "now build the settings page" reuses the same locked palette/type/spacing.
- **Skill:** Phase-1 *"registry read & lock"* step; precedence rule **project tokens > anchors > 2026 defaults**.
- **Agent:** applies the locked tokens; never invents a parallel OKLCH palette (already asserted by eval #1).
- **Acceptance:** when a registry file is present, generated tokens derive from it (not defaults); a second surface in the same session reuses the locked tokens.

### Addition 3 — Compile-clean contract + lint gate  *(compile-clean discipline)*

- **Source:** Claude Artifacts (import allowlist, inline, no-build, default-export), v0 autofixer (post-gen import/icon/TS fix), Bolt error-loop (native to builder).
- **Today:** repaint *claims* "compile-clean durable output" and browser-verifies, but the guarantee is model-trusted, not an encoded, enforced contract.
- **New:** encode an explicit **compile-clean contract** — an import allowlist per target (React/Tailwind/shadcn, or vanilla), forbidden patterns (no undeclared deps; no `<link>`/`<script src>` in self-contained mode; default-export; etc.) — and a **static lint gate** the builder runs *before* browser-verify. Catches the import/icon/dependency class of errors v0's autofixer targets, with **no RFT model** — a grep/AST lint plus the model's own reasoning. Runtime issues still fall through to the existing browser-verify loop.
- **Skill:** new *"Gate 7 — compile-clean contract"* + an allowlist section in `references/`.
- **Agent:** `repaint-builder` runs lint → fix violations → then browser-verify.
- **Acceptance:** an output importing a non-allowlisted package or using a forbidden pattern is caught and fixed before browser-verify; browser-verify still runs.

## 4. Skill vs agent placement (summary)

| Addition | `SKILL.md` (pipeline rules + refs) | `repaint-builder` agent (execution) |
|---|---|---|
| 1 Design-spec lock | New Phase-1 gate; variant directions reference | Builds the locked/selected spec |
| 2 Registry + token-lock | Phase-1 registry-read step; precedence rule | Applies locked tokens; no parallel palette |
| 3 Compile-clean | New Gate 7 + allowlist reference | Lint → fix → browser-verify |

## 5. YAGNI cuts (deliberate)

- **Bolt's run/self-correct loop** — already native to `repaint-builder` (real shell + Playwright, superior to WebContainer). Do not rebuild; the new lint feeds it.
- **v0's RFT autofixer model + production embeddings RAG** — replaced by a markdown allowlist + grep/AST lint + model reasoning. Heavy infra, low ROI here.
- **Stitch Figma/JSON export, voice, live canvas** — out of scope for a code-in-IDE skill (Stitch's own positioning supports code-first here).
- **Multimodal screenshot → code** — optional later; not required by the three chosen capabilities.

## 6. Validation — the eval delta-gate (regression harness)

Each addition is validated by re-running the 23 evals and **gating on the delta** against a committed baseline. This reuses the label-free, gate-on-delta discipline distilled from the `hitgate` project (see [earlier brainstorm]).

### Baseline (measured 2026-06-23, before any change)

- Harness: `agent-skills-eval@0.1.1`, target `z-ai/glm-4.6`, judge `openai/gpt-4.1-mini`, with-skill only, 3 runs.
- Assertion-level pass-rate per run: **86.6% / 87.9% / 90.6%** → **mean 88.4%**, **noise band 4.0pp** (stdev 1.67pp).
- Artifact: `evals/baseline.json` (per-eval median passed/total + provenance) — **to be committed in Phase 0**.

### Gate rules (the discipline, not just the number)

1. **Advisory, not hard-blocking** — double stochasticity (model generates *and* judges); a hard CI fail would flap.
2. **Gate on delta, not absolute** — never claim "88% = good"; claim "−Xpp vs baseline = something broke." Absolute is judge-optimistic by construction.
3. **Pin the judge** — only same-judge runs compare; baseline records the judge model.
4. **Noise floor first** — band measured at **4.0pp**; ignore aggregate wobble within it.
5. **Ignore the tool-stall artifact** — a lone `0/N` on an inspect/fixture eval (observed: **eval-4 = 0/6 in run 2**) is a harness limitation of the single-shot/tool-less runner, *not* a skill regression. Per-eval signal uses **majority across runs**.
6. **Re-baseline on intentional change** — when a change deliberately moves scores and is accepted, commit a fresh `baseline.json` with a note.

## 7. Implementation sequence (for `/plan` to expand)

- **Phase 0 — Lock the gate.** Commit `evals/baseline.json` + an `evals/README` section encoding the six gate rules above. (Closes the parked baseline task.)
- **Phase 1 — Addition 3 (compile-clean contract + lint).** Smallest, hardens the weakest claim. SKILL.md Gate 7 + allowlist reference + builder lint step. Re-run evals; confirm ≥ baseline − noise band.
- **Phase 2 — Addition 1 (design-spec lock + variants).** Elevate Phase-1 spec to an approvable checkpoint; add variant directions. Re-run evals.
- **Phase 3 — Addition 2 (registry read + token-lock).** Registry loader + precedence rule + session token-lock; add a multi-surface consistency eval. Re-run evals.
- Each phase is independently shippable and individually delta-gated.

## 8. Risks / open questions

- **Eval coverage for new behavior.** Additions 1–2 introduce behavior (variant presentation, multi-surface token reuse) the current 23 evals don't test. New evals must be added per phase, which itself shifts the baseline → re-baseline when eval set changes.
- **Self-contained vs project-scaffold mode.** The compile-clean allowlist differs between a single-file artifact and a project that already has a build. Gate 7 must branch on which mode repaint detected (it already distinguishes registers; reuse that signal).
- **Approval-pause UX.** Addition 1's "await selection" must degrade gracefully in autonomous/eval contexts (no human to pick) — default to the first variant and log the choice.
- **Token-lock scope.** Where the session token-lock is stored (in-context vs a written `DESIGN.md` the skill emits) affects multi-surface consistency across separate invocations — likely emit a `DESIGN.md` so the lock survives.

---

*Sources: Vercel v0 eng blog & docs; StackBlitz bolt.new source (action-runner, message-parser, prompts); Google Stitch / Google Labs announcements + MCP docs; Claude Artifacts/Claude Design help & system-prompt analyses. Full URLs in the session research briefs.*
