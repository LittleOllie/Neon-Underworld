import { describe, expect, it } from 'vitest';
import { validatePfpUpload, PFP_MAX_BYTES } from '@/lib/game-engine/pfp-upload-validation';

describe('validatePfpUpload', () => {
  it('accepts valid PNG magic bytes', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const result = validatePfpUpload(buf, 'image/png');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mime).toBe('image/png');
  });

  it('rejects oversize uploads', () => {
    const buf = Buffer.alloc(PFP_MAX_BYTES + 1);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    const result = validatePfpUpload(buf);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/2 MB/);
  });

  it('rejects unknown file types', () => {
    const buf = Buffer.from('not an image');
    const result = validatePfpUpload(buf);
    expect(result.ok).toBe(false);
  });
});
