import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, Lock } from 'lucide-react';

interface OperationItemProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  available?: boolean;
  badge?: string;
  onClick?: () => void;
}

export function OperationItem({
  icon: Icon,
  title,
  description,
  href,
  available = true,
  badge,
}: OperationItemProps) {
  const inner = (
    <>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          available ? 'bg-gold-muted text-gold' : 'bg-surface-elevated text-muted'
        }`}
      >
        {available ? (
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        ) : (
          <Lock className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
          {badge && (
            <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      {available && href && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      )}
    </>
  );

  if (available && href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface-hover active:scale-[0.99]"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3 opacity-70" aria-disabled="true">
      {inner}
    </div>
  );
}

interface IntelItemProps {
  icon: LucideIcon;
  title: string;
  detail?: string;
  time?: string;
}

export function IntelItem({ icon: Icon, title, detail, time }: IntelItemProps) {
  return (
    <div className="flex items-start gap-3 border-b border-border-subtle py-3 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-purple" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{title}</p>
        {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
      </div>
      {time && <time className="shrink-0 text-[10px] text-muted">{time}</time>}
    </div>
  );
}
