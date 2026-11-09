/**
 * Lightweight public API (safe to import from eagerly loaded screens).
 * The heavy workspace UI — and pdf.js — live behind `./workspace`, imported only by the lazy route.
 */
import type { SourceFile } from '@/shared/api/contracts';

export { claimDocumentsQuery, documentKeys } from './api/documentsApi';
export { workspaceReducer } from './model/workspaceSlice';

/** Warm the first page of a document; loads the pdf engine chunk on demand. */
export const prefetchFirstPage = (file: SourceFile) =>
  import('./viewer/pdfEngine').then((engine) => engine.prefetchFirstPage(file));
