import { describe, expect, it } from 'vitest';
import type { ClaimPage, ClaimStats } from '@/shared/api/contracts';

/**
 * Contract tests against the mock backend: authorization is enforced on the SERVER,
 * independently of what the UI shows or hides.
 */
const call = (path: string, userId: string | null, init: RequestInit = {}) =>
  fetch(`http://localhost:3000/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(userId && { Authorization: `Bearer demo.${userId}` }),
      ...init.headers,
    },
  });

const ADJUSTER = 'u-evano'; // EMEA
const AUDITOR = 'u-marcus'; // viewer, all regions
const ADMIN = 'u-sofia';

describe('API authorization', () => {
  it('rejects unauthenticated requests', async () => {
    expect((await call('/claims', null)).status).toBe(401);
  });

  it('scopes records to the user: adjusters only see their region', async () => {
    const adjuster = (await (await call('/claims?limit=500', ADJUSTER)).json()) as ClaimPage;
    const auditor = (await (await call('/claims?limit=1', AUDITOR)).json()) as ClaimPage;
    expect(adjuster.rows.every((c) => c.region === 'EMEA')).toBe(true);
    expect(adjuster.total).toBeLessThan(auditor.total);
    expect(auditor.total).toBeGreaterThanOrEqual(20_000);
  });

  it('computes row-level allowedActions per user', async () => {
    const auditorRows = ((await (await call('/claims?limit=50', AUDITOR)).json()) as ClaimPage).rows;
    expect(auditorRows.every((c) => c.allowedActions.join() === 'view')).toBe(true);

    const adminRows = ((await (await call('/claims?limit=50', ADMIN)).json()) as ClaimPage).rows;
    expect(adminRows.every((c) => c.allowedActions.includes('delete'))).toBe(true);
  });

  it('returns 403 when a role without permission calls the API directly (UI bypass)', async () => {
    const claim = ((await (await call('/claims?limit=1', AUDITOR)).json()) as ClaimPage).rows[0]!;
    const res = await call(`/claims/${claim.id}`, AUDITOR, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('hides out-of-scope records as 404 (no existence leak)', async () => {
    const page = (await (await call('/claims?limit=200', ADMIN)).json()) as ClaimPage;
    const apac = page.rows.find((c) => c.region === 'APAC')!;
    const res = await call(`/claims/${apac.id}/documents`, ADJUSTER);
    expect(res.status).toBe(404);
  });

  it('rejects stale writes with 409 (optimistic concurrency)', async () => {
    const claim = ((await (await call('/claims?limit=1&status=New', ADMIN)).json()) as ClaimPage).rows[0]!;
    const ok = await call(`/claims/${claim.id}`, ADMIN, {
      method: 'PATCH',
      body: JSON.stringify({ version: claim.version, changes: { priority: 'High' } }),
    });
    expect(ok.status).toBe(200);
    const stale = await call(`/claims/${claim.id}`, ADMIN, {
      method: 'PATCH',
      body: JSON.stringify({ version: claim.version, changes: { priority: 'Low' } }),
    });
    expect(stale.status).toBe(409);
  });

  it('applies filtering and sorting on the server', async () => {
    const page = (await (
      await call('/claims?limit=100&status=Approved&sortBy=amount&sortDir=desc', ADMIN)
    ).json()) as ClaimPage;
    expect(page.rows.every((c) => c.status === 'Approved')).toBe(true);
    const amounts = page.rows.map((c) => c.amount);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  it('stats respect the data scope', async () => {
    const stats = (await (await call('/claims/stats', ADJUSTER)).json()) as ClaimStats;
    const page = (await (await call('/claims?limit=1', ADJUSTER)).json()) as ClaimPage;
    expect(stats.total).toBe(page.total);
    expect(stats.assignedToMe).toBeGreaterThan(0);
  });
});
