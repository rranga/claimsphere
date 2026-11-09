import { createBrowserRouter, Navigate } from 'react-router';
import { RequireAuth } from '@/features/auth';
import { ClaimsPage } from '@/pages/ClaimsPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { loadWorkspacePage } from '@/pages/workspaceRoute';
import { AppShell } from './layout/AppShell';

export const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    {
      element: <RequireAuth />,
      errorElement: <RouteErrorPage />,
      children: [
        {
          element: <AppShell />,
          children: [
            { index: true, element: <Navigate to="/claims" replace /> },
            { path: 'claims', element: <ClaimsPage /> },
            {
              path: 'claims/:claimId',
              lazy: async () => ({ Component: (await loadWorkspacePage()).WorkspacePage }),
            },
          ],
        },
      ],
    },
    { path: '*', element: <NotFoundPage /> },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);
