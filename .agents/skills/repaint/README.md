# repaint

> The anti-slop frontend skill — research, tokens, a reference library, and a live browser feedback loop.

Build production-grade frontend UI that doesn't read as "AI-made" — a **self-contained** skill for agentic coding tools (Claude Code, and any agent that supports [`npx skills`](https://github.com/vercel-labs/skills)).

It depends on **no other skills and no agents**. Everything ships in this repo: the pipeline (`SKILL.md`), a curated reference library (`references/`), and 23 evals (`evals/`).

## Install

```bash
npx skills add LucasSantana-Dev/repaint
```

That copies `SKILL.md` + `references/` + `evals/` into your agent's skills directory (`.claude/skills/` or `.agents/skills/`). Then just ask your agent to build, redesign, or "make X look less AI-made" — the skill auto-applies. Update later with `npx skills update`.

Or clone manually:

```bash
git clone https://github.com/LucasSantana-Dev/repaint ~/.claude/skills/repaint
```

## What it does

A pipeline that produces UI that looks *designed*, not generated — **and behaves like it, and reaches everyone** — built on six pillars:

| Pillar | What it means |
|---|---|
| **Scraping** | Research *real, current* references for the brief (your web search), not vibes. |
| **Tokens** | Commit a concrete token system (OKLCH color + distinctive type) before any markup. |
| **References** | A curated library — named anchors per context, 8 art-direction directions, 2026 token defaults, a slop catalog, type-by-role, experience patterns, microcopy, an accessibility & SEO checklist, the industry-standard design systems (Material 3, Apple HIG, Carbon, Polaris, Fluent, Ant, shadcn…), and the psychology of interface design (with dark patterns banned). |
| **Experience** | Design the *interaction*, not just the pixels: honest feedback + perceived performance, forgiving input, recoverable actions, a real keyboard path. Enforced by Gate 4, Gate 5, and the experience audit. |
| **Reach** | Accessible to every user *and* findable by search: one semantic-HTML foundation (landmarks, one H1 + heading order, real labels, alt) serves screen readers and crawlers. Enforced by Gate 6 + the a11y/SEO audit (SEO register-gated to public surfaces). |
| **Real iteration feedback** | Build → render → screenshot → slop-audit + experience-audit + a11y/SEO audit → iterate, against live browser output — not a one-shot guess. |

The leverage (eval-verified) is in the six places a capable model gets wrong unaided: cliché on creative briefs, register-appropriate restraint, distinctive typography, compile-clean durable output, hollow/AI-generated interaction (handlers that do nothing, silent submits, no keyboard path, generic error copy), and inaccessible-by-default / SEO-blind markup (div soup, no landmarks/labels/alt, no title/meta/structured data).

## What's in the box

- **`SKILL.md`** — the 5-phase pipeline (research → gates/tokens → scaffold → build → slop-audit + experience-audit + a11y/SEO audit + browser-verify loop), with six Phase-1 gates including Gate 4 (component anatomy + interaction affordances), Gate 5 (experience contract), and Gate 6 (accessibility & SEO).
- **`references/context-anchors.md`** — named anchors + tokens + per-context slop tells (e-commerce, fintech, healthcare, editorial, mobile, b2b dashboards, auth, AI-chat, command palette); 8 named art-direction directions; 2026 token defaults; an extended slop catalog; type-by-role; **§F interaction & experience patterns** (+ the experience anti-pattern catalog and latency thresholds); **§G microcopy by interaction type**; **§H accessibility & SEO** (the shared semantic foundation, a11y checklist, register-gated SEO checklist, JSON-LD by context, verify tooling); **§I design systems & cross-cutting patterns** (Material 3, Apple HIG, Carbon, Polaris, Fluent, Ant, Lightning, Spectrum, Primer, Atlassian, Base Web, Radix, shadcn, Mantine; multi-tier tokens/DTCG, density, dark-first, motion tokens, two-part elevation, container queries); **§J psychology of interface design** (Gestalt, Hick, Fitts, Miller, Jakob, Tesler, peak-end, Zeigarnik, ethical persuasion) + dark-pattern bans.
- **`evals/evals.json`** — 23 evals across all 5 registers + the regression guards (design-system-present, existing-`DESIGN.md`, non-dev-tool anchor per context, accessibility, mobile thumb-zone, data-viz restraint, register disambiguation, copy-compiles), the **experience guards** (feedback/loading honesty, specific microcopy, keyboard + visible focus, recoverable destructive actions), the **reach guards** (semantic a11y structure, SEO head + structured data), and the **foundations guards** (defer to an established design-system library, ethical persuasion / no dark patterns), in the canonical `assertions`-as-strings format (fixtures in `evals/files/`) runnable by `agent-skills-eval`. Run these to check changes don't regress.

## License

Apache-2.0 (see [LICENSE](LICENSE)). The `references/` library is deliberately open and forkable — extend it.
