# 05 — Frontend (React + Vite + TanStack Query)

## Question

Definir stack do frontend:

- **Build/dev**: Vite (já definido)
- **UI**: Material UI (MUI) ou **shadcn/ui** (mais moderno, baseado em Tailwind, copy-paste de componentes) ou Mantine ou Chakra
- **Server state**: TanStack Query (já definido)
- **Forms**: react-hook-form + zod
- **Routing**: react-router-dom v6
- **Charts**: Recharts (já definido)
- **Estrutura**: `pages/`, `components/`, `features/`, `hooks/`, `services/` (clients HTTP)
- API client: axios ou ofetch

## Type

grilling

## Status

done

## Resolution

**Stack escolhida:**
- **Build/dev**: Vite 5 + React 18 + TypeScript
- **CSS**: Tailwind CSS 3 (utility-first, rápido de iterar)
- **Componentes**: Radix UI primitives (dialog, dropdown, select, tabs, toast) + CVA para variants
- **Server state**: TanStack Query 5
- **Forms**: react-hook-form + zod (via @hookform/resolvers)
- **Routing**: react-router-dom v6
- **HTTP**: axios
- **Ícones**: lucide-react
- **Utils**: clsx + tailwind-merge (função `cn()`)

**Estrutura:**
```
src/
├── components/ui/    # Componentes reutilizáveis (Button, Card, Input)
├── pages/            # Páginas (Dashboard, Profile, Jobs, Settings, Setup)
├── hooks/            # Custom hooks
├── services/         # API clients
├── lib/              # Utilitários
└── App.tsx           # Rotas + QueryClientProvider
```

**Páginas implementadas:**
- Dashboard — visão geral
- Profile — visualização de perfil, skills, idiomas
- Jobs — coleta manual + lista (placeholder)
- Setup — wizard de primeiro boot (IA + Cron)
- Settings — visualização de settings por escopo

**Validação:**
- `pnpm typecheck` ✓
