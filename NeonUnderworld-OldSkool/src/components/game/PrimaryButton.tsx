import { GameIcon } from './GameIcon';
import type { GameIconName } from '@local/config/game-icons';
import type { GameIconTone } from './GameIcon';
import { ButtonContent } from './ButtonContent';

export function PrimaryButton({
  children,
  type = 'button',
  disabled,
  pending,
  variant,
  className,
  icon,
  iconTone = 'default',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'danger' | 'secondary';
  icon?: GameIconName;
  iconTone?: GameIconTone;
  pending?: boolean;
}) {
  const classes = [
    'g-btn',
    variant === 'danger' ? 'g-btn-danger' : '',
    variant === 'secondary' ? 'g-btn-secondary' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const tone =
    iconTone !== 'default'
      ? iconTone
      : variant === 'danger'
        ? 'danger'
        : 'default';

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      <ButtonContent icon={icon} iconTone={tone}>
        {children}
      </ButtonContent>
    </button>
  );
}
