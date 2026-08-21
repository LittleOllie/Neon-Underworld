import { describe, expect, it } from 'vitest';
import { nuLogoSrc, nuLogoUrl } from '@local/config/nu-brand';

describe('nu-brand', () => {
  it('maps logo to dedicated NU brand path', () => {
    expect(nuLogoSrc()).toBe('/images/nu/brand/nu-logo.webp');
    expect(nuLogoUrl()).toBe('/images/nu/brand/nu-logo.webp?v=3');
  });
});
