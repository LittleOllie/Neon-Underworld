import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const VARIANTS: Record<Variant, string> = {
  default: 'bg-surface-elevated text-muted-foreground border-border-subtle',
  success: 'bg-green/10 text-green border-green/25',
  warning: 'bg-amber/10 text-amber border-amber/25',
  danger: 'bg-red/10 text-red border-red/25',
  info: 'bg-cyan/10 text-cyan border-cyan/25',
  purple: 'bg-purple/10 text-purple border-purple/25',
};

interface StatusPillProps {
  children: React.ReactNode;
  variant?: Variant;
}

export function StatusPill({ children, variant = 'default' }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${VARIANTS[variant]}`}
    >
      {children}
    </span>
  );
}

interface AlertItemProps {
  icon: LucideIcon;
  title: string;
  detail?: string;
  href?: string;
  variant?: 'warning' | 'info' | 'success';
}

const ALERT_COLORS = {
  warning: 'text-amber',
  info: 'text-cyan',
  success: 'text-green',
};

export function AlertItem({ icon: Icon, title, detail, href, variant = 'info' }: AlertItemProps) {
  const content = (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ALERT_COLORS[variant]}`} strokeWidth={1.75} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{title}</p>
        {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-lg -mx-2 px-2 transition-colors hover:bg-surface-hover">
        {content}
      </Link>
    );
  }
  return content;
}
