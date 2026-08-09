'use client';

import { parsePositiveInteger } from '@local/lib/numeric-input';

export function NumericInput({
  id,
  value,
  onChange,
  suffix,
  label,
  className,
}: {
  id: string;
  value: string;
  onChange: (raw: string, parsed: number | null) => void;
  suffix?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`g-numeric-input${className ? ` ${className}` : ''}`}>
      {label && (
        <label htmlFor={id} className="g-visually-hidden">
          {label}
        </label>
      )}
      <input
        id={id}
        className="g-numeric-input-field"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value, parsePositiveInteger(e.target.value))}
      />
      {suffix && <span className="g-numeric-input-suffix">{suffix}</span>}
    </div>
  );
}
