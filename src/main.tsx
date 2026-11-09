import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AppProviders } from '@/app/AppProviders';
import { router } from '@/app/router';
import './index.css';

/**
 * The mock backend (MSW) is started before the first render so no request escapes it.
 * In a real deployment this block is removed and requests go to the API gateway.
 */
async function bootstrap() {
  const { startMockServer } = await import('@/mocks/browser');
  await startMockServer();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
}

void bootstrap();
