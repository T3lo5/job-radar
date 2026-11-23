import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const pageModuleMap: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('../pages/dashboard'),
  '/jobs': () => import('../pages/jobs'),
  '/jobs/:id': () => import('../pages/job-detail'),
  '/applications': () => import('../pages/applications'),
  '/profile': () => import('../pages/profile'),
  '/settings': () => import('../pages/settings'),
  '/cv-optimizer': () => import('../pages/cv-optimizer'),
  '/analytics': () => import('../pages/analytics'),
  '/setup': () => import('../pages/setup'),
  '/login': () => import('../pages/login'),
  '/signup': () => import('../pages/signup'),
};

const pending = new Map<string, Promise<unknown>>();

export function useRoutePreload() {
  const { pathname } = useLocation();

  const preload = useCallback(
    (route: string) => {
      if (route === pathname) return;
      if (pending.has(route)) return pending.get(route);
      const mod = pageModuleMap[route];
      if (!mod) return;
      const p = mod();
      pending.set(route, p);
      p.finally(() => pending.delete(route));
      return p;
    },
    [pathname],
  );

  return { preload };
}
