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
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from 'lucide-react';
import { NavLink } from 'react-router';
import { useCurrentSession, useSession } from '@/features/auth';
import { cn } from '@/shared/lib/cn';
import { MEDIA, useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Tooltip } from '@/shared/ui/Tooltip';
import { useSidebarCollapsed } from './useSidebarCollapsed';

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

/**
 * Primary navigation with the two Figma states: expanded (256 px) and minimized (102 px, icons
 * only). In the minimized state every item keeps its accessible name (visually hidden label) and
 * shows it in a tooltip on hover and keyboard focus.
 *
 * Responsive: on phones and tablets in portrait (< 1024 px) the sidebar is always the icon rail
 * (64 px on phones, 102 px on tablets) and the expand toggle is not offered.
 */
export function Sidebar() {
  const { user } = useCurrentSession();
  const { signOut } = useSession();
  const [userCollapsed, toggle] = useSidebarCollapsed();
  const compactScreen = useMediaQuery(MEDIA.compact);
  const collapsed = compactScreen || userCollapsed;
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <aside
      id="primary-sidebar"
      data-collapsed={collapsed}
      className={cn(
        'border-line flex shrink-0 flex-col overflow-hidden border-r bg-white transition-[width] duration-200',
        collapsed ? 'w-16 sm:w-[102px]' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex items-center pt-9 pb-8',
          collapsed ? 'flex-col gap-5 max-sm:pt-6' : 'gap-1.5 pr-3 pl-6',
        )}
      >
        <Hexagon className="text-ink size-7 shrink-0" strokeWidth={2.2} aria-hidden="true" />
        {collapsed ? (
          <span className="sr-only">ClaimSphere</span>
        ) : (
          <>
            <span className="text-xl font-semibold tracking-tight">ClaimSphere</span>
            <span className="text-muted mt-1.5 text-[10px]">v0.1</span>
          </>
        )}
        {!compactScreen && (
          <Tooltip content={toggleLabel} side="right">
            <button
              type="button"
              onClick={toggle}
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              aria-controls="primary-sidebar"
              className={cn(
                'text-muted hover:bg-brand-50 hover:text-ink shrink-0 rounded-lg p-1',
                !collapsed && 'ml-auto',
              )}
            >
              <ToggleIcon className="size-5" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>

      <nav aria-label="Primary" className={cn('flex-1', collapsed ? 'px-0' : 'px-5')}>
        <ul className={cn('grid gap-2', collapsed && 'justify-items-center')}>
          {NAV.map(({ to, label, icon: Icon, enabled }) => (
            <li key={to}>
              <Tooltip content={collapsed ? (enabled ? label : `${label} (coming soon)`) : null} side="right">
                {enabled ? (
                  <NavLink
                    to={to}
                    // String className (not a function) so it survives the Tooltip's Slot merge;
                    // the active state is styled from the aria-current="page" NavLink sets.
                    className={cn(
                      'text-muted hover:bg-brand-50 hover:text-ink flex items-center rounded-lg text-sm transition-colors',
                      'aria-[current=page]:bg-brand-600 aria-[current=page]:text-white aria-[current=page]:shadow-md',
                      'aria-[current=page]:hover:bg-brand-700 aria-[current=page]:hover:text-white',
                      collapsed ? 'size-11 justify-center' : 'gap-3 px-3 py-2.5',
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    <span className={collapsed ? 'sr-only' : 'flex-1'}>{label}</span>
                    {!collapsed && <ChevronRight className="size-4" aria-hidden="true" />}
                  </NavLink>
                ) : (
                  <span
                    // Disabled-link pattern: focusable, so keyboard users also learn it is "coming soon".
                    role="link"
                    tabIndex={0}
                    aria-disabled="true"
                    className={cn(
                      'text-muted flex cursor-not-allowed items-center rounded-lg text-sm',
                      collapsed ? 'size-11 justify-center' : 'gap-3 px-3 py-2.5',
                    )}
                    title={collapsed ? undefined : 'Out of scope for this case study'}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    <span className={collapsed ? 'sr-only' : 'flex-1'}>
                      {label}
                      {collapsed && ' (coming soon)'}
                    </span>
                    {!collapsed && (
                      <span className="text-muted rounded bg-gray-100 px-1.5 text-[10px]">Soon</span>
                    )}
                  </span>
                )}
              </Tooltip>
            </li>
          ))}
        </ul>
      </nav>

      {!collapsed && (
        <div className="to-brand-600 m-5 rounded-2xl bg-gradient-to-br from-[#eaabf0] p-4 text-center text-xs text-white">
          <p className="font-medium">Demo tip</p>
          <p className="mt-1 opacity-90">
            Sign in with different roles to see RBAC change the UI — and the data.
          </p>
        </div>
      )}

      <DropdownMenu.Root>
        <Tooltip content={collapsed ? `${user.name} · ${ROLE_LABEL[user.role]}` : null} side="right">
          {/* No aria-label: the visible text names the button (WCAG 2.5.3 Label in Name). */}
          <DropdownMenu.Trigger
            className={cn(
              'hover:bg-canvas mb-6 flex items-center rounded-xl p-2 text-left',
              collapsed ? 'mx-auto' : 'mx-4 gap-3',
            )}
          >
            <Avatar name={user.name} color={user.avatarColor} />
            {collapsed && (
              <span className="sr-only">
                {user.name}, {ROLE_LABEL[user.role]} — account menu
              </span>
            )}
            {!collapsed && (
              <>
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
              </>
            )}
          </DropdownMenu.Trigger>
        </Tooltip>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side={collapsed ? 'right' : 'top'}
            align={collapsed ? 'end' : 'start'}
            sideOffset={8}
            className="border-line z-30 min-w-56 rounded-xl border bg-white p-1.5 shadow-xl"
          >
            <DropdownMenu.Label className="text-muted px-2 py-1 text-xs">
              {user.name} · {user.region} · {ROLE_LABEL[user.role]}
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
