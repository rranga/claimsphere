import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FolderOpen, Layers, UserCheck } from 'lucide-react';
import type { ComponentType } from 'react';
import { formatNumber } from '@/shared/lib/format';
import { Skeleton } from '@/shared/ui/Skeleton';
import { claimStatsQuery } from '../api/queries';

interface StatProps {
  label: string;
  value: number | undefined;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}

function Stat({ label, value, hint, icon: Icon }: StatProps) {
  return (
    <div className="short:py-3 flex items-center gap-4 bg-white px-4 py-3 sm:px-6 sm:py-5">
      <span className="bg-success-50 text-success-500 short:size-11 hidden size-14 shrink-0 items-center justify-center rounded-full sm:flex">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-muted text-xs">{label}</p>
        {value === undefined ? (
          <Skeleton className="mt-1 h-7 w-20" />
        ) : (
          <p className="text-xl font-semibold tracking-tight sm:text-2xl">{formatNumber(value)}</p>
        )}
        <p className="text-muted hidden text-[11px] sm:block">{hint}</p>
      </div>
    </div>
  );
}

/** KPI strip from the Figma design, mapped to the claims domain. Numbers respect the user's data scope. */
export function StatCards() {
  const { data } = useQuery(claimStatsQuery());
  return (
    <section
      aria-label="Claim statistics"
      // 1 px gaps over a line-coloured background draw dividers that work for 2 or 4 columns.
      className="shadow-card bg-line grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-2xl sm:rounded-3xl xl:grid-cols-4"
    >
      <Stat label="Claims in scope" value={data?.total} hint="Visible to your role" icon={Layers} />
      <Stat label="Open claims" value={data?.open} hint="Awaiting adjudication" icon={FolderOpen} />
      <Stat label="High risk" value={data?.highRisk} hint="Risk score ≥ 75" icon={AlertTriangle} />
      <Stat label="Assigned to me" value={data?.assignedToMe} hint="Your work queue" icon={UserCheck} />
    </section>
  );
}
