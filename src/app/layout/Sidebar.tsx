import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  FileStack,
  Hexagon,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Settings,
} from 'lucide-react';
import { NavLink } from 'react-router';
import { useCurrentSession, useSession } from '@/features/auth';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';

const NAV = [
  { to: '/claims', label: 'Claims', icon: FileStack, enabled: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: false },
  { to: '/reports', label: 'Reports', icon: BarChart3, enabled: false },
  { to: '/settings', label: 'Settings', icon: Settings, enabled: false },
  { to: '/help', label: 'Help', icon: LifeBuoy, enabled: false },
];

const ROLE_LABEL = {
  viewer: 'Viewer',
  adjuster: 'Adjuster',
  supervisor: 'Supervisor',
  admin: 'Admin',
} as const;

export function Sidebar() {
  const { user } = useCurrentSession();
  const { signOut } = useSession();

  return (
    <aside className="border-line hidden w-64 shrink-0 flex-col border-r bg-white lg:flex">
      <div className="flex items-center gap-2 px-7 pt-9 pb-10">
        <Hexagon className="text-ink size-8" strokeWidth={2.2} aria-hidden="true" />
        <span className="text-2xl font-semibold tracking-tight">ClaimSphere</span>
        <span className="text-muted mt-2 text-[10px]">v0.1</span>
      </div>

      <nav aria-label="Primary" className="flex-1 px-5">
        <ul className="grid gap-2">
          {NAV.map(({ to, label, icon: Icon, enabled }) => (
            <li key={to}>
              {enabled ? (
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                      isActive
                        ? 'bg-brand-600 text-white shadow-md'
                        : 'text-muted hover:bg-brand-50 hover:text-ink',
                    )
                  }
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  <ChevronRight className="size-4" aria-hidden="true" />
                </NavLink>
              ) : (
                <span
                  className="text-muted flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
                  title="Out of scope for this case study"
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  <span className="text-muted rounded bg-gray-100 px-1.5 text-[10px]">Soon</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="to-brand-600 m-5 rounded-2xl bg-gradient-to-br from-[#eaabf0] p-4 text-center text-xs text-white">
        <p className="font-medium">Demo tip</p>
        <p className="mt-1 opacity-90">
          Sign in with different roles to see RBAC change the UI — and the data.
        </p>
      </div>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="hover:bg-canvas mx-4 mb-6 flex items-center gap-3 rounded-xl p-2 text-left">
          <Avatar name={user.name} color={user.avatarColor} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="text-muted flex items-center gap-1.5 text-xs">
              {user.title}
              <Badge tone="brand" className="h-4 px-1 text-[10px]">
                {ROLE_LABEL[user.role]}
              </Badge>
            </span>
          </span>
          <ChevronDown className="text-muted size-4" aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            align="start"
            className="border-line z-30 min-w-56 rounded-xl border bg-white p-1.5 shadow-xl"
          >
            <DropdownMenu.Label className="text-muted px-2 py-1 text-xs">
              {user.region} · {ROLE_LABEL[user.role]}
            </DropdownMenu.Label>
            <DropdownMenu.Item
              onSelect={signOut}
              className="data-[highlighted]:bg-brand-50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none"
            >
              <LogOut className="size-4" /> Switch user / sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </aside>
  );
}
