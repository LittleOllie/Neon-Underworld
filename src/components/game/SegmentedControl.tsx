'use client';

interface SegmentedControlProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-xl bg-surface p-1 scrollbar-none"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`min-h-[40px] shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-200 ${
              active
                ? 'bg-surface-elevated text-gold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
