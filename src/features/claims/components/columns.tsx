import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Claim, SortField } from '@/shared/api/contracts';
import { formatBytes, formatCurrency, formatDate } from '@/shared/lib/format';
import { PriorityLabel, StatusBadge } from './ClaimBadges';

export interface ClaimColumn {
  id: string;
  header: string;
  /** Present when the server supports sorting by this column. */
  sortField?: SortField;
  align?: 'right';
  cell: (claim: Claim) => ReactNode;
}

/** Column model is plain data → header and rows share it, and adding a column is a one-line change. */
export const CLAIM_COLUMNS: ClaimColumn[] = [
  {
    id: 'claim',
    header: 'Claim',
    sortField: 'claimNumber',
    cell: (c) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{c.claimNumber}</div>
        <div className="text-muted truncate text-xs">{c.policyNumber}</div>
      </div>
    ),
  },
  {
    id: 'claimant',
    header: 'Claimant',
    sortField: 'claimant',
    cell: (c) => <span className="truncate">{c.claimant}</span>,
  },
  { id: 'lob', header: 'Line', sortField: 'lineOfBusiness', cell: (c) => c.lineOfBusiness },
  { id: 'channel', header: 'Channel', sortField: 'channel', cell: (c) => c.channel },
  { id: 'received', header: 'Received', sortField: 'receivedAt', cell: (c) => formatDate(c.receivedAt) },
  {
    id: 'amount',
    header: 'Amount',
    sortField: 'amount',
    align: 'right',
    cell: (c) => <span className="tabular-nums">{formatCurrency(c.amount)}</span>,
  },
  {
    id: 'priority',
    header: 'Priority',
    sortField: 'priority',
    cell: (c) => <PriorityLabel priority={c.priority} riskScore={c.riskScore} />,
  },
  {
    id: 'assignee',
    header: 'Assignee',
    sortField: 'assigneeName',
    cell: (c) =>
      c.assigneeName ? (
        <span className="truncate">{c.assigneeName}</span>
      ) : (
        <span className="text-muted">Unassigned</span>
      ),
  },
  { id: 'status', header: 'Status', sortField: 'status', cell: (c) => <StatusBadge status={c.status} /> },
  {
    id: 'docs',
    header: 'Documents',
    cell: (c) => (
      <span className="text-muted inline-flex items-center gap-1.5 text-xs">
        <FileText className="size-3.5" aria-hidden="true" />
        {c.documentCount} · {formatBytes(c.documentBytes)}
      </span>
    ),
  },
];

/** Shared CSS grid template so header and (absolutely positioned) virtual rows always align. */
export const GRID_TEMPLATE =
  'minmax(150px,1.1fr) minmax(170px,1.3fr) 90px 80px 112px 120px 140px minmax(140px,1fr) 120px 130px 112px';

export const ROW_HEIGHT = 56;
