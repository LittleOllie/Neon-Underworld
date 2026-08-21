import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NuScene } from '@local/components/game/NuScene';
import { NuOperator } from '@local/components/game/NuOperator';

describe('NuOperator', () => {
  it('renders master operator asset with non-interactive decorative classes', () => {
    const html = renderToStaticMarkup(<NuOperator />);
    expect(html).toContain('/images/nu/characters/operator.png?v=1');
    expect(html).toContain('nu-operator');
    expect(html).toContain('aria-hidden="true"');
  });
});

describe('NuScene', () => {
  it('does not composite operator on intro (cinematic art includes its own figure)', () => {
    const html = renderToStaticMarkup(<NuScene background="intro" showOperator />);
    expect(html).not.toContain('/images/nu/characters/operator.png');
    expect(html).toContain('nu-scene__env');
  });

  it('omits operator when showOperator is false', () => {
    const html = renderToStaticMarkup(<NuScene background="intro" showOperator={false} />);
    expect(html).not.toContain('/images/nu/characters/operator.png');
  });

  it('uses pointer-events none on the scene root', () => {
    const html = renderToStaticMarkup(<NuScene background="intro" />);
    expect(html).toContain('nu-scene');
  });

  it('omits operator on command gameplay scene', () => {
    const html = renderToStaticMarkup(<NuScene background="command" />);
    expect(html).toContain('/images/nu/backgrounds/command.webp?v=3');
    expect(html).not.toContain('/images/nu/characters/operator.png');
  });
});
