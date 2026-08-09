interface ResourceMetricProps {
  label: string;
  value: string | number;
  sublabel?: string;
  priority?: boolean;
  className?: string;
}

export function ResourceMetric({
  label,
  value,
  sublabel,
  priority = false,
  className = '',
}: ResourceMetricProps) {
  return (
    <div className={`${priority ? 'flex-[1.2]' : 'flex-1'} ${className}`}>
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p
        className={`font-mono-figures ${priority ? 'text-2xl font-semibold text-gold' : 'text-lg font-medium'}`}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sublabel && <p className="text-xs text-muted">{sublabel}</p>}
    </div>
  );
}
