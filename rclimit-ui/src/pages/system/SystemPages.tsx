import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Compass, RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import type { ProblemDetailsError } from '@/api/client';

// §10.16 system pages.

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="This page doesn't exist"
      description="The link may be old, or the page has moved."
      action={<Button asChild><Link to="/">Go to dashboard</Link></Button>}
      className="py-20"
    />
  );
}

export function ForbiddenPage({ right }: { right: string }) {
  return (
    <EmptyState
      variant="no-access"
      title="You don't have access to this page"
      description={<>Ask an admin for the <span className="id-mono text-foreground">{right}</span> right.</>}
      action={<Button variant="outline" asChild><Link to="/">Go to dashboard</Link></Button>}
      className="py-20"
    />
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <div className="p-6"><NotFoundPage /></div>;
  }
  const correlationId = (error as Partial<ProblemDetailsError> | null)?.problemDetails?.correlationId;
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description={
          <>
            {message}
            {correlationId && <span className="mt-2 block text-caption">Reference <span className="id-mono">{correlationId}</span></span>}
          </>
        }
        action={<Button icon={RotateCw} onClick={() => window.location.reload()}>Reload</Button>}
      />
    </div>
  );
}
