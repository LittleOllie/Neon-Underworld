'use client';

/** Small NU-branded loader — CSS-only, respects reduced motion. */
export function BrandedLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      className={`nu-loader nu-loader--${size}`}
      role="img"
      aria-label="Loading"
    >
      <span className="nu-loader__mark" aria-hidden="true">
        NU
      </span>
    </div>
  );
}
