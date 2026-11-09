import type { Claim, ClaimPage, ClaimQuery, ClaimStats, ClaimUpdate, User } from '@/shared/api/contracts';
import { http } from '@/shared/api/http';

function toSearch(query: ClaimQuery, offset: number, limit: number): string {
  const search = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  });
  if (query.q) search.set('q', query.q);
  if (query.status?.length) search.set('status', query.status.join(','));
  if (query.priority?.length) search.set('priority', query.priority.join(','));
  if (query.channel?.length) search.set('channel', query.channel.join(','));
  return search.toString();
}

export const claimsApi = {
  list: (query: ClaimQuery, offset: number, limit: number, signal?: AbortSignal) =>
    http<ClaimPage>(`/claims?${toSearch(query, offset, limit)}`, { signal }),
  stats: (signal?: AbortSignal) => http<ClaimStats>('/claims/stats', { signal }),
  update: (claim: Pick<Claim, 'id' | 'version'>, changes: ClaimUpdate) =>
    http<Claim>(`/claims/${claim.id}`, { method: 'PATCH', body: { version: claim.version, changes } }),
  assign: (claim: Pick<Claim, 'id' | 'version'>, assigneeId: string | null) =>
    http<Claim>(`/claims/${claim.id}/assign`, {
      method: 'POST',
      body: { version: claim.version, assigneeId },
    }),
  remove: (id: string) => http<void>(`/claims/${id}`, { method: 'DELETE' }),
  assignableUsers: (region: string, signal?: AbortSignal) =>
    http<User[]>(`/users/assignable?region=${encodeURIComponent(region)}`, { signal }),
};
