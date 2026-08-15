'use client';

export type OptionGridItem<T extends string> = {
  id: T;
  label: string;
  hint?: string;
};

export function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'Options',
  disabled = false,
}: {
  options: OptionGridItem<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="g-drug-grid" role="listbox" aria-label={ariaLabel} aria-disabled={disabled || undefined}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="option"
          aria-selected={value === opt.id}
          className={`g-drug-btn${value === opt.id ? ' g-drug-btn-active' : ''}`}
          disabled={disabled}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
