'use client';

export type FilterPillOption<T extends string> = {
  id: T;
  label: string;
};

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'Filter',
}: {
  options: FilterPillOption<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="g-filter-row" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`g-filter${value === opt.id ? ' g-filter-active' : ''}`}
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
