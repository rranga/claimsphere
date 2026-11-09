import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionContext, type SessionContextValue } from '@/features/auth/sessionContext';
import type { Claim, Permission, Role } from '@/shared/api/contracts';
import { TooltipProvider } from '@/shared/ui/Tooltip';
import { RowActions } from './RowActions';

const PERMS: Record<Role, Permission[]> = {
  viewer: ['claim:read'],
  adjuster: ['claim:read', 'claim:edit'],
  supervisor: ['claim:read', 'claim:edit', 'claim:assign'],
  admin: ['claim:read', 'claim:edit', 'claim:assign', 'claim:delete'],
};

const claim = (overrides: Partial<Claim> = {}): Claim => ({
  id: 'c-1',
  claimNumber: 'CLM-1',
  policyNumber: 'POL-1',
  claimant: 'Jane Cooper',
  lineOfBusiness: 'Property',
  channel: 'Email',
  status: 'In Review',
  priority: 'High',
  riskScore: 70,
  amount: 1000,
  region: 'EMEA',
  lossDate: '',
  receivedAt: '',
  assigneeId: 'someone-else',
  assigneeName: 'Someone Else',
  documentCount: 1,
  documentBytes: 1,
  version: 1,
  allowedActions: ['view'],
  ...overrides,
});

function renderAs(role: Role, row: Claim, onAction = vi.fn()) {
  const value: SessionContextValue = {
    status: 'authenticated',
    session: {
      token: 't',
      permissions: PERMS[role],
      user: { id: 'me', name: 'Me', title: '', role, region: 'EMEA', avatarColor: '#000' },
    },
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
  render(
    <SessionContext.Provider value={value}>
      <TooltipProvider>
        <RowActions claim={row} onAction={onAction} />
      </TooltipProvider>
    </SessionContext.Provider>,
  );
  return onAction;
}

describe('RowActions RBAC presentation', () => {
  it('hides actions the role can never perform', () => {
    renderAs('viewer', claim());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('disables (but keeps discoverable) actions not allowed on this record, with a reason', async () => {
    const onAction = renderAs('adjuster', claim({ allowedActions: ['view'] }));
    const edit = screen.getByRole('button', {
      name: /edit claim \(unavailable: only the assigned adjuster/i,
    });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(edit);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('enables actions the server allows for this row', async () => {
    const row = claim({ allowedActions: ['view', 'edit', 'assign', 'delete'] });
    const onAction = renderAs('admin', row);
    await userEvent.click(screen.getByRole('button', { name: 'Delete claim' }));
    expect(onAction).toHaveBeenCalledWith('delete', row);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
