import type { Dispatch, UnknownAction } from '@reduxjs/toolkit';
import { useCallback } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { toast } from 'sonner';
import type { DocumentOperation } from '@/shared/api/contracts';
import { applyOperation, DocumentOperationError } from '@/shared/domain/documentOperations';
import { selectWorkingDocuments, workspaceActions, type WorkspaceState } from './workspaceSlice';

/** The feature only knows about its own slice — it does not depend on the app's RootState. */
type WorkspaceRoot = { workspace: WorkspaceState };

export const useWorkspaceSelector = useSelector.withTypes<WorkspaceRoot>();
export const useWorkspaceDispatch = useDispatch.withTypes<Dispatch<UnknownAction>>();

/**
 * Apply a document command after validating it against the current draft with the same pure
 * engine the server uses. Invalid commands never enter the undo stack.
 */
export function useApplyOperation() {
  const store = useStore<WorkspaceRoot>();
  const dispatch = useWorkspaceDispatch();
  return useCallback(
    (op: DocumentOperation): boolean => {
      try {
        applyOperation(selectWorkingDocuments(store.getState()), op);
      } catch (error) {
        if (error instanceof DocumentOperationError) {
          toast.error(error.message);
          return false;
        }
        throw error;
      }
      dispatch(workspaceActions.operationApplied(op));
      return true;
    },
    [store, dispatch],
  );
}
