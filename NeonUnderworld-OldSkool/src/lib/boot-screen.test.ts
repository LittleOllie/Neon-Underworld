import { describe, expect, it } from 'vitest';
import {
  getBootCopy,
  BOOT_SCREEN,
  BOOT_PHONE_MAX_WIDTH,
  bootBackgroundUrl,
  bootPhoneBackgroundUrl,
  bootPhoneMediaQuery,
} from '@local/config/boot-screen';

describe('boot screen copy', () => {
  it('shows welcome back with alias when authenticated', () => {
    const copy = getBootCopy('authenticated', 'Vex_Morgan');
    expect(copy.welcome).toBe('Welcome back');
    expect(copy.alias).toBe('Vex_Morgan');
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

  it('uses NUIntroScreen artwork on desktop', () => {
    expect(BOOT_SCREEN.backgroundSrc).toContain('NUIntroScreen.webp');
    expect(bootBackgroundUrl()).toMatch(/NUIntroScreen\.webp\?v=/);
  });

  it('uses NUIntroPhone artwork on phone', () => {
    expect(BOOT_SCREEN.phoneBackgroundSrc).toContain('NUIntroPhone.webp');
    expect(bootPhoneBackgroundUrl()).toMatch(/NUIntroPhone\.webp\?v=/);
    expect(bootPhoneMediaQuery()).toBe(`(max-width: ${BOOT_PHONE_MAX_WIDTH}px)`);
  });
});
