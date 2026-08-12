import { describe, expect, it } from 'vitest';
import { APP_BRANDING } from '@local/config/app-branding';

describe('app branding icons', () => {
  it('points at NUPFPLogo-derived public icon assets', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const publicDir = path.join(process.cwd(), 'public');

    expect(APP_BRANDING.logoSrc).toBe('/images/game-backgrounds/NUPFPLogo.PNG');

    for (const iconPath of Object.values(APP_BRANDING.icons)) {
      await expect(fs.access(path.join(publicDir, iconPath))).resolves.toBeUndefined();
    }
  });
});
