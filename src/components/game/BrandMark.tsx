interface BrandMarkProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function BrandMark({ size = 'md', className = '' }: BrandMarkProps) {
  const sizeClass = size === 'sm' ? 'text-sm' : 'text-base';
  return (
    <span
      className={`font-display inline-flex items-center gap-1.5 font-semibold tracking-[0.2em] text-gold ${sizeClass} ${className}`}
      aria-label="Neon Underworld"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-gold shadow-[0_0_8px_rgba(196,160,85,0.4)]" aria-hidden />
      NU
    </span>
  );
}
