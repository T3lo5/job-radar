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
  Menu,
  X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';
import { useRoutePreload } from '../hooks/use-route-preload';

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
  const { preload } = useRoutePreload();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-surface shadow-[0_1px_3px_hsl(220_20%_8%)]">
        <div className="container mx-auto flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-accent" />
            <span className="font-display text-xl font-semibold text-foreground">Job Radar</span>
          </div>
          <nav className="hidden md:flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onMouseEnter={() => preload(item.to)}
                onFocus={() => preload(item.to)}
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden rounded-[var(--radius-sm)] p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <button
              onClick={toggleTheme}
              className="rounded-[var(--radius-sm)] p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
              aria-label={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Menu mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <nav
            className="fixed right-0 top-0 z-50 w-full md:w-80 h-full bg-surface border-l border-border shadow-lg transform transition-transform duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-medium text-foreground">Menu</h3>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-[var(--radius-sm)] p-2 text-muted-foreground hover:bg-surface-2"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onMouseEnter={() => preload(item.to)}
                  onFocus={() => preload(item.to)}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium transition-colors block',
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
              <div className="mt-4 pt-4 border-t border-border">
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-3 w-full rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
                  aria-label={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                </button>
              </div>
            </div>
          </nav>
        </div>
      )}

      <main className="container mx-auto py-6">
        <Outlet />
      </main>
    </div>
  );
}
