import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../lib/utils/cn';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  BarChart3,
  User,
  Settings,
  FileSearch,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs', label: 'Vagas', icon: Briefcase },
  { to: '/applications', label: 'Candidaturas', icon: FileText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/profile', label: 'Perfil', icon: User },
  { to: '/settings', label: 'Configurações', icon: Settings },
  { to: '/cv-optimizer', label: 'Otimizar CV', icon: FileSearch },
];

export function Layout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-surface shadow-[0_1px_3px_hsl(220_20%_8%)]">
        <div className="container mx-auto flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-accent" />
            <span className="font-display text-xl font-semibold text-foreground">Job Radar</span>
          </div>
          <nav className="ml-8 flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={toggleTheme}
            className="ml-4 rounded-[var(--radius-sm)] p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
            aria-label={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>
      <main className="container mx-auto py-6">
        <Outlet />
      </main>
    </div>
  );
}
