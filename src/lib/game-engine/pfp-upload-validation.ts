/** Server-side image upload validation for player PFP uploads. */

export const PFP_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export type AllowedPfpMime = 'image/png' | 'image/jpeg' | 'image/webp';

export const ALLOWED_PFP_MIMES: AllowedPfpMime[] = ['image/png', 'image/jpeg', 'image/webp'];

const SIGNATURES: Array<{ mime: AllowedPfpMime; check: (buf: Buffer) => boolean }> = [
  {
    mime: 'image/png',
    check: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47,
  },
  {
    mime: 'image/jpeg',
    check: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  {
    mime: 'image/webp',
    check: (buf) =>
      buf.length >= 12 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP',
  },
];

export function detectPfpMime(buffer: Buffer): AllowedPfpMime | null {
  for (const sig of SIGNATURES) {
    if (sig.check(buffer)) return sig.mime;
  }
  return null;
}

export function extensionForMime(mime: AllowedPfpMime): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
  }
}

export function validatePfpUpload(buffer: Buffer, declaredMime?: string | null): {
  ok: true;
  mime: AllowedPfpMime;
} | {
  ok: false;
  error: string;
} {
  if (buffer.length === 0) {
    return { ok: false, error: 'Image file is empty.' };
  }
  if (buffer.length > PFP_MAX_BYTES) {
    return { ok: false, error: 'Image must be 2 MB or smaller.' };
  }

  const detected = detectPfpMime(buffer);
  if (!detected) {
    return { ok: false, error: 'Use a PNG, JPEG, or WEBP image.' };
  }

  if (declaredMime && declaredMime !== detected) {
    return { ok: false, error: 'File type does not match image contents.' };
  }

  return { ok: true, mime: detected };
}
