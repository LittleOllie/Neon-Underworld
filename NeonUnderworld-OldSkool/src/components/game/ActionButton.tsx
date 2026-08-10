import Link from 'next/link';
import type { GameIconName } from '@local/config/game-icons';
import { ButtonContent } from './ButtonContent';

export function ActionButton({
  href,
  icon,
  children,
  className,
  prefetch,
}: {
  href: string;
  icon?: GameIconName;
  children: React.ReactNode;
  className?: string;
  /** Next.js route prefetch — use on likely next destinations. */
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={`g-btn${className ? ` ${className}` : ''}`}
    >
      <ButtonContent icon={icon} iconSize={22}>
        {children}
      </ButtonContent>
    </Link>
  );
}
