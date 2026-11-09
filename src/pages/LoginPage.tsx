import { useQuery } from '@tanstack/react-query';
import { Hexagon, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate, type Location } from 'react-router';
import { authApi, useSession } from '@/features/auth';
import type { Role } from '@/shared/api/contracts';
import { errorMessage } from '@/shared/api/http';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Spinner } from '@/shared/ui/Spinner';

const ROLE_SUMMARY: Record<Role, string> = {
  adjuster: 'EMEA queue · edits only claims assigned to them · documents, comments, annotations',
  supervisor: 'EMEA queue · edit & assign any open claim in the region',
  viewer: 'All regions · read-only (auditor) · no row actions, no document edits',
  admin: 'All regions · everything, including delete',
};

/** Demo sign-in: pick a persona. (Production: OIDC / Azure AD SSO.) */
export function LoginPage() {
  const { status, signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from;
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    data: users,
    isPending,
    error: loadError,
  } = useQuery({ queryKey: ['demo-users'], queryFn: ({ signal }) => authApi.listDemoUsers(signal) });

  if (status === 'authenticated') return <Navigate to="/claims" replace />;

  const choose = async (userId: string) => {
    setPending(userId);
    setError(null);
    try {
      await signIn(userId);
      void navigate(from ? `${from.pathname}${from.search}` : '/claims', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
      setPending(null);
    }
  };

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="shadow-card w-full max-w-xl rounded-3xl bg-white p-8">
        <div className="mb-6 flex items-center gap-2">
          <Hexagon className="size-8" strokeWidth={2.2} aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-tight">ClaimSphere</h1>
        </div>
        <p className="text-muted text-sm">
          Claims adjudication workspace — choose a demo persona. Each role sees different data and actions;
          the mock backend enforces the same rules on every request.
        </p>

        <ul className="mt-6 grid gap-3" aria-busy={isPending}>
          {isPending &&
            Array.from({ length: 4 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-[74px] w-full rounded-2xl" />
              </li>
            ))}
          {loadError && <li className="text-danger-500 text-sm">{errorMessage(loadError)}</li>}
          {users?.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => void choose(user.id)}
                disabled={pending !== null}
                className="border-line hover:border-brand-500 hover:bg-brand-50 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition disabled:opacity-60"
              >
                <Avatar name={user.name} color={user.avatarColor} className="size-11" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{user.name}</span>
                    <Badge tone="brand" className="capitalize">
                      {user.role}
                    </Badge>
                  </span>
                  <span className="text-muted mt-0.5 block text-xs">{ROLE_SUMMARY[user.role]}</span>
                </span>
                {pending === user.id && <Spinner className="text-brand-600" />}
              </button>
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="text-danger-500 mt-4 text-sm">
            {error}
          </p>
        )}
        <p className="text-muted mt-6 flex items-center gap-2 text-xs">
          <ShieldCheck className="text-success-500 size-4" aria-hidden="true" />
          Authorization is enforced server-side; the UI only adapts to it.
        </p>
      </div>
    </main>
  );
}
