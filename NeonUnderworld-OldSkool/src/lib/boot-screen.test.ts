import { describe, expect, it } from 'vitest';
import {
  getBootCopy,
  BOOT_SCREEN,
  bootBackgroundUrl,
} from '@local/config/boot-screen';

describe('boot screen copy', () => {
  it('shows welcome with alias when authenticated', () => {
    const copy = getBootCopy('authenticated', 'Vex_Morgan');
    expect(copy.welcome).toBe('Welcome Vex_Morgan!');
    expect(copy.alias).toBeNull();
    expect(copy.status).toBe('NETWORK READY');
    expect(copy.enterLabel).toBe('ENTER EMPIRE');
  });

  it('shows connecting while session loads', () => {
    const copy = getBootCopy('loading');
    expect(copy.welcome).toBeNull();
    expect(copy.status).toBe('CONNECTING TO THE NETWORK…');
    expect(copy.enterLabel).toBeNull();
  });

  it('shows sign in when unauthenticated', () => {
    const copy = getBootCopy('unauthenticated');
    expect(copy.welcome).toBeNull();
    expect(copy.status).toBe('NETWORK READY');
    expect(copy.enterLabel).toBe('SIGN IN');
  });

  it('uses approved NU intro artwork', () => {
    expect(BOOT_SCREEN.backgroundSrc).toContain('/images/nu/backgrounds/intro.webp');
    expect(bootBackgroundUrl()).toMatch(/intro\.webp\?v=/);
  });

  it('uses approved NU brand logo', () => {
    expect(BOOT_SCREEN.logoSrc).toContain('/images/nu/brand/nu-logo.webp');
  });
});
