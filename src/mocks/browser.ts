import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

export function startMockServer() {
  return worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    // Static assets (JS chunks, PDFs fetched with Range requests) go straight to the network.
    onUnhandledRequest: 'bypass',
    quiet: true,
  });
}
