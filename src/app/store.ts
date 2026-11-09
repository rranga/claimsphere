import { configureStore } from '@reduxjs/toolkit';
import { workspaceReducer } from '@/features/documents';

/**
 * Redux holds *client-owned* state only (document editing draft, selection, tools).
 * Server data lives in TanStack Query, URL-addressable view state in the router,
 * and the session in React Context — see docs/ARCHITECTURE.md › State management.
 */
export const createStore = () =>
  configureStore({
    reducer: { workspace: workspaceReducer },
    devTools: import.meta.env.DEV,
  });

export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<AppStore['getState']>;
