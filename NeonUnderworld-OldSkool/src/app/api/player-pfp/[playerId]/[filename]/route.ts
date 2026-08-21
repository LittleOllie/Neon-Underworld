import { NextResponse } from 'next/server';
import { readLocalPfpFile } from '@local/server/storage/pfp-storage';
import { extensionForMime, type AllowedPfpMime } from '@core/lib/game-engine/pfp-upload-validation';

const MIME_BY_EXT: Record<string, AllowedPfpMime> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** Serve locally stored PFP files during development. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ playerId: string; filename: string }> },
) {
  const { playerId, filename } = await context.params;
  if (!playerId || !filename || filename.includes('..')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const buffer = await readLocalPfpFile(`${playerId}/${filename}`);
  if (!buffer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
