import { Toaster as SonnerToaster, toast } from 'sonner';
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { ProblemDetailsError } from '@/api/client';

// §8.14: Sonner, bottom-right on desktop, top-center on mobile.
export function Toaster({ theme }: { theme: 'light' | 'dark' }) {
  const isMobile = useIsMobile();
  return (
    <SonnerToaster
      theme={theme}
      position={isMobile ? 'top-center' : 'bottom-right'}
      closeButton
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: 'z-toast !rounded-lg !border !border-border !bg-surface-raised !text-foreground !shadow-lg !font-sans',
          description: '!text-muted-foreground',
          actionButton: '!bg-primary !text-primary-foreground',
          cancelButton: '!bg-muted !text-foreground',
          error: '[&_[data-icon]]:!text-danger',
          success: '[&_[data-icon]]:!text-success',
        },
      }}
    />
  );
}

export function notifySuccess(message: string, options?: { description?: string; action?: { label: string; onClick: () => void } }) {
  toast.success(message, { description: options?.description, action: options?.action });
}

function correlationIdOf(err: unknown): string | undefined {
  const problem = (err as Partial<ProblemDetailsError> | null)?.problemDetails;
  return problem?.correlationId ?? problem?.traceId;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}

// Errors stay until dismissed and carry the correlation ID for support (§8.14).
export function notifyError(err: unknown, title = "That didn't work") {
  const message = errorMessage(err);
  const correlationId = correlationIdOf(err);
  toast.error(title, {
    description: correlationId ? `${message} · Ref ${correlationId}` : message,
    duration: Infinity,
    action: correlationId
      ? {
          label: 'Copy details',
          onClick: () => void navigator.clipboard?.writeText(`${title}\n${message}\nCorrelation ID: ${correlationId}`),
        }
      : undefined,
  });
}

export { toast };
