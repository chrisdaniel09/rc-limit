import { createContext, useContext, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Button } from './button';
import { Alert } from './alert';

// §8.11 ResponsiveDialog: a centered dialog from md up, a bottom sheet below; `variant="sheet"` is the right side sheet.

type Size = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const DIALOG_WIDTH: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
};

const SHEET_WIDTH: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-[480px]',
  lg: 'max-w-[560px]',
  xl: 'max-w-[640px]',
  '2xl': 'max-w-[880px]',
};

const ModeContext = createContext<'dialog' | 'drawer'>('dialog');

export interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  size?: Size;
  variant?: 'dialog' | 'sheet';
  children: ReactNode;
  footer?: ReactNode;
  // When true, closing asks "Discard changes?" first (§11.4).
  dirty?: boolean;
  // Wraps body + footer in a <form>; Ctrl/⌘ Enter submits (§11.6).
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  // Server error shown as an alert at the top of the body (§11.1).
  error?: ReactNode;
  className?: string;
}

export function ResponsiveDialog({
  open, onOpenChange, title, description, size = 'md', variant = 'dialog', children, footer, dirty, onSubmit, error, className,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const requestClose = (next: boolean) => {
    if (!next && dirty) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  };

  const body = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {error && <Alert tone="danger" className="mb-4" role="alert">{error}</Alert>}
        {children}
      </div>
      {footer && (
        <div className="flex flex-col-reverse gap-2 border-t bg-surface px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:flex-row md:justify-end md:pb-3 [&>*]:w-full md:[&>*]:w-auto">
          {footer}
        </div>
      )}
    </>
  );

  const content = onSubmit ? (
    <form
      ref={formRef}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          formRef.current?.requestSubmit();
        }
      }}
    >
      {body}
    </form>
  ) : body;

  const discard = (
    <ConfirmDiscard
      open={confirmDiscard}
      onCancel={() => setConfirmDiscard(false)}
      onDiscard={() => {
        setConfirmDiscard(false);
        onOpenChange(false);
      }}
    />
  );

  if (isMobile) {
    return (
      <ModeContext.Provider value="drawer">
        <Drawer.Root open={open} onOpenChange={requestClose} repositionInputs>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-overlay bg-overlay" />
            <Drawer.Content
              className={cn('fixed inset-x-0 bottom-0 z-overlay flex max-h-[92dvh] flex-col rounded-t-2xl border-t bg-surface-raised outline-none', className)}
            >
              <div aria-hidden className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30" />
              <Header title={title} description={description} onClose={() => requestClose(false)} titleAs={Drawer.Title} descriptionAs={Drawer.Description} />
              {content}
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
        {discard}
      </ModeContext.Provider>
    );
  }

  const isSheet = variant === 'sheet';
  return (
    <ModeContext.Provider value="dialog">
      <DialogPrimitive.Root open={open} onOpenChange={requestClose}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-overlay animate-fade-in" />
          <DialogPrimitive.Content
            className={cn(
              'fixed z-overlay flex flex-col bg-surface-raised text-foreground shadow-xl outline-none dark:border',
              isSheet
                ? cn('inset-y-0 right-0 h-full w-full border-l animate-sheet-in', SHEET_WIDTH[size])
                : cn('left-1/2 top-1/2 max-h-[90dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg animate-dialog-in', DIALOG_WIDTH[size]),
              className,
            )}
          >
            <Header title={title} description={description} onClose={() => requestClose(false)} titleAs={DialogPrimitive.Title} descriptionAs={DialogPrimitive.Description} />
            {content}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      {discard}
    </ModeContext.Provider>
  );
}

type TitleComponent = React.ComponentType<{ className?: string; children?: ReactNode }>;

function Header({ title, description, onClose, titleAs: Title, descriptionAs: Description }: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  titleAs: TitleComponent;
  descriptionAs: TitleComponent;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
      <div className="min-w-0">
        <Title className="text-heading text-foreground">{title}</Title>
        {description
          ? <Description className="mt-0.5 text-caption text-muted-foreground">{description}</Description>
          : <Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</Description>}
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose} className="-mr-2 -mt-1">
        <X />
      </Button>
    </div>
  );
}

export function useDialogMode() {
  return useContext(ModeContext);
}

function ConfirmDiscard({ open, onCancel, onDiscard }: { open: boolean; onCancel: () => void; onDiscard: () => void }) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => !o && onCancel()}
      title="Discard changes?"
      description="What you entered in this form will be lost."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      tone="danger"
      onConfirm={onDiscard}
    />
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  // For irreversible money actions: the user must type this text to enable the button (§8.12).
  typeToConfirm?: string;
  children?: ReactNode;
}

// §8.12: title states the action, body the consequence, buttons use the verb.
export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel, cancelLabel = 'Cancel', tone = 'primary', loading, onConfirm, typeToConfirm, children,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const blocked = typeToConfirm != null && typed.trim() !== typeToConfirm;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped('');
        onOpenChange(o);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-overlay animate-fade-in" />
        <DialogPrimitive.Content
          role="alertdialog"
          className="fixed left-1/2 top-1/2 z-overlay w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface-raised p-5 text-foreground shadow-xl outline-none animate-dialog-in dark:border"
        >
          <DialogPrimitive.Title className="text-heading">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className={cn('mt-1.5 text-sm text-muted-foreground', !description && 'sr-only')}>
            {description ?? title}
          </DialogPrimitive.Description>
          {children && <div className="mt-4">{children}</div>}
          {typeToConfirm != null && (
            <label className="mt-4 block text-sm">
              <span className="text-muted-foreground">Type <span className="id-mono font-medium text-foreground">{typeToConfirm}</span> to confirm</span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="mt-1.5 block h-control w-full rounded-md border border-input bg-surface px-3 text-sm"
                autoComplete="off"
              />
            </label>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogPrimitive.Close asChild>
              <Button variant="outline">{cancelLabel}</Button>
            </DialogPrimitive.Close>
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              loading={loading || busy}
              disabled={blocked}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
