# Plan: repaint Builder-Tool Distillation (scope C)

**Date:** 2026-06-23
**Status:** active
**Design:** `docs/plans/2026-06-23-repaint-builder-tool-distillation-design.md`

## Goal

Fold three distilled builder-tool mechanisms (design-spec lock + variants, registry read + token-lock, compile-clean contract + lint) into the repaint skill + `repaint-builder` agent, each phase independently shippable and delta-gated against a measured eval baseline.

## Scope

### In-Scope
- `SKILL.md` — new Phase-1 gates (design-spec lock, registry read & lock) + Gate 7 (compile-clean).
- `references/context-anchors.md` — variant directions hook, token precedence rule, compile-clean allowlist section.
- `evals/` — `baseline.json`, `README` (six delta-gate rules), new evals for variant presentation + multi-surface consistency + compile-clean.
- `~/.claude/agents/repaint-builder.md` — lint step, locked-spec build, token-lock application. (Global file → chain `/docs-sync` after editing.)
- Validation: re-run the 23 evals per phase, gate on delta vs baseline.

### Out-of-Scope
- Bolt-style run/self-correct loop (already native to `repaint-builder`).
- v0 RFT autofixer model, embeddings RAG; Stitch Figma/JSON/voice/canvas; multimodal screenshot→code (design §5 YAGNI cuts).
- Pushing/merging to `main` — branch only; ship decisions are separate.

## Phases

### Phase 0: Lock the regression gate
**Objective:** Make the eval delta-gate real before any skill change, so every later phase is measurable.

**Steps:**
1. Write `evals/baseline.json` from the 2026-06-23 3-run aggregate: assertion-level mean **0.884**, noise band **4.0pp**, per-eval median passed/total, provenance (`harness=agent-skills-eval@0.1.1`, `target=z-ai/glm-4.6`, `judge=openai/gpt-4.1-mini`, `runs=3`, `date=2026-06-23`).
2. Add an `evals/README` section encoding the six gate rules (advisory; gate-on-delta; pin-judge; noise-floor 4.0pp; ignore tool-stall `0/N` on inspect/fixture evals e.g. eval-4; re-baseline on intentional change).
3. Zero-cost skill validation: `NOKEY=x npx agent-skills-eval@0.1.1 . --strict --base-url http://127.0.0.1:1/v1 --api-key-env NOKEY` → prints "23 evals".

**Done When:** `evals/baseline.json` + `evals/README` gate section exist; `--strict` prints "23 evals" with no schema error.
**Time:** 1h

**Replanning triggers:** baseline.json schema collides with the canonical `assertions`-as-strings format → keep baseline.json a *separate sibling file*, never inline into evals.json.

### Phase 1: Addition 3 — compile-clean contract + lint  *(first: hardens weakest claim)*
**Objective:** Turn repaint's "compile-clean" claim into an enforced gate.

**Steps:**
1. `references/context-anchors.md`: add a compile-clean allowlist section (imports per target React/Tailwind/shadcn vs vanilla; forbidden patterns; default-export rule), branched by self-contained vs project-scaffold mode.
2. `SKILL.md`: add **Gate 7 — compile-clean contract**, run before browser-verify.
3. `repaint-builder.md`: add lint → fix → browser-verify step; chain `/docs-sync`.
4. Add 1–2 evals asserting a non-allowlisted import / forbidden pattern is caught.
5. Re-run evals (M≥3); compare to baseline.

**Done When:** Gate 7 present; builder lints before verify; new eval(s) pass; aggregate ≥ baseline − 4.0pp noise band; no per-eval majority regression.
**Time:** 4–6h

**Replanning triggers:** lint produces false positives that *lower* scores beyond the noise band → loosen allowlist, don't weaken the gate.

### Phase 2: Addition 1 — design-spec lock + variants
**Objective:** Make design-then-code an approvable checkpoint with variant choice.

**Steps:**
1. `SKILL.md`: Phase-1 gate — emit spec (register + anchor + token table + layout intent) + **2–3 named variant directions**, await selection; in autonomous/eval contexts default to variant 1 and log the choice.
2. `references/context-anchors.md`: wire variant directions to §B.
3. `repaint-builder.md`: build only the locked/selected spec.
4. Add an eval asserting ≥2 distinct variant directions appear before code, and code matches the selected variant's tokens.
5. Re-run evals; compare to baseline. **Re-baseline** (eval set changed) if scores shift and are accepted.

**Done When:** build prompts yield spec + ≥2 variants pre-code; selected-variant tokens flow into code; new eval passes; aggregate within/above gate.
**Time:** 1 day

**Replanning triggers:** approval-pause stalls the tool-less eval harness (tool-stall artifact) → ensure autonomous default-to-variant-1 path needs no tool call.

### Phase 3: Addition 2 — registry read + token-lock
**Objective:** Ground on the project's real design system and keep multi-surface output consistent.

**Steps:**
1. `SKILL.md`: Phase-1 **registry read & lock** step; precedence **project tokens > anchors > 2026 defaults**; emit a `DESIGN.md` so the lock survives across invocations.
2. `repaint-builder.md`: apply locked tokens; never invent a parallel palette (already asserted by eval #1).
3. Add a multi-surface consistency eval (surface A then surface B reuse the same locked tokens), using existing fixtures `evals/files/DESIGN.md` + `components.json`.
4. Re-run evals; **re-baseline** with note.

**Done When:** with a registry file present, generated tokens derive from it (not defaults); second surface reuses locked tokens; consistency eval passes; gate satisfied.
**Time:** 1 day

**Replanning triggers:** token-lock can't survive separate invocations in-context only → persist via emitted `DESIGN.md` (already the chosen mechanism).

### Phase 4: Absorb #1 — deepen §B directions  *(highest leverage; see absorptions design doc)*
**Objective:** Make the 8 art-direction directions *operationally* concrete, not just named.

**Steps:**
1. `references/context-anchors.md` §B: for each of the 8 directions, add concrete execution specs — display type scale (e.g. `clamp(...)`), tracking, leading, named typefaces, color triplets (light + dark), and the one signature move/texture. Brutalist is the worked exemplar (scale `clamp(4rem,10vw,15rem)`, `-0.03em`, `#E61919`, zero-radius/gradient/soft-shadow, scanlines).
2. Add the **Chanel principle** as one line in the SKILL.md slop audit ("can one decorative element be removed without losing intent?").
3. Re-run evals; compare to baseline. This is resource content (low plateau risk).

**Done When:** each §B direction carries scale + tracking + type + color-triplet + signature; art-direction evals (#2, #24) hold or improve; aggregate within gate.
**Time:** 4–6h

**Replanning triggers:** §B growth pushes a reference file past the harness's 64KB/file inject limit → split §B into its own reference file.

### Phase 5: Absorb #2 — new §L Motion Craft
**Objective:** Add the motion *craft* layer repaint lacks (it has tokens only).

**Steps:**
1. `references/context-anchors.md`: new **§L Motion Craft** — scroll choreography, timeline orchestration, stagger recipes, performance guardrails (transform/opacity only; will-change discipline), motion-slop anti-patterns.
2. Light pointer from Gate 5 / art-direction mode to §L (NOT a heavy new gate — plateau risk).
3. Optional: 1 eval asserting motion-slop avoidance (animate transform not layout props; reduced-motion fully disables). Re-baseline if added.
4. Re-run evals; compare to baseline.

**Done When:** §L exists with the five pattern groups; Gate 5/art-direction references it; eval (if added) passes; aggregate within gate.
**Time:** 4–6h

**Replanning triggers:** adding §L as enforcing rules (not resource) drops the score beyond the noise band → demote to reference-only, remove the gate.

### Phase 6 (deferred): Absorbs #3 + #4
**Objective:** Lower-ROI absorbs, only if Phases 4–5 land cleanly.

**Steps:**
1. §B: name Cyber/Technical + Cinematic Pacing as directions (or map into existing slots).
2. §I fragment: Material-3 tonal-palette generation + two-part elevation + shadcn `.dark` CSS-variable override (builder-facing).
3. Re-run evals.

**Done When:** directions named; §I fragment linked; aggregate within gate.
**Time:** 0.5–1 day

**Replanning triggers:** no eval moves on these → ship as docs-only, skip dedicated evals.

## Dependencies & Assumptions
- Phases are ordered by leverage but each is independently shippable; Phase 0 must precede all (provides the gate).
- Eval runs require a live OpenRouter key (`~/.repaint-openrouter.key`) — assumed present; a bad key fails auth for free.
- Editing `~/.claude/agents/repaint-builder.md` is a *global* change → `/docs-sync` after each phase that touches it.
- `main` has the signed-commits ruleset; work on a branch, commits auto-sign.

## Current State (if partial)
- **Phase 0 data is already computed** — baseline numbers + per-eval medians live in the design doc §6 and scratchpad `baseline_draft.json`; Phase 0 is just writing the two files.
- Design approved (scope C). No code changes landed yet.

## Notes
- Validation command (per memory `repaint-eval-running`): `OPENROUTER_API_KEY="$(cat ~/.repaint-openrouter.key)" npx agent-skills-eval@0.1.1 . --target z-ai/glm-4.6 --judge openai/gpt-4.1-mini --base-url https://openrouter.ai/api/v1 --api-key-env OPENROUTER_API_KEY --concurrency 4 --workspace <dir>` (drop `--baseline` for with-skill-only).
- Plateau caution (memory): past ~91%, *adding rules hurts generalization*; the lever is **prominence** (surface buried guidance into gates), not new rules — applies to every SKILL.md edit here.
- Skip the run/self-correct rebuild; the new lint feeds the existing browser-verify loop.
