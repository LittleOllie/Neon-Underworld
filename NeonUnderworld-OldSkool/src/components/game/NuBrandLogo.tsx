import { nuLogoUrl } from '@local/config/nu-brand';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  priority?: boolean;
  className?: string;
};

/** Approved NU logo — HTML overlay only, never baked into background art. */
export function NuBrandLogo({ size = 'md', priority = false, className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand asset; natural aspect ratio
    <img
      src={nuLogoUrl()}
      alt="Neon Underworld"
      className={['nu-brand-logo', `nu-brand-logo--${size}`, className].filter(Boolean).join(' ')}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding={priority ? 'sync' : 'async'}
    />
  );
}
