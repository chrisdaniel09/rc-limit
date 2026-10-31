import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import { TONE_BADGE, type Tone } from '../lib/status';

interface BadgeProps {
  text: string;
  variant?: Tone;
  icon?: LucideIcon;
  className?: string;
}

// A plain labelled pill. For domain statuses use StatusBadge, which adds the registry's label and icon.
export default function Badge({ text, variant = 'neutral', icon: Icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-micro',
        TONE_BADGE[variant],
        className,
      )}
    >
      {Icon && <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />}
      {text}
    </span>
  );
}
