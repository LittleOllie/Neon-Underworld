import { GameIcon } from './GameIcon';
import { GameValue } from './GameValue';
import type { GameIconName } from '@local/config/game-icons';

export function SectionHeadingRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: GameIconName;
}) {
  return (
    <div className="g-section-head">
      <span className="g-section-head-label g-icon-label">
        {icon && <GameIcon name={icon} size={18} />}
        {label}
      </span>
      <GameValue>{value}</GameValue>
    </div>
  );
}
