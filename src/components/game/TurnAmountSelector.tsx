'use client';

interface TurnAmountSelectorProps {
  values: readonly number[];
  selected: number | null;
  onSelect: (value: number) => void;
  max?: number;
  customValue?: number;
  onCustomChange?: (value: number) => void;
}

export function TurnAmountSelector({
  values,
  selected,
  onSelect,
  max = Infinity,
  customValue,
  onCustomChange,
}: TurnAmountSelectorProps) {
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
              className={`min-h-[44px] min-w-[56px] rounded-xl border px-4 py-2 font-mono-figures text-sm font-medium transition-all duration-200 ${
                active
                  ? 'border-gold bg-gold-muted text-gold'
                  : disabled
                    ? 'border-border-subtle text-muted opacity-40'
                    : 'border-border bg-surface hover:border-gold/40'
              }`}
              aria-pressed={active}
            >
              {v}
            </button>
          );
        })}
      </div>
      {onCustomChange && (
        <div>
          <label htmlFor="custom-turns" className="text-label">
            Custom amount
          </label>
          <input
            id="custom-turns"
            type="number"
            min={1}
            max={max}
            value={customValue ?? ''}
            onChange={(e) => onCustomChange(parseInt(e.target.value) || 0)}
            className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2.5 font-mono-figures text-sm focus:border-gold focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
