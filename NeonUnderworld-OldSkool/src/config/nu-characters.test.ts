import { describe, expect, it } from 'vitest';
import { nuOperatorSrc, nuOperatorUrl } from '@local/config/nu-characters';

describe('nu-characters', () => {
  it('maps master operator to dedicated NU character path', () => {
    expect(nuOperatorSrc()).toBe('/images/nu/characters/operator.png');
    expect(nuOperatorUrl()).toBe('/images/nu/characters/operator.png?v=1');
  });
});
