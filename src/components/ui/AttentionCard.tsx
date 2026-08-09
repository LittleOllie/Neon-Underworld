import Link from 'next/link';

interface AttentionCardProps {
  title: string;
  description: string;
  action: string;
  href: string;
  priority?: 'high' | 'medium' | 'low';
}

export function AttentionCard({ title, description, action, href, priority = 'medium' }: AttentionCardProps) {
  const borderClass =
    priority === 'high'
      ? 'border-gold/40'
      : priority === 'medium'
        ? 'border-border'
        : 'border-border-subtle';

  return (
    <Link
      href={href}
      className={`block rounded-xl border ${borderClass} bg-surface p-5 transition-colors duration-200 hover:border-gold/30`}
    >
      <p className="text-xs uppercase tracking-wider text-gold">Recommended</p>
      <h2 className="mt-1 font-display text-lg">{title}</h2>
      <p className="mt-2 text-sm text-muted">{description}</p>
      <span className="mt-4 inline-flex min-h-[44px] items-center text-sm font-medium text-gold">
        {action} →
      </span>
    </Link>
  );
}
