type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-surface-elevated text-muted border-border',
  success: 'bg-green/10 text-green border-green/30',
  warning: 'bg-gold/10 text-gold border-gold/30',
  danger: 'bg-red/10 text-red border-red/30',
  info: 'bg-cyan/10 text-cyan border-cyan/30',
};

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

export function StatusBadge({ children, variant = 'default' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${VARIANTS[variant]}`}
    >
      {children}
    </span>
  );
}
