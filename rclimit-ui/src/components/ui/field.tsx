import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
  // The control. Field wires id, aria-describedby, aria-invalid and aria-required onto it.
  children: ReactNode;
  id?: string;
}

// §8.2: label above, hint below, error replaces hint.
export function Field({ label, hint, error, required, optional, className, children, id }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const messageId = `${controlId}-msg`;
  const message = error ?? hint;

  const child = Children.only(children);
  const control = isValidElement(child)
    ? cloneElement(child as ReactElement<Record<string, unknown>>, {
        id: (child.props as { id?: string }).id ?? controlId,
        'aria-describedby': message ? messageId : undefined,
        'aria-invalid': error ? true : undefined,
        'aria-required': required || undefined,
      })
    : child;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={controlId} className="text-label text-foreground">
        {label}
        {required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </label>
      {control}
      {message && (
        <p id={messageId} className={cn('flex items-start gap-1 text-caption', error ? 'text-danger' : 'text-muted-foreground')}>
          {error && <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />}
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}

// Lays out fields: one column on mobile, `columns` from md up.
export function FieldGrid({ columns = 2, className, children }: { columns?: 1 | 2 | 3; className?: string; children: ReactNode }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4', columns === 2 && 'md:grid-cols-2', columns === 3 && 'md:grid-cols-3', className)}>
      {children}
    </div>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-subheading text-foreground">{title}</h3>
        {description && <p className="text-caption text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
