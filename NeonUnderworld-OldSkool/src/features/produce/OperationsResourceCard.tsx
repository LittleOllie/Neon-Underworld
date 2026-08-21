'use client';

type Props = {
  label: string;
  hint: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export function OperationsResourceCard({ label, hint, selected, disabled, onSelect }: Props) {
  return (
    <button
      type="button"
      className={`g-scout-area-card${selected ? ' g-scout-area-card--selected' : ''}`}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
    >
      <div className="g-scout-area-card__head">
        <span className="g-scout-area-card__name">{label}</span>
        {selected ? <span className="g-scout-area-card__badge">Selected</span> : null}
      </div>
      {selected ? <p className="g-scout-area-card__tagline">{hint}</p> : null}
    </button>
  );
}
