import type { ReactNode } from 'react';
import { DropdownMenu, Popover as PopoverPrimitive } from 'radix-ui';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './button';

// §8.15 DropdownMenu for overflow actions; destructive items sit at the bottom behind a separator.

export interface MenuAction {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  // Shown as a caption under a disabled item.
  disabledReason?: string;
  hidden?: boolean;
}

interface ActionMenuProps {
  actions: MenuAction[];
  label?: string;
  trigger?: ReactNode;
  align?: 'start' | 'end';
}

export function ActionMenu({ actions, label = 'More actions', trigger, align = 'end' }: ActionMenuProps) {
  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return null;
  const normal = visible.filter((a) => !a.danger);
  const danger = visible.filter((a) => a.danger);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" aria-label={label}>
            <MoreHorizontal />
          </Button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <MenuContent align={align}>
          {normal.map((a) => <MenuItem key={a.label} action={a} />)}
          {normal.length > 0 && danger.length > 0 && <DropdownMenu.Separator className="my-1 h-px bg-border" />}
          {danger.map((a) => <MenuItem key={a.label} action={a} />)}
        </MenuContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function MenuContent({ children, align = 'end', className }: { children: ReactNode; align?: 'start' | 'end'; className?: string }) {
  return (
    <DropdownMenu.Content
      align={align}
      sideOffset={4}
      className={cn('z-tooltip min-w-44 rounded-md border bg-surface-raised p-1 text-foreground shadow-md animate-fade-in', className)}
    >
      {children}
    </DropdownMenu.Content>
  );
}

function MenuItem({ action }: { action: MenuAction }) {
  const Icon = action.icon;
  return (
    <DropdownMenu.Item
      disabled={action.disabled}
      onSelect={action.onSelect}
      className={cn(
        'flex cursor-default select-none items-start gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted pointer-coarse:py-3',
        action.danger && 'text-danger',
      )}
    >
      {Icon && <Icon aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />}
      <span>
        {action.label}
        {action.disabled && action.disabledReason && <span className="block text-caption text-muted-foreground">{action.disabledReason}</span>}
      </span>
    </DropdownMenu.Item>
  );
}

export { DropdownMenu };

export function Popover({ trigger, children, align = 'start', className, open, onOpenChange }: {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={4}
          className={cn('z-tooltip w-72 rounded-md border bg-surface-raised p-3 text-foreground shadow-md outline-none animate-fade-in', className)}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
