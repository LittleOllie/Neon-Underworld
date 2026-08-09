import { GameIcon } from './GameIcon';
import type { GameIconName } from '@local/config/game-icons';

export function PageTitle({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: GameIconName;
}) {
  return (
    <h1 className={`g-title${icon ? ' g-icon-label' : ''}`}>
      {icon && <GameIcon name={icon} size={22} />}
      {children}
    </h1>
  );
}
