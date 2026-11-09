import type { ClaimPriority, ClaimStatus } from '@/shared/api/contracts';
import { cn } from '@/shared/lib/cn';
import { Badge, type BadgeTone } from '@/shared/ui/Badge';

const STATUS_TONE: Record<ClaimStatus, BadgeTone> = {
  New: 'info',
  'In Review': 'brand',
  'Pending Info': 'warning',
  Approved: 'success',
  Rejected: 'danger',
  Closed: 'neutral',
};

export function StatusBadge({ status }: { status: ClaimStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}

const PRIORITY_DOT: Record<ClaimPriority, string> = {
  Low: 'bg-gray-300',
  Medium: 'bg-info-600',
  High: 'bg-warning-600',
  Critical: 'bg-danger-500',
};

export function PriorityLabel({ priority, riskScore }: { priority: ClaimPriority; riskScore: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span aria-hidden="true" className={cn('size-2 rounded-full', PRIORITY_DOT[priority])} />
      <span>{priority}</span>
      <span className="text-muted text-xs" title="Risk score (0–100)">
        {riskScore}
      </span>
    </span>
  );
}
