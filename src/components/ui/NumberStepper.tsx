'use client';

interface NumberStepperProps {
  values: readonly number[];
  selected: number | null;
  onSelect: (value: number) => void;
  max?: number;
  customValue?: number;
  onCustomChange?: (value: number) => void;
  showCustom?: boolean;
}

export function NumberStepper({
  values,
  selected,
  onSelect,
  max = Infinity,
  customValue,
  onCustomChange,
  showCustom = true,
}: NumberStepperProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {values.map((v) => {
          const disabled = v > max;
          const active = selected === v;
          return (
            <button
              key={v}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(v)}
              className={`min-h-[44px] min-w-[56px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                active
                  ? 'border-gold bg-gold/10 text-gold'
                  : disabled
                    ? 'border-border-subtle text-muted opacity-40'
                    : 'border-border hover:border-gold/40'
              }`}
              aria-pressed={active}
            >
              {v}
            </button>
          );
        })}
      </div>
      {showCustom && onCustomChange && (
        <div>
          <label htmlFor="custom-turns" className="text-xs text-muted">
            Custom amount
          </label>
          <input
            id="custom-turns"
            type="number"
            min={1}
            max={max}
            value={customValue ?? ''}
            onChange={(e) => onCustomChange(parseInt(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-mono-figures text-sm focus:border-gold focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
