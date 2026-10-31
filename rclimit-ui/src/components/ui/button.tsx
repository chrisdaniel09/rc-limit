import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Tooltip } from './tooltip';

// §8.1 Button.
export const buttonVariants = cva(
  'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,transform] duration-[120ms] ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:active:scale-100 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-muted text-foreground hover:bg-muted/70',
        outline: 'border border-input bg-surface text-foreground hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
        danger: 'bg-danger text-danger-foreground hover:bg-danger/90',
        'outline-danger': 'border border-danger/40 bg-surface text-danger hover:bg-danger-subtle',
        link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs pointer-coarse:min-h-12',
        md: 'h-control px-3.5',
        lg: 'h-11 px-5',
        icon: 'size-control',
        'icon-sm': 'size-7 pointer-coarse:size-12',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  // Shown in place of the label while loading ("Disbursing…"); the label is kept otherwise.
  loadingText?: string;
  icon?: LucideIcon;
  // When set, the button is aria-disabled (still focusable) and explains why in a tooltip (§9.2).
  disabledReason?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, loading, loadingText, icon: Icon, disabledReason, children, onClick, type = 'button', ...props },
  ref,
) {
  const blocked = Boolean(disabledReason) || loading;
  const Comp = asChild ? Slot.Root : 'button';
  const button = (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      aria-disabled={blocked || undefined}
      aria-busy={loading || undefined}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        if (blocked) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...props}
    >
      {asChild ? children : (
        <>
          {loading ? <Loader2 aria-hidden className="animate-spin" /> : Icon && <Icon aria-hidden strokeWidth={1.75} />}
          {loading && loadingText ? loadingText : children}
        </>
      )}
    </Comp>
  );
  if (disabledReason && !loading) return <Tooltip content={disabledReason}>{button}</Tooltip>;
  return button;
});
