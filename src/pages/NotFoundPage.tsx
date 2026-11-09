import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="text-brand-600 text-5xl font-semibold">404</p>
      <h1 className="text-lg font-medium">Page not found</h1>
      <Link to="/claims" className="text-brand-600 text-sm underline">
        Back to claims
      </Link>
    </main>
  );
}
