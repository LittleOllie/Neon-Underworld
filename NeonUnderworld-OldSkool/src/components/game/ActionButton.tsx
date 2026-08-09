import Link from 'next/link';
import type { GameIconName } from '@local/config/game-icons';
import { ButtonContent } from './ButtonContent';

export function ActionButton({
  href,
  icon,
  children,
  className,
}: {
  href: string;
  icon?: GameIconName;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`g-btn${className ? ` ${className}` : ''}`}>
      <ButtonContent icon={icon} iconSize={22}>
        {children}
      </ButtonContent>
    </Link>
  );
}
