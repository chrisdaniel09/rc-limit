import { forwardRef } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import type { HateoasLink } from '@/hooks/useFetch';

// §9 HATEOAS-driven actions. Pages ask "can this run, and if not, why?" here instead of repeating the rules.

export interface ResourceAction {
  rel: string;
  available: boolean;
  reason?: string | null;
  reasonCode?: string | null;
}

export interface ActionSource {
  links?: HateoasLink[] | null;
  actions?: ResourceAction[] | null;
}

export type ActionState =
  | { visible: false }
  | { visible: true; available: true; link?: HateoasLink }
  | { visible: true; available: false; reason: string };

const NO_REASON = "This action isn't available right now.";

interface ResolveOptions {
  // Until a resource sends actions[] (§9.1 temporary rule): is the action available by the old signal
  // (a link, or loans' nextStatuses)? Known-but-unavailable actions are hidden, as before.
  legacyAvailable?: boolean;
  // Whether the user holds the right for this action. Without it the action is hidden, unless `primary`.
  hasRight?: boolean;
  // The record's main workflow action: shown disabled with a permission reason instead of hidden.
  primary?: boolean;
  permissionReason?: string;
}

export function resolveAction(source: ActionSource | null | undefined, rel: string, options: ResolveOptions = {}): ActionState {
  const { hasRight = true, primary = false, permissionReason } = options;
  if (!hasRight) {
    return primary
      ? { visible: true, available: false, reason: permissionReason ?? "You don't have permission to do this." }
      : { visible: false };
  }
  const link = source?.links?.find((l) => l.rel === rel);
  const action = source?.actions?.find((a) => a.rel === rel);
  if (action) {
    if (action.available) return { visible: true, available: true, link };
    if (!action.reason && import.meta.env.DEV) console.warn(`[actions] "${rel}" is unavailable but the API sent no reason.`);
    return { visible: true, available: false, reason: action.reason || NO_REASON };
  }
  if (source?.actions && source.actions.length > 0) return { visible: false };
  const available = options.legacyAvailable ?? Boolean(link);
  return available ? { visible: true, available: true, link } : { visible: false };
}

interface ActionButtonProps extends Omit<ButtonProps, 'disabledReason'> {
  state: ActionState;
  // Another workflow action is running: disable without a tooltip (§9.2).
  busy?: boolean;
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton({ state, busy, disabled, ...props }, ref) {
  if (!state.visible) return null;
  return (
    <Button
      ref={ref}
      disabled={disabled || (busy && !props.loading)}
      disabledReason={state.available ? undefined : state.reason}
      {...props}
    />
  );
});

// Reasons for blocked actions, listed as captions on mobile where tooltips don't work (§9.2).
export function BlockedReasons({ states, className }: { states: { label: string; state: ActionState }[]; className?: string }) {
  const blocked = states.filter((s) => s.state.visible && !s.state.available);
  if (blocked.length === 0) return null;
  return (
    <ul className={className ?? 'mt-2 space-y-0.5 text-caption text-muted-foreground md:hidden'}>
      {blocked.map((b) => (
        <li key={b.label}>
          <span className="font-medium text-foreground">{b.label}:</span> {(b.state as { reason: string }).reason}
        </li>
      ))}
    </ul>
  );
}
