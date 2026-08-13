import { StatusBadge } from './StatusBadge';

type SelectableCardProps = {
  title: React.ReactNode;
  meta?: React.ReactNode;
  selected?: boolean;
  highlighted?: boolean;
  selectedLabel?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  /** button for selectable rows; div for static cards with actions inside */
  as?: 'button' | 'div';
};

export function SelectableCard({
  title,
  meta,
  selected = false,
  highlighted = false,
  selectedLabel = 'Selected',
  onClick,
  children,
  className,
  as,
}: SelectableCardProps) {
  const useButton = as === 'button' || (as !== 'div' && onClick != null);
  const classes = [
    useButton ? 'g-area-row' : 'g-listing-card',
    selected ? 'g-area-row-selected' : '',
    highlighted ? 'g-area-row-highlight' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <div className="g-area-name-row">
        <div className="g-area-name">{title}</div>
        {selected && <StatusBadge tone="default">{selectedLabel}</StatusBadge>}
      </div>
      {meta ? <div className="g-area-meta">{meta}</div> : null}
      {children}
    </>
  );

  if (useButton) {
    return (
      <button
        type="button"
        className={classes}
        onClick={onClick}
        aria-pressed={selected}
      >
        {body}
      </button>
    );
  }

  return <div className={classes}>{body}</div>;
}
