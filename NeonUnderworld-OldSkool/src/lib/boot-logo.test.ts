import { describe, expect, it } from 'vitest';

describe('boot logo asset', () => {
  it('optimized webp is substantially smaller than source png', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const base = path.join(process.cwd(), 'public/images/game-backgrounds');
    const png = await fs.stat(path.join(base, 'NUPFPLogo.PNG'));
    const webp = await fs.stat(path.join(base, 'NUPFPLogo.webp'));
    expect(webp.size).toBeLessThan(png.size * 0.05);
  });
});
