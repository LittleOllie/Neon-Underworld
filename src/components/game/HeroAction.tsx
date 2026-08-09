import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface HeroActionProps {
  title: string;
  description: string;
  action: string;
  href: string;
  priority?: 'high' | 'medium' | 'low';
}

export function HeroAction({ title, description, action, href, priority = 'medium' }: HeroActionProps) {
  return (
    <section className="hero-panel rounded-2xl p-5" aria-label="Recommended action">
      <p className="text-label text-gold-dim">Recommended</p>
      <h2 className="font-display mt-1 text-xl font-semibold leading-snug">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <Link
        href={href}
        className={`mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
          priority === 'high'
            ? 'bg-gold text-background hover:bg-gold-bright'
            : 'border border-border bg-surface-elevated text-foreground hover:border-gold/30'
        }`}
      >
        {action}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}
