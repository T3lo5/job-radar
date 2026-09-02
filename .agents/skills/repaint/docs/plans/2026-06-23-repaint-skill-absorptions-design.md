# repaint — Skill Absorptions (mining 13 external UI skills, self-contained)

**Date:** 2026-06-23
**Status:** Design approved. Implementation appended to the distillation PLAN (Phases 4–6).
**Owner:** Lucas Santana
**Affects:** `references/context-anchors.md` (§B, new §L, §I fragment), SKILL.md (one slop-audit line), `evals/`.

---

## 1. Goal

Decide whether 13 external frontend/UI skills can improve repaint, and absorb the genuinely-additive parts **into repaint's own reference library** — preserving its #1 principle (*self-contained: depends on no other skills/agents*). Scope locked by the user: **absorb-into-references + benchmark**, web-only (native mobile out), no depend-on/compose.

## 2. Verdict

repaint already **out-structures all 13** on the hard problems (register classification, 8-state anatomy, experience contract, psychology/dark-patterns, compile-clean, the eval loop — none of the competitors have these). The improvement is **not** structural; it is **filling 4 concrete content gaps**, plus one meta-fix.

### Meta-finding (highest leverage)
repaint's §B art-direction directions are **named but operationally underspecified** — it says *"brutalist"* without the type scale, tracking, color triplets, or texture rules a developer needs to execute. The taste-pack skills win precisely by shipping execution specifics. So the biggest win is **deepening the 8 existing §B directions with concrete execution specs**, not adding new ones.

## 3. Absorb list (all into references — self-contained preserved)

| # | Absorb | Source skill(s) | Target | Value | Plateau risk |
|---|---|---|---|---|---|
| 1 | **Deepen §B**: per-direction type scale, tracking, leading, color triplets, texture/signature move. (Brutalist exemplar: `clamp(4rem,10vw,15rem)`, tracking `-0.03em`, leading `0.85–0.95`, `#F4F4F0`/`#050505`/`#E61919` light + `#0A0A0A`/`#EAEAEA` dark, ASCII `[LABEL]` framing, scanline/halftone textures, **zero radius / zero gradient / zero soft shadow**.) | leonxlnx brutalist-skill, github premium-frontend-ui | §B | **High** | Low — resource content, not new rules |
| 2 | **New §L Motion Craft**: scroll choreography (ScrollTrigger scrub/pin, viewport-batched stagger), timeline orchestration (named labels, relative positioning, nested reuse), stagger recipes (50–120ms across 3–6 elements; >200ms reads scattered), performance guardrails (animate `transform`/`opacity` only — never `width`/`top`/`margin`; `will-change` only while animating; `gsap.quickTo()` for high-freq), and motion-slop anti-patterns (oversaturation >3 simultaneous motions; timing misalignment; layout thrashing; weak `prefers-reduced-motion` that only *reduces* instead of disabling; scroll-jacking). | greensock GSAP skills | new §L | **High** — the single biggest true gap (repaint has motion *tokens*, no *craft layer*) | Med — keep as reference + a light Gate-5/art-direction pointer; do NOT add heavy new gates |
| 3 | **2 new named directions**: Cyber/Technical (dark + neon + monospace + staggered reveals), Cinematic Pacing (full-viewport imagery + slow cross-fades + scroll-narrative). | github premium-frontend-ui | §B | Med | Low |
| 4 | **M3/shadcn builder fragment**: Material-3 tonal-palette generation (5 key colors → 13-tone palettes [0,10…90,95,98,99,100] → role assignments: primary=40/80, surface=99/10, surface-container=94/12), two-part elevation (tonal overlay + shadow); shadcn `.dark` CSS-variable override pattern (theme switch is CSS-only) + custom-registry/import-path notes. | shadcn-ui/ui, hamen material-3-skill | §I fragment | Low–Med — builder-facing; prevents "parallel incompatible palette" + "dark mode doesn't apply" bugs | Low |

Plus one cheap rule: the **"Chanel principle"** (Anthropic frontend-design) — *post-screenshot, can one decorative element be removed without losing intent?* → one line in the slop audit.

## 4. Skip (duplication or out of scope)

- taste-skill anti-slop bans, code-yeongyu frontend-ui-ux, UI-UX-Pro-Max palette/font databases, a11y checklists → repaint's §D/§E/§F/§H already deeper.
- shadcn semantic-tokens basics, "Material 3 exists" → §I already covers anchoring.
- **Native** (SwiftUI, Expo, mobile-app-UI) → out of scope (repaint is web-only) per user.
- bergside dual-file split → context-window cost > clarity gain.
- depend-on / compose any skill → breaks the self-contained principle.

## 5. Validation discipline

Each absorb is gated against the eval baseline (same delta-gate as the distillation work). Key nuance from the plateau caution: **references *depth* (resource content) is lower-risk than new SKILL.md *rules*** — so prefer adding resource content (§B specifics, §L craft, §I fragment) over new gates. §L gets at most a light pointer from Gate 5 / art-direction mode, not a heavy enforcing gate, unless an eval shows it's needed.

## 6. Notes / sources

- Research: 4 read-only agents (GSAP · taste-packs · general frontend craft · shadcn+M3), each scoped to report only gaps beyond repaint §A–§K. Full source URLs in each agent brief (session transcript).
- The user's source URLs were truncated; agents resolved repos by name (greensock/gsap-skills, Leonxlnx/taste-skill + brutalist-skill, github/awesome-copilot premium-frontend-ui, anthropics/skills frontend-design, nextlevelbuilder UI-UX-Pro-Max, bergside awesome-design-skills, shadcn-ui/ui, hamen material-3-skill).
- Order of leverage: **#1 ≳ #2 > Chanel > #3 > #4.**
