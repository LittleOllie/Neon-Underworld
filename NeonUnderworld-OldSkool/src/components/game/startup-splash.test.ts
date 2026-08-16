import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('startup splash first paint', () => {
  it('root layout includes static splash before providers', () => {
    const layoutPath = path.resolve(__dirname, '../../app/layout.tsx');
    const source = readFileSync(layoutPath, 'utf8');
    expect(source).toContain('StartupSplash');
    expect(source).toContain('StartupSplashDismiss');
    expect(source).toContain('nu-startup-pending');
    expect(source).toContain('NUPFPLogo.webp');
  });

  it('loading css defines startup splash styles', () => {
    const cssPath = path.resolve(__dirname, '../../styles/loading.css');
    const css = readFileSync(cssPath, 'utf8');
    expect(css).toContain('.nu-startup-splash');
    expect(css).toContain('prefers-reduced-motion');
  });
});
