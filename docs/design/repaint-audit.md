# Job Radar — UI Audit & Visual Direction (Repaint Review)

**Data:** 2026-09-02  
**Audit:** Repaint skill (anti-AI-slop frontend pipeline)  
**Register:** `product-app` (b2b-data-dense dashboard)  
**Closest anchors:** Airtable (data-grid density) + Linear (task pipeline minimalism) + GitHub (slate-blue palette)

---

## 1. Visual/UI Audit

### Current State

| Aspect | Status | Notes |
|--------|--------|-------|
| App shell | ✓ Present | `Layout.tsx` wraps all non-setup routes with sidebar |
| Routing | ✓ Clean | `App.tsx` maps routes clearly, Setup flow isolated |
| Component primitives | ⚠ Basic | `Button`, `Input`, `Card` exist; missing `Select`, `Badge`, `Modal`, `Table` |
| Data fetching | ✓ Good | React Query with proper invalidation |
| Form handling | ✓ Good | `react-hook-form` + `zodResolver` in profile |
| Token system | ✗ None | No `DESIGN.md`; drift across surfaces |
| Typography | ✗ Default | System sans everywhere; no type scale |
| Iconography | ✗ Emoji | `📊💼📋📈👤⚙️` as nav icons — unprofessional |
| Loading states | ✗ Text only | `"Carregando..."` everywhere |
| Error states | ✗ Missing | No error boundaries or retry UI |
| Empty states | ✗ Text only | No illustrations or CTAs |

### AI-Slop Patterns Found

- **Purple→blue gradient** (`bg-gradient-to-r from-blue-400 to-purple-400`) — the #1 AI-UI tell per repaint §H
- **Default Tailwind slate tokens** — `--background: 0 0% 100%` is literally Tailwind ui defaults
- **Emoji-as-icon** — specifically forbidden in repaint Gate 7
- **Raw `<select>`** elements with manual Tailwind classes
- **Magic number color arrays** — `const COLORS = ['#ef4444', '#f97316', ...]`
- **Glow-on-hover cards** — `hover:shadow-lg hover:shadow-blue-500/5`
- **Text-as-link** — `<a className="text-sm text-blue-600 hover:underline">`

---

## 2. Biggest UX Problems

### P1: No loading states or skeletons
Every page shows `"Carregando..."` text. The dashboard fires 3 parallel queries — user sees a blank page with no visual structure.

### P2: No error boundaries or retry UI
React Query has `retry: 1` but no error fallback UI. Errors are silently swallowed.

### P3: Native HTML selects in custom dark theme
`jobs.tsx` uses raw `<select>` elements styled manually. Native OS dropdowns clash with the dark theme.

### P4: Silent mutations
Clicking "Avaliar match" shows `"..."` but no success confirmation. No toast, no optimistic update.

### P5: No empty-state design
Empty states are plain text: `"Nenhuma vaga avaliada ainda."` — no illustration, no CTA, no guidance.

### P6: Hard reload on setup complete
`setup.tsx` line 27: `window.location.href = '/'` — bypasses SPA navigation.

### P7: No pagination feedback
"Carregar mais" button with no page context ("Página 2 de 8").

---

## 3. Biggest Visual/Design Problems

### D1: Generic Tailwind dark theme + blue/purple gradient
The entire app is default Tailwind `slate` + `blue`/`purple` gradients. This is the single most common AI-generated UI tell.

### D2: No `DESIGN.md` token contract
Cards use `border-slate-700/50 bg-slate-800/50`; nav uses `border-slate-700/50 bg-slate-900/80`; buttons use `bg-slate-800`. Tokens drift across surfaces.

### D3: Flat, zero-depth visual language
Cards have `shadow-sm`/`hover:shadow-lg` but no systematic elevation. Everything sits flat.

### D4: No distinctive typography
All text uses Tailwind default `font-sans` (system stack). No type pairing, no personality.

### D5: Emoji icons in professional tool
`📊`, `💼`, `📋` etc. — feels amateur, breaks i18n.

### D6: Inconsistent spacing/radius
Cards: `rounded-xl`, buttons: `rounded-lg`, inputs: `rounded-md`. No systematic scale.

### D7: Data viz is barebones
Charts use recharts defaults with hardcoded ugly color array.

### D8: Status colors hardcoded per-file
Analytics uses inline `text-blue-600`, `text-green-600`, `text-purple-600` — no semantic token system.

---

## 4. Proposed Visual Direction

**Anchor sentence:** *"Dashboard anchored to Airtable's clean data-grid density; cards anchored to Linear's task-focused minimalism; color anchored to GitHub's muted slate-blue."*

### Token Spec (oklch, dark-first)

| Token | Value | Usage |
|-------|-------|-------|
| `bg` | `oklch(0.10 0.01 220)` | Page background |
| `surface` | `oklch(0.16 0.015 220)` | Card body |
| `surface-2` | `oklch(0.20 0.02 220)` | Elevated card / dropdown |
| `border` | `oklch(0.25 0.02 220)` | Dividers |
| `fg` | `oklch(0.92 0.02 220)` | Primary text |
| `muted-fg` | `oklch(0.70 0.015 220)` | Secondary/muted |
| `accent` | `oklch(0.55 0.25 250)` | Slate blue (NOT purple→blue) |
| `accent-fg` | `oklch(0.98 0.02 250)` | Text on accent |
| `success` | `oklch(0.60 0.18 140)` | Positive status |
| `warning` | `oklch(0.70 0.15 70)` | Warning status |
| `error` | `oklch(0.60 0.20 0)` | Destructive/error |

### Typography

- **Display/Sans:** DM Sans (headings, scale 48/36/32/24/20)
- **Body:** Inter (16/15/14, line-height 1.5)
- **Mono:** JetBrains Mono (tables, metadata)

### Spacing & Radius (4pt system)

| Scale | Values | Usage |
|-------|--------|-------|
| Spacing | 4/8/12/16/24/32/48/64 | Consistent padding/margins |
| Radius | 6/12/999 | Inputs(6), Cards(12), Badges(999) |

### Motion

| Token | Duration | Usage |
|-------|----------|-------|
| `micro` | 120ms | Hover states |
| `standard` | 200ms | Transitions |
| `page` | 320ms | Page transitions |
| Curve | `ease-out` | Standard easing |

### Elevation (two-part shadow)

```
level-1: 0 1px 3px hsl(220 20% 8%), 0 1px 6px hsl(220 30% 6%)
level-2: 0 4px 6px hsl(220 20% 8%), 0 2px 12px hsl(220 30% 6%)
```

---

## 5. Prioritized Improvements

### P0 — Highest Impact (Visual System)

| # | Task | Lines | Notes |
|---|------|-------|-------|
| 1 | **`DESIGN.md`** at root | — | Lock tokens, type scale, elevation, motion |
| 2 | **Kill purple→blue gradient** | ~3 files | Single slate-blue accent everywhere |
| 3 | **Install Lucide icons** | ~6 files | Replace emoji nav icons |
| 4 | **Add `Select` component** | ~1 file | Replace raw `<select>` |

### P1 — High Impact (Experience)

| # | Task | Lines | Notes |
|---|------|-------|-------|
| 5 | **Loading skeletons** | ~3 components | Replace `"Carregando..."` |
| 6 | **Error boundaries + retry** | ~2 components | ErrorBoundary + query fallbacks |
| 7 | **Empty state design** | ~3 components | Illustration + CTA |
| 8 | **Toast system for mutations** | ~2 files | Brief success/error feedback |

### P2 — Medium Impact (Polish)

| # | Task | Lines | Notes |
|---|------|-------|-------|
| 9 | Consistent radius scale | ~5 files | 6/12/999 rule |
| 10 | Two-part shadows | ~3 files | Elevate cards |
| 11 | Semantic badge system | ~2 components | `badge-success` etc. |
| 12 | Link component | ~2 files | Consistent nav links |
| 13 | Fix hard reload | 1 line | `navigate` instead of `window.location` |

### P3 — Lower Priority

| # | Task | Notes |
|---|------|-------|
| 14 | Chart styling | Semantic colors on recharts |
| 15 | Pagination visualization | "Página 2 de 8" indicator |
| 16 | Focus management | Visible keyboard focus |
| 17 | Form validation states | Inline errors |

---

## 7. Anti-Patterns to Remove

- ❌ `bg-gradient-to-r from-blue-600 to-blue-700` on buttons
- ❌ Emoji as nav icons
- ❌ Raw `<select>` elements
- ❌ `text-blue-600` for links (should be `accent` token)
- ❌ Hardcoded color arrays (`COLORS = [...]`)
- ❌ `hover:shadow-blue-500/5` (glow-on-hover cards)
- ❌ `window.location.href = '/'` in SPA

---

## 8. Generic SaaS Dashboard Aesthetics Audit

### Excessive rounded cards
- `Card` component uses `rounded-xl` (line 8 of `card.tsx`)
- Every page wraps content in cards with the same radius — visually repetitive
- `settings.tsx` line 242/442/481 also uses `rounded-lg` for nested content blocks — same pattern, different radius

### Excessive gradients
- `layout.tsx` line 15: `bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900` as page background — unnecessary gradient for a static color
- `layout.tsx` line 20: `bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text` on brand name — pure decoration
- `button.tsx` line 16: `bg-gradient-to-r from-blue-600 to-blue-700` on primary buttons — adds no information

### Purple/blue AI-looking color palette
- The entire accent system is Tailwind's default blue/purple (`blue-600`, `blue-700`, `purple-400`)
- `applications.tsx` line 187-189: `ring-blue-500` on dragged cards
- `settings.tsx` line 242-244: active providers use `border-green-500 bg-green-500/10` — inconsistent with the blue accent
- No systematic color token mapping — colors are picked ad hoc from Tailwind's palette

### Unnecessary glassmorphism
- `card.tsx` line 8: `bg-slate-800/50` (50% opacity) — faux-glass effect with no visual rationale in a non-blur context
- `layout.tsx` line 16: `bg-slate-900/80 backdrop-blur-sm` on header — blur effect with no depth relationship
- `profile.tsx` line 452/560: `bg-slate-700/50` for form sections
- `settings.tsx` line 442/481: `bg-slate-700/50` for setting groups

### Excessive shadows
- `card.tsx` line 8: `shadow-sm` + `hover:shadow-lg hover:shadow-blue-500/5` — glow effect as a hover state
- `applications.tsx` line 187-189: `shadow-lg ring-2 ring-blue-500` on drag overlay
- No systematic elevation — `shadow-sm`, `shadow-lg`, `ring-2` applied arbitrarily

### Repetitive card grids
- Dashboard: KPI cards (4) + chart cards (2) + match list + recent jobs = 4+ identical card patterns
- Analytics: KPI cards (4) + charts (4) + skills (2) + gaps = 6+ identical card patterns
- No visual breathing room between grid items — `space-y-4` / `space-y-6` everywhere

### Excessive badges and pills
- `jobs.tsx` line 240-247: match score badges with 4-tier color coding
- `jobs.tsx` line 259: seniority badges
- `jobs.tsx` line 270-277: status badges + source badges
- `analytics.tsx` line 106-108: status badges in funnel list
- All with ad-hoc color classes — no badge system

### Emoji used as UI decoration
- `layout.tsx` line 5-10: `📊`, `💼`, `📋`, `📈`, `👤`, `⚙️` as nav icons
- `layout.tsx` line 19: `🎯` as app logo
- `profile.tsx` line 267: `👤` as avatar placeholder
- `dashboard.tsx` line 149 + `job-detail.tsx` line 89: emoji for match rating
- All replace proper iconography

### Generic icon-in-a-box patterns
- `layout.tsx` line 38: `<span className="text-base">{item.icon}</span>` — bare emoji in a span, no wrapper semantics
- `applications.tsx` line 144: `KanbanColumn` component uses inline color backgrounds for each column — generic colored box pattern

### Poor typography hierarchy
- Headings: `text-3xl font-bold` everywhere (dashboard, jobs, analytics, applications)
- Subheadings: `text-sm text-muted-foreground` everywhere
- No type scale — `font-semibold`, `font-medium`, `font-bold` used inconsistently
- Body: `text-sm` only, no distinction between caption/label/body
- `job-detail.tsx` line 131: `<div className="whitespace-pre-wrap text-sm">{job.description}</div>` — description is same size as body text

### Excessive whitespace without purpose
- `dashboard.tsx` line 44: `space-y-8` between major sections
- `jobs.tsx` line 107: `space-y-6` — large vertical gaps
- `profile.tsx` has multiple `mb-4 p-4` blocks — whitespace as visual separator without semantic meaning
- Layout uses `container py-8` (line 45) — 3rem vertical padding on every page

### Visually repetitive components
- All cards follow the same pattern: `<Card><CardHeader><CardTitle>...</CardTitle></CardHeader><CardContent>...</CardContent></Card>`
- All buttons follow the same padding/radius — no visual distinction between primary/secondary actions
- All data rows are `<div className="flex justify-between items-center">` — no table semantics

### Default-looking shadcn/Tailwind-style layouts
- `index.css` uses the exact Tailwind CSS component library default color values
- Card hover effect (`hover:shadow-lg`) is a copy-paste Tailwind pattern
- Button `active:scale-95` — another Tailwind default pattern
- Layout is a standard sidebar + main content — no unique structural decisions

### UI that looks like AI-generated template
- The combination of: gradient background → sidebar with emoji icons → card grid with KPI counters → blue-accent buttons → glow hover effects → raw selects → emoji status indicators
- This is the textbook "AI dashboard template" — a collection of copied Tailwind patterns with no unifying visual thesis

### Specific AI-slop patterns (SaaS dashboard register)

The following patterns confirm this reads as a generic AI-generated SaaS dashboard:

1. **Purple→blue gradient everywhere** — `bg-gradient-to-r from-blue-400 to-purple-400` (brand), `from-blue-600 to-blue-700` (buttons) — the single most common AI-UI tell
2. **Default Tailwind slate palette** — `--background: 0 0% 100%` is literally the Tailwind UI default
3. **Emoji-as-nav-icon** — `📊💼📋📈👤⚙️` in sidebar, `🎯` as app logo — forbidden by repaint Gate 7
4. **Excessive rounded cards** — `rounded-xl` on every Card, `rounded-lg` on inputs, `rounded-md` on buttons — no radius scale
5. **Excessive glassmorphism** — `bg-slate-800/50`, `bg-slate-900/80 backdrop-blur-sm` — faux-glass with no depth rationale
6. **Excessive shadows** — `hover:shadow-lg hover:shadow-blue-500/5` — glow-on-hover is compensation for flat design
7. **Repetitive card grids** — dashboard: 4 KPI cards + 2 chart cards + job list + match list = 4+ identical card patterns
8. **Excessive badges/pills** — match scores, seniority, status, source tags all use inline `rounded px-2 py-0.5` with no badge system
9. **Generic icon-in-a-box** — emoji spans with no semantic wrapper, `<span className="text-xl">` wrapping icons
10. **Poor typography** — `font-bold` for everything, no type scale, no font pairing, no hierarchy
11. **Default shadcn aesthetic** — the CSS variables match shadcn/ui's tailwindcss-dark preset verbatim
12. **Visually repetitive components** — identical `<div className="flex justify-between">` data rows, same card pattern everywhere

---

## 9. Retention Decisions

- ✅ Keep dark-first theme (matches `product-app` B2B anchor)
- ✅ Keep Kanban board for applications (Linear pattern is correct)
- ✅ Keep tab navigation structure
- ✅ Keep card-based layout (but make cards intentional, not repetitive)

---

## 10. Implementation Status

### P0 — Completed (Visual System)

| # | Task | Files Modified |
|---|------|----------------|
| 1 | Kill purple→blue gradient | `index.css`, `layout.tsx`, `button.tsx` — replaced with single `--accent` token |
| 2 | Replace emoji icons with Lucide | `layout.tsx` (nav), `dashboard.tsx` (match), `profile.tsx` (avatar), `settings.tsx` (info), `applications.tsx` (match) |
| 3 | Add `Select` component | `components/ui/select.tsx` — replaces raw `<select>` in `jobs.tsx` |

### P1 — Completed (Experience)

| # | Task | Files Modified |
|---|------|----------------|
| 4 | Kill glassmorphism | `card.tsx`, `layout.tsx` — removed `/50` opacity, `backdrop-blur` |
| 5 | Consistent radius + shadows | `card.tsx` (`--radius-md`, no glow hover), `index.css` (two-part shadow tokens) |
| 6 | Semantic color system | `lib/colors.ts` — centralized match/seniority/status colors |
| 7 | Fix Button variant names | `button.tsx` (primary/secondary/danger), updated `setup.tsx`, `settings.tsx`, `jobs.tsx` |
| 8 | Fix hard reload in setup | `setup.tsx` — `navigate('/')` instead of `window.location.href` |
| 9 | Kill remaining hardcoded colors | `applications.tsx`, `profile.tsx`, `settings.tsx`, `analytics.tsx` — all `bg-slate-*`, `text-blue-*`, `bg-green-*` replaced with `--surface`, `--accent`, `--success`, `--warning`, `--error` tokens |
| 10 | Replace emoji in job-detail | `job-detail.tsx` — removed emoji from match score display |

### P1 — Remaining

- [x] Loading skeletons (3 components — `Skeleton`, `DashboardSkeleton`, `JobsSkeleton`)
- [x] Error boundaries + retry (`ErrorBoundary` wrapping all pages, inline query errors)
- [x] Empty state design (`EmptyState` component in dashboard, jobs, analytics, profile)
- [x] Toast system (`toast.tsx` with `ToastProvider` + `useToast`, wired into all mutations)

### P2 — Remaining

- [x] Chart styling (`CHART_COLORS` centralized in `lib/colors.ts`)
- [x] Pagination visualization (`"Página X de Y"` in jobs page)
- [ ] Focus management (visible keyboard focus)

### Post-Audit Improvements (brutal design pass)

- [x] Card elevation system (two-part shadow tokens in CSS, applied to `Card`)
- [x] Ghost button hover feedback (background + text color on hover)
- [x] Data density (reduced `CardContent` padding 6→4, section spacing 8→6, kanban min-height 96→200px)
- [x] `Badge` component (replaces inline badge classes across pages)
- [x] `SENIORITY_COLORS` / `SOURCE_STATUS_COLORS` fixed (removed hardcoded `bg-slate-*`)

### Token System (implemented in `index.css`)

```
Color (oklch, dark-first):
  --background: 0.10 0.01 220       (deep neutral)
  --surface: 0.16 0.015 220          (card bg)
  --surface-2: 0.20 0.02 220        (elevated)
  --border: 0.25 0.02 220           (dividers)
  --foreground: 0.92 0.02 220       (primary text)
  --muted-foreground: 0.70 0.015 220 (secondary)
  --accent: 0.55 0.25 250           (slate blue, no gradient)
  --accent-foreground: 0.98 0.02 250
  --success: 0.60 0.18 140
  --warning: 0.70 0.15 70
  --error: 0.60 0.20 0

Radius: 6px (inputs/buttons) / 12px (cards) / 999px (pills)
Motion: 120ms (fast), 200ms (standard), 320ms (slow) — all ease-out
```