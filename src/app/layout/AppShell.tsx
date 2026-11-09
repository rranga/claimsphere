import { Outlet } from 'react-router';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { Sidebar } from './Sidebar';

export function AppShell() {
  return (
    <div className="flex h-full">
      <a
        href="#main"
        className="bg-brand-600 sr-only z-50 rounded px-3 py-2 text-white focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Sidebar />
      <main id="main" className="min-w-0 flex-1">
        <ErrorBoundary region="This page">
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
