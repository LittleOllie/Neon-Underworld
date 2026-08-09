import Link from 'next/link';
import { StatusPill } from '@/components/game/StatusPill';

interface AlphaPreviewProps {
  title: string;
  description: string;
  previewItems?: string[];
  primaryAction?: { label: string; href: string };
}

export function AlphaPreview({ title, description, previewItems, primaryAction }: AlphaPreviewProps) {
  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <StatusPill variant="purple">Alpha preview</StatusPill>
        <h1 className="font-display mt-3 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>

      {previewItems && previewItems.length > 0 && (
        <div className="panel rounded-2xl p-4">
          <p className="text-label mb-3">Coming in alpha</p>
          <ul className="space-y-2">
            {previewItems.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-gold-dim" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {primaryAction && (
        <Link
          href={primaryAction.href}
          className="mt-6 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-gold-bright"
        >
          {primaryAction.label}
        </Link>
      )}
    </div>
  );
}

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
}

export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
    </div>
  );
}
