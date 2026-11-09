import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, Rows3, Search, TableProperties, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  CLAIM_CHANNELS,
  CLAIM_PRIORITIES,
  CLAIM_STATUSES,
  type SortDirection,
  type SortField,
} from '@/shared/api/contracts';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { cn } from '@/shared/lib/cn';
import type { GridParams } from '../model/gridParams';

/** The card layout (< 1024 px) has no column headers, so sorting is offered as a select. */
const SORT_OPTIONS: { field: SortField; dir: SortDirection; label: string }[] = [
  { field: 'receivedAt', dir: 'desc', label: 'Newest first' },
  { field: 'receivedAt', dir: 'asc', label: 'Oldest first' },
  { field: 'amount', dir: 'desc', label: 'Amount: high to low' },
  { field: 'amount', dir: 'asc', label: 'Amount: low to high' },
  { field: 'priority', dir: 'desc', label: 'Priority: highest first' },
  { field: 'riskScore', dir: 'desc', label: 'Risk: highest first' },
  { field: 'claimant', dir: 'asc', label: 'Claimant A–Z' },
];

interface FilterMenuProps<T extends string> {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
}

function FilterMenu<T extends string>({ label, options, selected, onChange }: FilterMenuProps<T>) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Filter by ${label.toLowerCase()}${selected.length ? ` (${selected.length} selected)` : ''}`}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium',
          selected.length
            ? 'border-brand-500 bg-brand-50 text-brand-700'
            : 'border-line bg-canvas text-ink hover:bg-white',
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="bg-brand-600 rounded-full px-1.5 text-[10px] text-white">{selected.length}</span>
        )}
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="animate-fade-in border-line z-30 min-w-44 rounded-xl border bg-white p-1.5 shadow-xl"
        >
          {options.map((option) => (
            <DropdownMenu.CheckboxItem
              key={option}
              checked={selected.includes(option)}
              onSelect={(event) => event.preventDefault()} // keep menu open for multi-select
              onCheckedChange={(checked) =>
                onChange(checked ? [...selected, option] : selected.filter((value) => value !== option))
              }
              className="data-[highlighted]:bg-brand-50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none"
            >
              <span className="border-line flex size-4 items-center justify-center rounded border">
                <DropdownMenu.ItemIndicator>
                  <Check className="text-brand-600 size-3" />
                </DropdownMenu.ItemIndicator>
              </span>
              {option}
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface Props {
  params: GridParams;
  onChange: (patch: Partial<GridParams>, options?: { replace?: boolean }) => void;
}

export function ClaimsToolbar({ params, onChange }: Props) {
  const [search, setSearch] = useState(params.q);
  const debounced = useDebouncedValue(search, 300);

  // Search is server-side: debounce so we send one request per pause, not per keystroke.
  useEffect(() => {
    if (debounced !== params.q) onChange({ q: debounced }, { replace: true });
  }, [debounced, params.q, onChange]);

  const filterCount = params.status.length + params.priority.length + params.channel.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative w-full sm:w-auto">
        <span className="sr-only">Search claims</span>
        <Search
          className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Claim #, policy or claimant"
          className="bg-canvas placeholder:text-subtle focus:border-brand-500 h-9 w-full rounded-lg border border-transparent pr-3 pl-9 text-xs focus:bg-white focus:outline-none sm:w-64"
        />
      </label>
      <FilterMenu
        label="Status"
        options={CLAIM_STATUSES}
        selected={params.status}
        onChange={(status) => onChange({ status })}
      />
      <FilterMenu
        label="Priority"
        options={CLAIM_PRIORITIES}
        selected={params.priority}
        onChange={(priority) => onChange({ priority })}
      />
      <FilterMenu
        label="Channel"
        options={CLAIM_CHANNELS}
        selected={params.channel}
        onChange={(channel) => onChange({ channel })}
      />
      <label className="lg:hidden">
        <span className="sr-only">Sort by</span>
        <select
          value={`${params.sortBy}:${params.sortDir}`}
          onChange={(event) => {
            const [sortBy, sortDir] = event.target.value.split(':') as [SortField, SortDirection];
            onChange({ sortBy, sortDir });
          }}
          className="border-line bg-canvas text-ink h-9 rounded-lg border px-2 text-xs"
        >
          {!SORT_OPTIONS.some((o) => o.field === params.sortBy && o.dir === params.sortDir) && (
            <option value={`${params.sortBy}:${params.sortDir}`}>
              Sorted by {params.sortBy} ({params.sortDir})
            </option>
          )}
          {SORT_OPTIONS.map((o) => (
            <option key={`${o.field}:${o.dir}`} value={`${o.field}:${o.dir}`}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {(filterCount > 0 || params.q) && (
        <button
          type="button"
          onClick={() => {
            setSearch('');
            onChange({ q: '', status: [], priority: [], channel: [] });
          }}
          className="text-muted hover:text-ink inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs"
        >
          <X className="size-3.5" aria-hidden="true" /> Clear
        </button>
      )}

      <div role="radiogroup" aria-label="Grid mode" className="bg-canvas ml-auto inline-flex rounded-lg p-1">
        {(
          [
            { value: 'virtual', label: 'Virtualized', icon: Rows3 },
            { value: 'paged', label: 'Paginated', icon: TableProperties },
          ] as const
        ).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={params.view === value}
            onClick={() => onChange({ view: value })}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium',
              params.view === value ? 'text-brand-700 bg-white shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
