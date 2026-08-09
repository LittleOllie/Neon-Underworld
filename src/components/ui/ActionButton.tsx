import Link from 'next/link';

interface ActionButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  ariaLabel?: string;
}

const VARIANTS = {
  primary: 'bg-gold text-background hover:bg-gold/90',
  secondary: 'border border-border bg-surface hover:border-gold/40',
  ghost: 'text-muted hover:text-foreground',
};

export function ActionButton({
  children,
  href,
  onClick,
  variant = 'primary',
  disabled = false,
  type = 'button',
  className = '',
  ariaLabel,
}: ActionButtonProps) {
  const base =
    'inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';

  if (href && !disabled) {
    return (
      <Link href={href} className={`${base} ${VARIANTS[variant]} ${className}`} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${VARIANTS[variant]} ${className}`}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
