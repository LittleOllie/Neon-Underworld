import { GameIcon } from './GameIcon';
import type { GameIconName } from '@local/config/game-icons';
import type { GameIconTone } from './GameIcon';

export function ButtonContent({
  icon,
  iconSize = 20,
  iconTone = 'default',
  children,
}: {
  icon?: GameIconName;
  iconSize?: number;
  iconTone?: GameIconTone;
  children: React.ReactNode;
}) {
  return (
    <span className="g-btn__inner">
      {icon && <GameIcon name={icon} size={iconSize} tone={iconTone} />}
      <span>{children}</span>
    </span>
  );
}
